import {
  countPublishedMatchesForDate,
  ensureKandakatorIngestedForDates,
  getRecentTehranDateKeys,
  hasPublishedKandakatorForDate,
} from "@/server/services/kandakator-display-ingest";
import { runKandakatorSystemAudit } from "@/server/services/kandakator-system-audit";

function shouldSkipForMemoryDb() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true";
}

export type KandakatorRecoveryResult = {
  dateKeys: string[];
  missingBefore: string[];
  matchCountsBefore: Record<string, number>;
  matchCountsAfter: Record<string, number>;
  satisfied: boolean;
  waitedMs: number;
  jobsProcessed: number;
  audit: Awaited<ReturnType<typeof runKandakatorSystemAudit>>;
};

/**
 * Idempotent emergency recovery: enqueue + process missing dates.
 * Never deletes data — only adds/updates via safe sync mode.
 */
export async function runEmergencyKandakatorRecovery(options?: {
  days?: number;
  dateKeys?: string[];
  waitMs?: number;
  source?: string;
  /** When false, enqueue + process queue only; caller polls audit separately. */
  waitForIngest?: boolean;
}): Promise<KandakatorRecoveryResult> {
  const days = options?.days ?? 10;
  const dateKeys = options?.dateKeys?.length
    ? [...new Set(options.dateKeys)]
    : getRecentTehranDateKeys(days);
  const source = options?.source ?? "emergency-recovery";
  const waitMs = options?.waitMs ?? 120_000;
  const waitForIngest = options?.waitForIngest ?? true;

  if (shouldSkipForMemoryDb()) {
    const audit = await runKandakatorSystemAudit();
    return {
      dateKeys,
      missingBefore: dateKeys,
      matchCountsBefore: {},
      matchCountsAfter: {},
      satisfied: false,
      waitedMs: 0,
      jobsProcessed: 0,
      audit,
    };
  }

  const beforeSnapshots = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const [matchCount, hasPublished] = await Promise.all([
        countPublishedMatchesForDate(dateKey),
        hasPublishedKandakatorForDate(dateKey),
      ]);
      return [dateKey, { matchCount, hasPublished }] as const;
    }),
  );
  const matchCountsBefore = Object.fromEntries(
    beforeSnapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.matchCount]),
  );
  const missingBefore = beforeSnapshots
    .filter(([, snapshot]) => snapshot.matchCount === 0 && !snapshot.hasPublished)
    .map(([dateKey]) => dateKey);

  const [{ enqueueKandakatorSyncDatesIfNeeded }, { processKandakatorSyncQueue }] = await Promise.all([
    import("@/server/services/kandakator-sync-queue-service"),
    import("@/server/services/kandakator-sync-queue-processor"),
  ]);

  await enqueueKandakatorSyncDatesIfNeeded(dateKeys, source, { force: true });

  let jobsProcessed = 0;
  const processDeadline = Date.now() + Math.min(waitMs, waitForIngest ? 30_000 : 20_000);
  while (Date.now() < processDeadline) {
    const batch = await processKandakatorSyncQueue(10);
    jobsProcessed += batch.length;
    if (batch.length === 0) break;
  }

  let ingest: Awaited<ReturnType<typeof ensureKandakatorIngestedForDates>>;
  if (waitForIngest) {
    ingest = await ensureKandakatorIngestedForDates(dateKeys, {
      source,
      waitMs,
    });
  } else {
    const afterSnapshots = await Promise.all(
      dateKeys.map(async (dateKey) => {
        const [matchCount, hasPublished] = await Promise.all([
          countPublishedMatchesForDate(dateKey),
          hasPublishedKandakatorForDate(dateKey),
        ]);
        return [dateKey, { matchCount, hasPublished }] as const;
      }),
    );
    const matchCountsAfter = Object.fromEntries(
      afterSnapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.matchCount]),
    );
    const publishedDates = Object.fromEntries(
      afterSnapshots.map(([dateKey, snapshot]) => [dateKey, snapshot.hasPublished]),
    );
    ingest = {
      satisfied: dateKeys.every(
        (dateKey) => publishedDates[dateKey] || (matchCountsAfter[dateKey] ?? 0) > 0,
      ),
      waitedMs: 0,
      matchCounts: matchCountsAfter,
      publishedDates,
    };
  }

  const matchCountsAfter = ingest.matchCounts;
  const audit = await runKandakatorSystemAudit();

  return {
    dateKeys,
    missingBefore,
    matchCountsBefore,
    matchCountsAfter,
    satisfied: ingest.satisfied,
    waitedMs: ingest.waitedMs,
    jobsProcessed,
    audit,
  };
}

export async function shouldRunStartupKandakatorRecovery() {
  if (shouldSkipForMemoryDb()) return false;
  const audit = await runKandakatorSystemAudit();
  return (
    audit.dataLayer.status === "EMPTY" ||
    audit.dataLayer.missingRecords >= 2 ||
    audit.systemStatus === "BROKEN"
  );
}
