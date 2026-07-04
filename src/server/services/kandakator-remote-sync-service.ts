import { addDays } from "date-fns";
import { shouldUseMemoryDb } from "@/server/db";
import { prisma } from "@/shared/lib/prisma";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
import { countStaleMatchesForDate } from "@/server/services/kandakator-reconciliation-service";
import { enqueueKandakatorSyncDates } from "@/server/services/kandakator-sync-queue-service";
import { getPersistedAppBaseUrl } from "@/server/services/kandakator-sync-service";

const DEFAULT_WAIT_MS = 25_000;
const POLL_INTERVAL_MS = 2_000;

export function getCloudflareSyncUrl() {
  return process.env.KANDAKATOR_CF_SYNC_URL?.trim() || "";
}

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

export async function triggerQueuedRemoteSyncJob(input: {
  jobId: string;
  dateKey: string;
  source: string;
}) {
  const url = getCloudflareSyncUrl();
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  const targetBaseUrl = getPersistedAppBaseUrl();
  if (!url || !token || !targetBaseUrl) {
    throw new Error("queued_remote_sync_not_configured");
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jobId: input.jobId,
      date: input.dateKey,
      targetBaseUrl,
      source: input.source,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  const json = (await res.json().catch(() => null)) as
    | {
        success?: boolean;
        fetchedCount?: number;
        matches?: Array<Record<string, unknown>>;
        error?: string;
      }
    | null;

  if (!res.ok || !json?.success) {
    throw new Error(json?.error ?? `remote_job_failed:${res.status}`);
  }

  return {
    fetchedCount: json.fetchedCount ?? 0,
    matches: (json.matches ?? []) as never[],
    synced: { date: input.dateKey, matchCount: json.fetchedCount ?? 0, kandakatorId: null },
  };
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
 * Trigger remote sync and optionally wait until DB stale count decreases.
 * Root-cause fix: production previously fired CF worker and returned stale DB immediately.
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

  // Reads should enqueue and return; queue processor owns retries and write verification.
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
