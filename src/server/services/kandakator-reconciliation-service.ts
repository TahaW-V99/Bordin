import { addDays, subDays } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
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
import {
  fetchMatchById,
  isFixtureApiConfigured,
  mapFixtureStatus,
  parseFixtureExternalId,
  readMatchScore,
} from "@/server/services/fixture-api";
import {
  isFixtureApiCircuitOpen,
  recordFixtureApiFailure,
  recordFixtureApiSuccess,
  syncDailyKandakatorFromFootballMatches,
} from "@/server/services/kandakator-sync-service";
import { isMatchResultKnown } from "@/shared/lib/match-result";

export type ReconciliationResult = {
  staleCount: number;
  orphanCount: number;
  unsettledCount: number;
  partialScoreCount: number;
  datesTriggered: string[];
  settledCount: number;
  idRefreshCount: number;
  durationMs: number;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
};

function staleIdRefreshMax() {
  const raw = process.env.KANDAKATOR_STALE_ID_REFRESH_MAX?.trim();
  if (!raw) return 8;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(30, Math.floor(parsed)) : 8;
}

type StaleIdRetryState = { attempts: number; nextRetryAt: number };
const staleIdRetryByMatchId = new Map<string, StaleIdRetryState>();
const STALE_ID_BACKOFF_BASE_MS = 5 * 60 * 1000;
const STALE_ID_BACKOFF_MAX_MS = 6 * 60 * 60 * 1000;

function staleIdBackoffMs(attempts: number) {
  return Math.min(STALE_ID_BACKOFF_MAX_MS, STALE_ID_BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

function isStaleIdRefreshInCooldown(matchId: string) {
  const state = staleIdRetryByMatchId.get(matchId);
  return state != null && Date.now() < state.nextRetryAt;
}

function recordStaleIdRefreshFailure(matchId: string) {
  const attempts = (staleIdRetryByMatchId.get(matchId)?.attempts ?? 0) + 1;
  staleIdRetryByMatchId.set(matchId, {
    attempts,
    nextRetryAt: Date.now() + staleIdBackoffMs(attempts),
  });
}

function resetStaleIdRefreshRetry(matchId: string) {
  staleIdRetryByMatchId.delete(matchId);
}

function isByIdRefreshResolved(apiMatch: NonNullable<Awaited<ReturnType<typeof fetchMatchById>>>) {
  const status = mapFixtureStatus(apiMatch.status);
  if (status === "CANCELLED" || status === "POSTPONED") return true;
  const scores = readMatchScore(apiMatch);
  return isMatchResultKnown({
    status,
    homeScore: scores.homeScore,
    awayScore: scores.awayScore,
  });
}

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
      externalId: true,
      status: true,
      homeScore: true,
      awayScore: true,
      kickoffAt: true,
    },
  });
}

async function refreshStaleMatchesByFixtureId(
  staleMatches: Array<{ id: string; externalId: string | null; kickoffAt: Date }>,
): Promise<number> {
  if (!isFixtureApiConfigured() || isFixtureApiCircuitOpen()) return 0;

  const maxRefresh = staleIdRefreshMax();
  if (maxRefresh <= 0) return 0;

  const candidates = [...staleMatches]
    .filter((m) => parseFixtureExternalId(m.externalId) != null)
    .filter((m) => !isStaleIdRefreshInCooldown(m.id))
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime())
    .slice(0, maxRefresh);

  let refreshed = 0;
  for (const match of candidates) {
    if (isFixtureApiCircuitOpen()) break;

    const apiId = parseFixtureExternalId(match.externalId);
    if (apiId == null) continue;

    try {
      const apiMatch = await fetchMatchById(apiId, { noCache: true });
      if (!apiMatch) {
        recordStaleIdRefreshFailure(match.id);
        continue;
      }

      recordFixtureApiSuccess();
      await syncDailyKandakatorFromFootballMatches(
        tehranDateKey(match.kickoffAt),
        [apiMatch],
        { publish: true, source: "reconciliation:by-id" },
      );

      if (isByIdRefreshResolved(apiMatch)) {
        resetStaleIdRefreshRetry(match.id);
        refreshed += 1;
      } else {
        recordStaleIdRefreshFailure(match.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "fixture_api_daily_budget_exhausted") break;
      recordStaleIdRefreshFailure(match.id);
      recordFixtureApiFailure(error);
      if (isFixtureApiCircuitOpen()) break;
    }
  }

  return refreshed;
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
      idRefreshCount: 0,
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

    const idRefreshCount = await refreshStaleMatchesByFixtureId(staleMatches);

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
      remainingStale.length > 0 && datesTriggered.length === 0 && idRefreshCount === 0
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
      idRefreshCount,
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
        idRefreshCount,
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
      idRefreshCount: 0,
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
