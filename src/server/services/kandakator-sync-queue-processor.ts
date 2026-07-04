import { addDays } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { recordKandakatorSync } from "@/server/services/kandakator-sync-health";
import {
  claimNextKandakatorSyncJob,
  markKandakatorSyncJobFailed,
  markKandakatorSyncJobFetched,
  markKandakatorSyncJobSucceeded,
  markKandakatorSyncJobWritten,
} from "@/server/services/kandakator-sync-queue-service";
import {
  getCloudflareSyncUrl,
  triggerQueuedRemoteSyncJob,
} from "@/server/services/kandakator-remote-sync-service";
import {
  isDirectFootballApiSyncAllowed,
  syncDailyKandakatorFromFootballMatches,
} from "@/server/services/kandakator-sync-service";
import {
  fetchMatchesForTehranDate,
  isFootballDataConfigured,
  type FootballDataMatch,
} from "@/server/services/football-data-api";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
import {
  isEmptyApiPayload,
  isSuspiciousPartialFetch,
} from "@/server/services/kandakator-sync-safety";
import { countPublishedMatchesForDate } from "@/server/services/kandakator-display-ingest";

const PROCESSOR_ID = `kandakator-sync-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function isEmergencyDirectSyncAllowed() {
  const flag = process.env.KANDAKATOR_SYNC_EMERGENCY_DIRECT?.trim().toLowerCase();
  return (flag === "true" || flag === "1") && isFootballDataConfigured();
}

export async function verifyPersistedKandakatorWrite(dateKey: string, expectedCount: number) {
  if (await shouldUseMemoryDb()) return true;

  const dayStart = kandakatorDateFromKey(dateKey);
  const row = await prisma.dailyKandakator.findFirst({
    where: { date: { gte: dayStart, lt: addDays(dayStart, 1) } },
    include: {
      matches: {
        include: {
          match: {
            select: { externalId: true, kickoffAt: true },
          },
        },
      },
    },
  });

  const persistedCount =
    row?.matches.filter((item) => item.match.externalId?.startsWith("football-data-")).length ?? 0;

  if (expectedCount === 0) return persistedCount === 0 || persistedCount > 0;
  return persistedCount >= expectedCount;
}

async function fetchMatchesDirect(dateKey: string) {
  const matches = await fetchMatchesForTehranDate(dateKey, { noCache: true });
  return {
    fetchedCount: matches.length,
    matches,
    source: "direct" as const,
  };
}

async function runRemoteJob(dateKey: string, jobId: string) {
  const workerUrl = getCloudflareSyncUrl();

  if (!workerUrl) {
    if (isDirectFootballApiSyncAllowed() || isEmergencyDirectSyncAllowed()) {
      console.info("[Bordin:sync-queue]", JSON.stringify({
        event: "direct_fetch",
        jobId,
        dateKey,
      }));
      const direct = await fetchMatchesDirect(dateKey);
      return { ...direct, synced: { date: dateKey, matchCount: 0, kandakatorId: null as string | null } };
    }
    if (process.env.NODE_ENV !== "development") {
      throw new Error("remote_worker_not_configured");
    }
    const direct = await fetchMatchesDirect(dateKey);
    return { ...direct, synced: { date: dateKey, matchCount: 0, kandakatorId: null as string | null } };
  }

  console.info("[Bordin:sync-queue]", JSON.stringify({
    event: "remote_fetch_start",
    jobId,
    dateKey,
    workerUrl,
  }));

  try {
    return await triggerQueuedRemoteSyncJob({
      jobId,
      dateKey,
      source: "queue-remote",
    });
  } catch (error) {
    if (isEmergencyDirectSyncAllowed() || isDirectFootballApiSyncAllowed()) {
      console.warn(
        `[Bordin:sync-queue] remote fetch failed for ${dateKey}, falling back to direct API`,
        error instanceof Error ? error.message : error,
      );
      const direct = await fetchMatchesDirect(dateKey);
      return { ...direct, synced: { date: dateKey, matchCount: 0, kandakatorId: null as string | null } };
    }
    throw error;
  }
}

export async function processOneKandakatorSyncJob() {
  if (await shouldUseMemoryDb()) return null;

  const job = await claimNextKandakatorSyncJob(PROCESSOR_ID);
  if (!job) return null;

  const startedAt = Date.now();

  try {
    const runResult = await runRemoteJob(job.dateKey, job.id);
    const fetchSource = getCloudflareSyncUrl() ? "remote" : "direct";

    await markKandakatorSyncJobFetched(job.id, {
      dateKey: job.dateKey,
      fetchedCount: runResult.fetchedCount,
      source: fetchSource,
    });

    const existingCount = await countPublishedMatchesForDate(job.dateKey);
    let persistedCount = existingCount;
    let kandakatorId: string | null = null;

    if (
      isEmptyApiPayload(runResult.matches.length) ||
      isSuspiciousPartialFetch(runResult.fetchedCount, existingCount)
    ) {
      if (existingCount > 0) {
        console.warn(
          `[Bordin:sync-queue] unsafe fetch for ${job.dateKey} — preserving ${existingCount} existing matches`,
          JSON.stringify({ fetchedCount: runResult.fetchedCount }),
        );
      } else if (runResult.matches.length > 0) {
        const synced = await syncDailyKandakatorFromFootballMatches(
          job.dateKey,
          runResult.matches as FootballDataMatch[],
          {
            publish: true,
            source: `queue:${fetchSource}-write`,
          },
        );
        persistedCount = synced.matchCount;
        kandakatorId = synced.kandakatorId;
      }
    } else {
      const synced = await syncDailyKandakatorFromFootballMatches(
        job.dateKey,
        runResult.matches as FootballDataMatch[],
        {
          publish: true,
          source: `queue:${fetchSource}-write`,
        },
      );
      persistedCount = synced.matchCount;
      kandakatorId = synced.kandakatorId;
    }

    await markKandakatorSyncJobWritten(job.id, {
      dateKey: job.dateKey,
      matchCount: persistedCount,
      kandakatorId,
      preservedExisting: runResult.matches.length === 0 && existingCount > 0,
    });

    const verified = await verifyPersistedKandakatorWrite(job.dateKey, persistedCount);
    if (!verified && persistedCount > 0) {
      throw new Error("db_write_verification_failed");
    }

    await markKandakatorSyncJobSucceeded(job.id, {
      dateKey: job.dateKey,
      matchCount: persistedCount,
      durationMs: Date.now() - startedAt,
    });

    await recordKandakatorSync({
      scope: `queue:${job.dateKey}`,
      status: "success",
      source: `queue-${fetchSource}`,
      matchCount: persistedCount,
      durationMs: Date.now() - startedAt,
      metadata: {
        jobId: job.id,
        fetchedCount: runResult.fetchedCount,
        verified: true,
        preservedExisting: runResult.matches.length === 0 && existingCount > 0,
      },
    });

    console.info("[Bordin:sync-queue]", JSON.stringify({
      event: "job_complete",
      jobId: job.id,
      dateKey: job.dateKey,
      fetchedCount: runResult.fetchedCount,
      persistedCount,
      durationMs: Date.now() - startedAt,
    }));
    return { jobId: job.id, dateKey: job.dateKey, status: "success" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Bordin:sync-queue]", JSON.stringify({
      event: "job_failed",
      jobId: job.id,
      dateKey: job.dateKey,
      error: message,
      durationMs: Date.now() - startedAt,
    }));
    await markKandakatorSyncJobFailed(job.id, message);
    return { jobId: job.id, dateKey: job.dateKey, status: "failed" as const, error: message };
  }
}

export async function processKandakatorSyncQueue(batchSize = 3) {
  const results = [];
  for (let i = 0; i < batchSize; i++) {
    const result = await processOneKandakatorSyncJob();
    if (!result) break;
    results.push(result);
  }
  return results;
}
