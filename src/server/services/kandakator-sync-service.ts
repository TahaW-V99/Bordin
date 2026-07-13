import { addDays } from "date-fns";
import { MatchStatus } from "@prisma/client";
import { shouldUseMemoryDb } from "@/server/db";
import { prisma } from "@/shared/lib/prisma";
import {
  buildFixtureExternalId,
  fetchMatchesForTehranDate,
  isFixtureApiConfigured,
  mapFixtureStatus,
  readMatchScore,
  type FixtureMatch,
} from "@/server/services/fixture-api";
import { formatShamsiFromDateKey, kandakatorDateFromKey } from "@/shared/lib/dates";
import { translateMatchTeamsToFa } from "@/shared/lib/football-names-fa";
import { settleMatchPredictions } from "@/server/services/settlement-service";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { isMatchResultKnown } from "@/shared/lib/match-result";
import { logMatchStatusChange } from "@/server/services/match-lifecycle-logger";
import { recordKandakatorSync } from "@/server/services/kandakator-sync-health";
import { readMatchScore as readApiMatchScore } from "@/server/services/fixture-api";
import { enqueueKandakatorSyncDates } from "@/server/services/kandakator-sync-queue-service";
import {
  canDeleteKandakatorData,
  isEmptyApiPayload,
  isSuspiciousPartialFetch,
  logKandakatorSyncPreserved,
  type KandakatorSyncSafetyOptions,
} from "@/server/services/kandakator-sync-safety";

export type SyncKandakatorResult = {
  date: string;
  matchCount: number;
  kandakatorId: string | null;
};

const SYNC_COOLDOWN_MS = 2 * 60 * 1000;
const SYNC_COOLDOWN_URGENT_MS = 30 * 1000;
const API_CIRCUIT_FAILURE_THRESHOLD = 2;
const API_CIRCUIT_COOLDOWN_MS = 15 * 60 * 1000;
const lastSyncAtByDate = new Map<string, number>();
const syncInFlight = new Set<string>();
const settlementScheduled = new Set<string>();

const fixtureApiCircuit = {
  consecutiveFailures: 0,
  openUntil: 0,
};

export function isFixtureApiCircuitOpen() {
  return Date.now() < fixtureApiCircuit.openUntil;
}

function recordFixtureApiSuccess() {
  fixtureApiCircuit.consecutiveFailures = 0;
  fixtureApiCircuit.openUntil = 0;
}

function recordFixtureApiFailure(error: unknown) {
  fixtureApiCircuit.consecutiveFailures += 1;
  if (fixtureApiCircuit.consecutiveFailures < API_CIRCUIT_FAILURE_THRESHOLD) return;

  fixtureApiCircuit.openUntil = Date.now() + API_CIRCUIT_COOLDOWN_MS;
  const reason = error instanceof Error ? error.message : String(error);
  console.warn(
    `[Bordin] Fixture API unreachable (${reason}) — runtime kandakator sync paused for ${Math.round(API_CIRCUIT_COOLDOWN_MS / 60_000)} minutes. Push from your PC: npm run push:kandakator:staging`,
  );
}

export function isRuntimeKandakatorSyncEnabled() {
  const flag = process.env.KANDAKATOR_RUNTIME_SYNC?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV === "development";
}

export function isDirectFixtureApiSyncAllowed() {
  return isRuntimeKandakatorSyncEnabled() && isFixtureApiConfigured();
}

export function getPersistedAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") || "";
}

function tehranDayStart(dateKey: string) {
  return kandakatorDateFromKey(dateKey);
}

async function findKandakatorByDateKey(
  tx: Pick<typeof prisma, "dailyKandakator">,
  dateKey: string,
) {
  const start = kandakatorDateFromKey(dateKey);
  const end = addDays(start, 1);
  return tx.dailyKandakator.findFirst({
    where: { date: { gte: start, lt: end } },
  });
}

async function ensurePublishedKandakatorDay(
  tx: Pick<typeof prisma, "dailyKandakator">,
  dateKey: string,
  publish?: boolean,
) {
  const existing = await findKandakatorByDateKey(tx, dateKey);
  const dayDate = tehranDayStart(dateKey);

  if (existing) {
    return tx.dailyKandakator.update({
      where: { id: existing.id },
      data: {
        ...(publish !== undefined ? { isPublished: publish } : { isPublished: true }),
      },
    });
  }

  return tx.dailyKandakator.create({
    data: {
      date: dayDate,
      title: `کنداکتور ${formatShamsiFromDateKey(dateKey)}`,
      isPublished: publish ?? true,
      entryFeeCoins: 600,
    },
  });
}

function normalizeMatch(match: FixtureMatch) {
  const { homeScore, awayScore } = readMatchScore(match);
  const status = mapFixtureStatus(match.status) as MatchStatus;
  const kickoffAt = new Date(match.utcDate);
  if (Number.isNaN(kickoffAt.getTime())) {
    throw new Error(`Invalid kickoff utcDate for match ${match.id}`);
  }
  return translateMatchTeamsToFa({
    externalId: buildFixtureExternalId(match.id),
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    leagueName: match.competition?.name ?? null,
    kickoffAt,
    homeScore,
    awayScore,
    status,
  });
}

export async function syncDailyKandakatorFromApi(
  dateKey: string,
  options?: { publish?: boolean; force?: boolean },
): Promise<SyncKandakatorResult> {
  if (await shouldUseMemoryDb()) {
    throw new Error("همگام‌سازی فقط با دیتابیس واقعی (staging/production) کار می‌کند");
  }
  await enqueueKandakatorSyncDates([dateKey], "legacy-sync-cutover");
  return { date: dateKey, matchCount: 0, kandakatorId: null };
}

async function pruneKandakatorDayLinks(
  tx: Pick<typeof prisma, "dailyKandakator" | "kandakatorMatch">,
  dateKey: string,
  keepMatchIds: string[],
  options?: KandakatorSyncSafetyOptions,
) {
  if (!canDeleteKandakatorData(options)) return null;

  const existing = await findKandakatorByDateKey(tx, dateKey);
  if (!existing) return null;

  if (keepMatchIds.length === 0) {
    await tx.kandakatorMatch.deleteMany({ where: { kandakatorId: existing.id } });
  } else {
    await tx.kandakatorMatch.deleteMany({
      where: { kandakatorId: existing.id, matchId: { notIn: keepMatchIds } },
    });
  }

  return existing.id;
}

async function preserveExistingKandakatorDay(
  dateKey: string,
  reason: "empty_api_response" | "invalid_api_response" | "partial_api_response",
  source: string,
  fetchedCount: number,
): Promise<SyncKandakatorResult> {
  const existing = await findKandakatorByDateKey(prisma, dateKey);
  const preservedCount = existing ? await countKandakatorLinksForDate(dateKey) : 0;

  if (preservedCount > 0) {
    logKandakatorSyncPreserved({
      dateKey,
      reason,
      existingCount: preservedCount,
      fetchedCount,
      source,
    });
  }

  lastSyncAtByDate.set(dateKey, Date.now());
  return {
    date: dateKey,
    matchCount: preservedCount,
    kandakatorId: existing?.id ?? null,
  };
}

async function countKandakatorLinksForDate(dateKey: string) {
  const existing = await findKandakatorByDateKey(prisma, dateKey);
  if (!existing) return 0;
  return prisma.kandakatorMatch.count({ where: { kandakatorId: existing.id } });
}

export async function syncDailyKandakatorFromFootballMatches(
  dateKey: string,
  matches: FixtureMatch[],
  options?: KandakatorSyncSafetyOptions,
): Promise<SyncKandakatorResult> {
  const syncStartedAt = Date.now();
  const source = options?.source ?? "push";
  const sorted = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );

  if (await shouldUseMemoryDb()) {
    const { devMemoryDb } = await import("@/server/dev-memory-db");

    const validApiMatches = sorted.filter((apiMatch) => {
      const kickoffAt = new Date(apiMatch.utcDate);
      return !Number.isNaN(kickoffAt.getTime()) && tehranDateKey(kickoffAt) === dateKey;
    });

    if (validApiMatches.length === 0) {
      const existing = devMemoryDb.kandakator.getByDate(dateKey);
      if (existing && !canDeleteKandakatorData(options)) {
        return {
          date: dateKey,
          matchCount: existing.matches.length,
          kandakatorId: existing.id,
        };
      }
      if (existing && canDeleteKandakatorData(options)) {
        existing.matches = [];
      }
      return {
        date: dateKey,
        matchCount: 0,
        kandakatorId: existing?.id ?? null,
      };
    }

    const apiItems = validApiMatches.map((apiMatch) => {
      const normalized = normalizeMatch(apiMatch);
      return {
        matchId: normalized.externalId,
        homeTeamName: normalized.homeTeamName,
        awayTeamName: normalized.awayTeamName,
        leagueName: normalized.leagueName,
        kickoffAt: normalized.kickoffAt,
        homeScore: normalized.homeScore,
        awayScore: normalized.awayScore,
        status: normalized.status,
      };
    });

    devMemoryDb.kandakator.mergeDayFromApi(dateKey, apiItems);

    for (const km of devMemoryDb.kandakator.getByDate(dateKey)?.matches ?? []) {
      if (isMatchResultKnown(km.match)) {
        await settleMatchPredictions(km.matchId);
      }
    }

    void options;
    lastSyncAtByDate.set(dateKey, Date.now());
    return {
      date: dateKey,
      matchCount: apiItems.length,
      kandakatorId: devMemoryDb.kandakator.getByDate(dateKey)?.id ?? null,
    };
  }

  if (isEmptyApiPayload(sorted.length)) {
    if (!canDeleteKandakatorData(options)) {
      return preserveExistingKandakatorDay(dateKey, "empty_api_response", source, 0);
    }
    const kandakator = await ensurePublishedKandakatorDay(prisma, dateKey, options?.publish);
    await prisma.kandakatorMatch.deleteMany({ where: { kandakatorId: kandakator.id } });
    lastSyncAtByDate.set(dateKey, Date.now());
    return { date: dateKey, matchCount: 0, kandakatorId: kandakator.id };
  }

  const existingCountBeforeSync = await countKandakatorLinksForDate(dateKey);
  if (
    !canDeleteKandakatorData(options) &&
    isSuspiciousPartialFetch(sorted.length, existingCountBeforeSync)
  ) {
    return preserveExistingKandakatorDay(
      dateKey,
      "partial_api_response",
      source,
      sorted.length,
    );
  }

  const finishedMatchIds: string[] = [];
  let syncedCount = 0;

  const kandakatorId = await prisma.$transaction(async (tx) => {
    const existing = await findKandakatorByDateKey(tx, dateKey);

    const validApiMatches = sorted.filter((apiMatch) => {
      const kickoffAt = new Date(apiMatch.utcDate);
      return !Number.isNaN(kickoffAt.getTime()) && tehranDateKey(kickoffAt) === dateKey;
    });

    if (validApiMatches.length === 0) {
      if (!canDeleteKandakatorData(options) && existing) {
        const linkCount = await tx.kandakatorMatch.count({ where: { kandakatorId: existing.id } });
        if (linkCount > 0) {
          syncedCount = linkCount;
          return existing.id;
        }
      }
      const kandakator = await ensurePublishedKandakatorDay(tx, dateKey, options?.publish);
      if (canDeleteKandakatorData(options)) {
        await tx.kandakatorMatch.deleteMany({ where: { kandakatorId: kandakator.id } });
      }
      return kandakator.id;
    }

    const kandakator = await ensurePublishedKandakatorDay(tx, dateKey, options?.publish);

    const syncedMatchIds: string[] = [];
    let sortOrder = 0;
    for (const apiMatch of validApiMatches) {
      const normalized = normalizeMatch(apiMatch);
      const existing = await tx.footballMatch.findUnique({
        where: { externalId: normalized.externalId },
      });
      const status = normalized.status;
      const homeScore =
        status === "FINISHED" &&
        normalized.homeScore !== null &&
        normalized.awayScore !== null
          ? normalized.homeScore
          : (normalized.homeScore ?? existing?.homeScore ?? null);
      const awayScore =
        status === "FINISHED" &&
        normalized.homeScore !== null &&
        normalized.awayScore !== null
          ? normalized.awayScore
          : (normalized.awayScore ?? existing?.awayScore ?? null);

      const scoresChanged =
        existing &&
        (existing.homeScore !== homeScore ||
          existing.awayScore !== awayScore ||
          existing.status !== status);

      if (
        mapFixtureStatus(apiMatch.status) === "FINISHED" &&
        normalized.homeScore === null &&
        normalized.awayScore === null
      ) {
        const apiScores = readApiMatchScore(apiMatch);
        console.warn(
          `[Bordin:sync] FINISHED match without scores from API: ${normalized.externalId}`,
          JSON.stringify({ status: apiMatch.status, score: apiMatch.score, parsed: apiScores }),
        );
      }

      const match = await tx.footballMatch.upsert({
        where: { externalId: normalized.externalId },
        create: {
          ...normalized,
          homeScore,
          awayScore,
          status,
          scoresUpdatedAt:
            homeScore !== null && awayScore !== null ? new Date() : null,
        },
        update: {
          homeTeamName: normalized.homeTeamName,
          awayTeamName: normalized.awayTeamName,
          leagueName: normalized.leagueName,
          kickoffAt: normalized.kickoffAt,
          homeScore,
          awayScore,
          status,
          ...(homeScore !== null && awayScore !== null && scoresChanged
            ? { scoresUpdatedAt: new Date() }
            : {}),
        },
      });

      if (existing && (existing.status !== status || scoresChanged)) {
        void logMatchStatusChange({
          matchId: match.id,
          previousStatus: existing.status,
          newStatus: status,
          homeScore,
          awayScore,
          source,
        });
      }

      syncedMatchIds.push(match.id);

      await tx.kandakatorMatch.upsert({
        where: {
          kandakatorId_matchId: { kandakatorId: kandakator.id, matchId: match.id },
        },
        create: {
          kandakatorId: kandakator.id,
          matchId: match.id,
          sortOrder,
          predictionCutoffMinutes: 5,
        },
        update: { sortOrder, predictionCutoffMinutes: 5 },
      });

      await tx.kandakatorMatch.deleteMany({
        where: { matchId: match.id, kandakatorId: { not: kandakator.id } },
      });

      sortOrder += 1;

      if (isMatchResultKnown(match)) {
        finishedMatchIds.push(match.id);
      }
    }

    if (canDeleteKandakatorData(options)) {
      await pruneKandakatorDayLinks(tx, dateKey, syncedMatchIds, options);
    }
    syncedCount = syncedMatchIds.length;

    return kandakator.id;
  });

  for (const matchId of finishedMatchIds) {
    await settleMatchPredictions(matchId);
  }

  lastSyncAtByDate.set(dateKey, Date.now());
  recordFixtureApiSuccess();

  void recordKandakatorSync({
    scope: `date:${dateKey}`,
    status: syncedCount > 0 ? "success" : "partial",
    source,
    matchCount: syncedCount,
    settledCount: finishedMatchIds.length,
    durationMs: Date.now() - syncStartedAt,
  });

  return { date: dateKey, matchCount: syncedCount, kandakatorId };
}

export async function syncTehranWeekFromApi() {
  const { getTehranWeekDays } = await import("@/server/services/kandakator-service");
  const days = getTehranWeekDays().map((day) => day.date);
  await enqueueKandakatorSyncDates(days, "manual-week-enqueue");
  return days.map((date) => ({ date, matchCount: 0, kandakatorId: null }));
}

type KandakatorWithMatches = {
  matches: Array<{
    match: {
      externalId: string | null;
      status: MatchStatus;
      kickoffAt: Date;
      homeScore: number | null;
      awayScore: number | null;
    };
  }>;
};

function kandakatorNeedsApiRefresh(dateKey: string, existing: KandakatorWithMatches | null) {
  if (!existing || existing.matches.length === 0) return true;

  const hasApiMatches = existing.matches.some((row) => Boolean(row.match.externalId));
  if (!hasApiMatches) return true;

  const now = Date.now();
  const todayKey = tehranDateKey(new Date());

  for (const { match } of existing.matches) {
    if (match.status === "LIVE") return true;
    if (!isMatchResultKnown(match) && match.kickoffAt.getTime() <= now) return true;
  }

  if (dateKey < todayKey) {
    return !existing.matches.every(({ match }) => isMatchResultKnown(match));
  }

  if (dateKey === todayKey) {
    return existing.matches.some(
      ({ match }) => match.status === "LIVE" || (!isMatchResultKnown(match) && match.kickoffAt.getTime() <= now),
    );
  }

  return false;
}

async function loadKandakatorSnapshot(dateKey: string) {
  const dayStart = tehranDayStart(dateKey);
  return prisma.dailyKandakator.findFirst({
    where: {
      date: { gte: dayStart, lt: addDays(dayStart, 1) },
      isPublished: true,
    },
    include: {
      matches: {
        include: {
          match: {
            select: {
              externalId: true,
              status: true,
              kickoffAt: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
      },
    },
  });
}

export async function ensureKandakatorSyncedForDate(
  dateKey: string,
  _options?: { force?: boolean },
) {
  if (await shouldUseMemoryDb()) return;
  await enqueueKandakatorSyncDates([dateKey], "legacy-ensure-cutover");
}

export async function awaitKandakatorScoreRefresh(
  dateKeys: string[],
  options?: { waitForUpdate?: boolean; waitMs?: number },
) {
  if (await shouldUseMemoryDb()) return;

  const unique = [...new Set(dateKeys.filter(Boolean))];
  if (unique.length === 0) return;

  const { awaitStaleScoreRefreshForDates } = await import(
    "@/server/services/kandakator-remote-sync-service"
  );
  await awaitStaleScoreRefreshForDates(unique, {
    waitForUpdate: options?.waitForUpdate ?? false,
    waitMs: options?.waitMs,
  });
}

export function scheduleKandakatorSync(dateKey: string, options?: { force?: boolean }) {
  void ensureKandakatorSyncedForDate(dateKey, options).catch(() => {});
}

export function scheduleKandakatorSettlement(kandakatorId: string) {
  if (settlementScheduled.has(kandakatorId)) return;
  settlementScheduled.add(kandakatorId);
  void (async () => {
    try {
      const { settleKandakatorFinishedMatches } = await import(
        "@/server/services/settlement-service"
      );
      await settleKandakatorFinishedMatches(kandakatorId);
    } finally {
      setTimeout(() => settlementScheduled.delete(kandakatorId), 60_000);
    }
  })();
}

export async function prepareKandakatorForDisplay(dateKey: string) {
  if (await shouldUseMemoryDb()) return;

  const existing = await loadKandakatorSnapshot(dateKey);
  const todayKey = tehranDateKey(new Date());
  const datesToEnqueue = new Set<string>();
  if (!existing?.matches.length) {
    if (!existing) {
      datesToEnqueue.add(dateKey);
    }
  } else {
    const needs = kandakatorNeedsApiRefresh(dateKey, existing);
    if (needs) {
      datesToEnqueue.add(dateKey);
    }
  }

  const yesterdayKey = tehranDateKey(addDays(kandakatorDateFromKey(dateKey), -1));
  if (yesterdayKey < todayKey) {
    datesToEnqueue.add(yesterdayKey);
  }

  if (datesToEnqueue.size > 0) {
    await enqueueKandakatorSyncDates([...datesToEnqueue], "prepare-display");
  }

  const hasSettleable = existing?.matches.some(({ match }) => isMatchResultKnown(match));
  if (hasSettleable && existing) {
    scheduleKandakatorSettlement(existing.id);
  }
}

export async function recoverMissingKandakatorDates(dateKeys: string[]) {
  if (await shouldUseMemoryDb()) return;
  const { runEmergencyKandakatorRecovery } = await import(
    "@/server/services/kandakator-recovery-service"
  );
  return runEmergencyKandakatorRecovery({
    dateKeys,
    waitMs: 120_000,
    source: "recovery",
  });
}
