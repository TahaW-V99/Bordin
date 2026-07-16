import { addDays } from "date-fns";
import { shouldUseMemoryDb } from "@/server/db";
import { prisma } from "@/shared/lib/prisma";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { enqueueKandakatorSyncDatesIfNeeded } from "@/server/services/kandakator-sync-queue-service";
import { processKandakatorSyncQueue } from "@/server/services/kandakator-sync-queue-processor";

const DEFAULT_WAIT_MS = 45_000;
const POLL_INTERVAL_MS = 1_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function countPublishedMatchesForDate(dateKey: string) {
  if (await shouldUseMemoryDb()) return 0;

  const dayStart = kandakatorDateFromKey(dateKey);
  const dayEnd = addDays(dayStart, 1);

  return prisma.kandakatorMatch.count({
    where: {
      kandakator: {
        isPublished: true,
        date: { gte: dayStart, lt: dayEnd },
      },
    },
  });
}

export async function hasPublishedKandakatorForDate(dateKey: string) {
  if (await shouldUseMemoryDb()) return false;

  const dayStart = kandakatorDateFromKey(dateKey);
  const dayEnd = addDays(dayStart, 1);

  const row = await prisma.dailyKandakator.findFirst({
    where: {
      isPublished: true,
      date: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });

  return Boolean(row);
}

export function getRecentTehranDateKeys(days = 7) {
  const todayKey = tehranDateKey(new Date());
  const today = kandakatorDateFromKey(todayKey);
  return Array.from({ length: days }, (_, index) =>
    tehranDateKey(addDays(today, index - (days - 1))),
  );
}

export type EnsureIngestResult = {
  satisfied: boolean;
  waitedMs: number;
  matchCounts: Record<string, number>;
  publishedDates: Record<string, boolean>;
};

/**
 * Enqueue and actively process sync jobs until target dates have conductor data
 * or the wait budget expires. Prevents empty UI while the background scheduler catches up.
 */
export async function ensureKandakatorIngestedForDates(
  dateKeys: string[],
  options?: { waitMs?: number; source?: string },
): Promise<EnsureIngestResult> {
  const unique = [...new Set(dateKeys.filter(Boolean))];
  const startedAt = Date.now();
  const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS;

  if (unique.length === 0 || (await shouldUseMemoryDb())) {
    return { satisfied: true, waitedMs: 0, matchCounts: {}, publishedDates: {} };
  }

  try {
    await enqueueKandakatorSyncDatesIfNeeded(unique, options?.source ?? "display-ingest");
  } catch (error) {
    console.error("[Bordin:display-ingest] enqueue failed:", error);
  }

  const deadline = startedAt + waitMs;
  let matchCounts: Record<string, number> = {};
  let publishedDates: Record<string, boolean> = {};

  while (Date.now() < deadline) {
    const snapshots = await Promise.all(
      unique.map(async (dateKey) => {
        const [matchCount, hasPublished] = await Promise.all([
          countPublishedMatchesForDate(dateKey),
          hasPublishedKandakatorForDate(dateKey),
        ]);
        return [dateKey, { matchCount, hasPublished }] as const;
      }),
    );

    matchCounts = Object.fromEntries(
      snapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.matchCount]),
    );
    publishedDates = Object.fromEntries(
      snapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.hasPublished]),
    );

    if (unique.every((dateKey) => publishedDates[dateKey] || (matchCounts[dateKey] ?? 0) > 0)) {
      return {
        satisfied: true,
        waitedMs: Date.now() - startedAt,
        matchCounts,
        publishedDates,
      };
    }

    try {
      await processKandakatorSyncQueue(6);
    } catch (error) {
      console.error("[Bordin:display-ingest] queue process failed:", error);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const finalSnapshots = await Promise.all(
    unique.map(async (dateKey) => {
      const [matchCount, hasPublished] = await Promise.all([
        countPublishedMatchesForDate(dateKey),
        hasPublishedKandakatorForDate(dateKey),
      ]);
      return [dateKey, { matchCount, hasPublished }] as const;
    }),
  );

  matchCounts = Object.fromEntries(
    finalSnapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.matchCount]),
  );
  publishedDates = Object.fromEntries(
    finalSnapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.hasPublished]),
  );

  return {
    satisfied: unique.every((dateKey) => publishedDates[dateKey] || (matchCounts[dateKey] ?? 0) > 0),
    waitedMs: Date.now() - startedAt,
    matchCounts,
    publishedDates,
  };
}
