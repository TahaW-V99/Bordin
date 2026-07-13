import { addDays } from "date-fns";
import { shouldUseMemoryDb } from "@/server/db";
import { prisma } from "@/shared/lib/prisma";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
import { countStaleMatchesForDate } from "@/server/services/kandakator-reconciliation-service";
import { enqueueKandakatorSyncDates } from "@/server/services/kandakator-sync-queue-service";

const DEFAULT_WAIT_MS = 25_000;
const POLL_INTERVAL_MS = 2_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasStaleScoresForDates(dateKeys: string[]): Promise<boolean> {
  if (dateKeys.length === 0) return false;

  for (const dateKey of dateKeys) {
    const stale = await countStaleMatchesForDate(dateKey);
    if (stale > 0) return true;
  }

  return false;
}

async function hasMissingKandakatorForDates(dateKeys: string[]): Promise<boolean> {
  if (dateKeys.length === 0) return false;

  for (const dateKey of dateKeys) {
    const dayStart = kandakatorDateFromKey(dateKey);
    const dayEnd = addDays(dayStart, 1);

    const published = await prisma.dailyKandakator.findFirst({
      where: {
        isPublished: true,
        date: { gte: dayStart, lt: dayEnd },
        matches: { some: {} },
      },
      select: { id: true },
    });

    if (!published) return true;
  }

  return false;
}

export type StaleScoreRefreshResult = {
  refreshed: boolean;
  waited: boolean;
  reason?: string;
  durationMs?: number;
};

/**
 * Enqueue sync jobs and optionally wait until DB stale count decreases.
 */
export async function awaitStaleScoreRefreshForDates(
  dateKeys: string[],
  options?: { waitForUpdate?: boolean; waitMs?: number },
): Promise<StaleScoreRefreshResult> {
  if (await shouldUseMemoryDb()) {
    return { refreshed: true, waited: false };
  }

  const unique = [...new Set(dateKeys.filter(Boolean))];
  if (unique.length === 0) return { refreshed: true, waited: false };

  const startedAt = Date.now();
  const [staleBefore, missingBefore] = await Promise.all([
    hasStaleScoresForDates(unique),
    hasMissingKandakatorForDates(unique),
  ]);

  if (!staleBefore && !missingBefore) {
    return { refreshed: true, waited: false, durationMs: Date.now() - startedAt };
  }

  await enqueueKandakatorSyncDates(unique, "stale-read");

  if (!options?.waitForUpdate) {
    return {
      refreshed: false,
      waited: false,
      reason: "queued",
      durationMs: Date.now() - startedAt,
    };
  }

  const deadline = Date.now() + Math.min(options.waitMs ?? DEFAULT_WAIT_MS, 8_000);
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const [stillStale, stillMissing] = await Promise.all([
      hasStaleScoresForDates(unique),
      hasMissingKandakatorForDates(unique),
    ]);
    if (!stillStale && !stillMissing) {
      return {
        refreshed: true,
        waited: true,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  return {
    refreshed: false,
    waited: true,
    reason: "queued",
    durationMs: Date.now() - startedAt,
  };
}

export async function staleMatchesNeedRemoteSync() {
  if (await shouldUseMemoryDb()) return false;

  const staleCount = await prisma.footballMatch.count({
    where: {
      kickoffAt: { lte: new Date() },
      homeScore: null,
      predictions: { some: { scoredAt: null } },
    },
  });

  return staleCount > 0;
}
