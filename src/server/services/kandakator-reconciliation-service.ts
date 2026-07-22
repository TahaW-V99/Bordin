import { addDays, subDays } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
import { isMatchResultKnown } from "@/shared/lib/match-result";
import {
  detectMatchConsistencyIssues,
  derivePredictionCategory,
} from "@/shared/lib/match-lifecycle";
import {
  logFixtureScoreViolation,
  logPredictionCategoryChange,
  logReconcileEvent,
} from "@/server/services/match-lifecycle-logger";
import { recordKandakatorSync } from "@/server/services/kandakator-sync-health";
import { enqueueKandakatorSyncDatesIfNeeded } from "@/server/services/kandakator-sync-queue-service";
import {
  getRecentTehranDateKeys,
  countPublishedMatchesForDate,
  hasPublishedKandakatorForDate,
} from "@/server/services/kandakator-display-ingest";
import { settleAllFinishedMatches } from "@/server/services/settlement-service";

export type ReconciliationResult = {
  staleCount: number;
  orphanCount: number;
  unsettledCount: number;
  partialScoreCount: number;
  datesTriggered: string[];
  settledCount: number;
  durationMs: number;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
};

async function findStaleMatches() {
  const now = new Date();
  const since = subDays(now, 14);

  return prisma.footballMatch.findMany({
    where: {
      kickoffAt: { gte: since, lte: now },
      status: { notIn: ["CANCELLED", "POSTPONED"] },
      OR: [{ homeScore: null }, { awayScore: null }],
      kandakatorMatches: { some: { kandakator: { isPublished: true } } },
    },
    select: {
      id: true,
      status: true,
      homeScore: true,
      awayScore: true,
      kickoffAt: true,
    },
  });
}

async function findUnsettledPredictionsWithKnownResults() {
  return prisma.prediction.findMany({
    where: {
      scoredAt: null,
      match: {
        homeScore: { not: null },
        awayScore: { not: null },
      },
    },
    select: {
      id: true,
      userId: true,
      matchId: true,
      scoredAt: true,
      match: {
        select: {
          status: true,
          homeScore: true,
          awayScore: true,
          kickoffAt: true,
        },
      },
    },
    take: 200,
  });
}

async function findPartialScoreMatches() {
  return prisma.footballMatch.findMany({
    where: {
      OR: [
        { homeScore: { not: null }, awayScore: null },
        { homeScore: null, awayScore: { not: null } },
      ],
      kandakatorMatches: { some: {} },
    },
    select: { id: true, status: true, homeScore: true, awayScore: true, kickoffAt: true },
    take: 50,
  });
}

async function auditFixtureScoreViolations() {
  const finishedWithoutScores = await prisma.footballMatch.findMany({
    where: {
      status: "FINISHED",
      OR: [{ homeScore: null }, { awayScore: null }],
      kandakatorMatches: { some: { kandakator: { isPublished: true } } },
    },
    select: {
      id: true,
      status: true,
      homeScore: true,
      awayScore: true,
      kickoffAt: true,
    },
    take: 50,
  });

  for (const match of finishedWithoutScores) {
    await logFixtureScoreViolation({
      matchId: match.id,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      lifecycleState: "FINISHED",
      source: "reconciliation",
    });
  }
}

/**
 * Automatic reconciliation — detects orphan/stale states and self-heals.
 * Runs on a schedule and can be triggered manually.
 */
export async function runKandakatorReconciliation(): Promise<ReconciliationResult> {
  const startedAt = Date.now();

  if (await shouldUseMemoryDb()) {
    const settle = await settleAllFinishedMatches();
    return {
      staleCount: 0,
      orphanCount: 0,
      unsettledCount: 0,
      partialScoreCount: 0,
      datesTriggered: [],
      settledCount: settle.settled,
      durationMs: Date.now() - startedAt,
      status: "success",
    };
  }

  try {
    const [staleMatches, unsettled, partialScores] = await Promise.all([
      findStaleMatches(),
      findUnsettledPredictionsWithKnownResults(),
      findPartialScoreMatches(),
    ]);

    let orphanCount = 0;
    for (const match of staleMatches) {
      const issues = detectMatchConsistencyIssues(match);
      if (issues.includes("stale_awaiting_result") || issues.includes("orphan_live_past_kickoff")) {
        orphanCount += 1;
      }
    }

    const dateKeys = new Set<string>();
    for (const match of staleMatches) {
      dateKeys.add(tehranDateKey(match.kickoffAt));
    }
    for (const row of unsettled) {
      dateKeys.add(tehranDateKey(row.match.kickoffAt));
    }

    for (const dateKey of getRecentTehranDateKeys(10)) {
      const [matchCount, hasPublished] = await Promise.all([
        countPublishedMatchesForDate(dateKey),
        hasPublishedKandakatorForDate(dateKey),
      ]);
      if (matchCount === 0 && !hasPublished) {
        dateKeys.add(dateKey);
      }
    }

    const datesTriggered = [...dateKeys];

    if (datesTriggered.length > 0) {
      await enqueueKandakatorSyncDatesIfNeeded(datesTriggered, "reconciliation");
    }

    const settleResult = await settleAllFinishedMatches();

    for (const row of unsettled) {
      const category = derivePredictionCategory(
        { scoredAt: row.scoredAt },
        row.match,
      );
      if (category !== "registered") {
        await logPredictionCategoryChange({
          predictionId: row.id,
          userId: row.userId,
          previousCategory: "registered",
          newCategory: category,
          matchId: row.matchId,
          source: "reconciliation",
        });
      }
    }

    await auditFixtureScoreViolations();

    const [remainingStale, remainingUnsettled, remainingPartial] = await Promise.all([
      findStaleMatches(),
      findUnsettledPredictionsWithKnownResults(),
      findPartialScoreMatches(),
    ]);

    const durationMs = Date.now() - startedAt;
    const hasProblems =
      remainingStale.length > 0 || remainingUnsettled.length > 0 || remainingPartial.length > 0;
    const status: ReconciliationResult["status"] =
      remainingStale.length > 0 && datesTriggered.length === 0
        ? "failed"
        : hasProblems
          ? "partial"
          : "success";

    const result: ReconciliationResult = {
      staleCount: remainingStale.length,
      orphanCount,
      unsettledCount: remainingUnsettled.length,
      partialScoreCount: remainingPartial.length,
      datesTriggered,
      settledCount: settleResult.settled,
      durationMs,
      status,
    };

    await logReconcileEvent(result);
    await recordKandakatorSync({
      scope: "reconcile:global",
      status,
      source: "liara-reconcile",
      matchCount: remainingStale.length,
      settledCount: settleResult.settled,
      staleCount: remainingStale.length,
      orphanCount,
      durationMs,
      metadata: {
        datesTriggered,
        unsettledCount: remainingUnsettled.length,
        partialScoreCount: remainingPartial.length,
      },
    });

    if (hasProblems) {
      console.warn("[Bordin] reconciliation found issues:", JSON.stringify(result));
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failed: ReconciliationResult = {
      staleCount: 0,
      orphanCount: 0,
      unsettledCount: 0,
      partialScoreCount: 0,
      datesTriggered: [],
      settledCount: 0,
      durationMs,
      status: "failed",
      errorMessage,
    };

    await logReconcileEvent(failed);
    await recordKandakatorSync({
      scope: "reconcile:global",
      status: "failed",
      source: "liara-reconcile",
      durationMs,
      errorMessage,
    });

    console.error("[Bordin] reconciliation failed:", errorMessage);
    return failed;
  }
}

/** Dates with published kandakator in the last 7 days that may need sync */
export async function getRecentKandakatorDateKeys(): Promise<string[]> {
  if (await shouldUseMemoryDb()) return [];

  const since = subDays(new Date(), 7);
  const rows = await prisma.dailyKandakator.findMany({
    where: { isPublished: true, date: { gte: since } },
    select: { date: true },
  });

  return [...new Set(rows.map((row) => tehranDateKey(row.date)))];
}

export async function countStaleMatchesForDate(dateKey: string) {
  const dayStart = kandakatorDateFromKey(dateKey);
  const dayEnd = addDays(dayStart, 1);
  const now = new Date();

  return prisma.kandakatorMatch.count({
    where: {
      kandakator: {
        isPublished: true,
        date: { gte: dayStart, lt: dayEnd },
      },
      match: {
        kickoffAt: { lte: now },
        OR: [{ homeScore: null }, { awayScore: null }],
        status: { notIn: ["CANCELLED", "POSTPONED"] },
      },
    },
  });
}
