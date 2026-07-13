import { addMinutes } from "date-fns";
import { SyncJobStatus } from "@prisma/client";
import { shouldUseMemoryDb } from "@/server/db";
import { prisma } from "@/shared/lib/prisma";
import { getKandakatorSyncHealth } from "@/server/services/kandakator-sync-health";
import { getKandakatorSyncQueueStats } from "@/server/services/kandakator-sync-queue-service";
import {
  countPublishedMatchesForDate,
  getRecentTehranDateKeys,
  hasPublishedKandakatorForDate,
} from "@/server/services/kandakator-display-ingest";
import { isFixtureApiConfigured } from "@/server/services/fixture-api";

export type KandakatorSystemAudit = {
  systemStatus: "HEALTHY" | "DEGRADED" | "BROKEN";
  dataLayer: {
    status: "OK" | "EMPTY" | "PARTIAL";
    lastSevenDays: Array<{
      dateKey: string;
      matchCount: number;
      hasKandakator: boolean;
    }>;
    missingRecords: number;
    missingReason?: string;
  };
  queueLayer: {
    status: "ACTIVE" | "INACTIVE" | "STUCK";
    stats: Awaited<ReturnType<typeof getKandakatorSyncQueueStats>>;
    completedLastHour: number;
    stuckProcessing: number;
    oldestPendingMinutes: number | null;
  };
  fixtureApiLayer: {
    status: "CONFIGURED" | "NOT_CONFIGURED";
    fixtureApiConfigured: boolean;
    recentFailures: Array<{ dateKey: string; error: string; at: string }>;
  };
  ingestionLayer: {
    status: "SUCCESS" | "FAILING" | "UNKNOWN";
    lastSuccessfulSyncAt: string | null;
    lastFailedSyncAt: string | null;
  };
  legacyArtifacts: {
    present: boolean;
    evidence: string[];
  };
  rootCause?: string;
  recommendedFix?: string;
};

export async function runKandakatorSystemAudit(): Promise<KandakatorSystemAudit> {
  if (await shouldUseMemoryDb()) {
    return {
      systemStatus: "DEGRADED",
      dataLayer: { status: "EMPTY", lastSevenDays: [], missingRecords: 7, missingReason: "memory_db" },
      queueLayer: {
        status: "INACTIVE",
        stats: { pending: 0, processing: 0, failed: 0, deadLetter: 0 },
        completedLastHour: 0,
        stuckProcessing: 0,
        oldestPendingMinutes: null,
      },
      fixtureApiLayer: { status: "NOT_CONFIGURED", fixtureApiConfigured: false, recentFailures: [] },
      ingestionLayer: { status: "UNKNOWN", lastSuccessfulSyncAt: null, lastFailedSyncAt: null },
      legacyArtifacts: { present: false, evidence: [] },
      rootCause: "Running against in-memory database",
      recommendedFix: "Connect to staging/production database",
    };
  }

  const dateKeys = getRecentTehranDateKeys(7);
  const lastSevenDays = await Promise.all(
    dateKeys.map(async (dateKey) => {
      const [matchCount, hasKandakator] = await Promise.all([
        countPublishedMatchesForDate(dateKey),
        hasPublishedKandakatorForDate(dateKey),
      ]);
      return {
        dateKey,
        matchCount,
        hasKandakator,
      };
    }),
  );

  const missingRecords = lastSevenDays.filter((row) => row.matchCount === 0 && !row.hasKandakator).length;
  let dataStatus: "OK" | "EMPTY" | "PARTIAL" = "OK";
  if (missingRecords === lastSevenDays.length) dataStatus = "EMPTY";
  else if (missingRecords > 0) dataStatus = "PARTIAL";

  const queueStats = await getKandakatorSyncQueueStats();
  const oneHourAgo = addMinutes(new Date(), -60);
  const tenMinutesAgo = addMinutes(new Date(), -10);

  const [completedLastHour, stuckProcessing, oldestPending, recentFailedJobs] = await Promise.all([
    prisma.kandakatorSyncJob.count({
      where: { status: SyncJobStatus.COMPLETED, updatedAt: { gte: oneHourAgo } },
    }),
    prisma.kandakatorSyncJob.count({
      where: { status: SyncJobStatus.PROCESSING, lockedAt: { lt: tenMinutesAgo } },
    }),
    prisma.kandakatorSyncJob.findFirst({
      where: { status: SyncJobStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.kandakatorSyncJob.findMany({
      where: { status: { in: [SyncJobStatus.FAILED, SyncJobStatus.DEAD_LETTER] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { dateKey: true, lastError: true, updatedAt: true },
    }),
  ]);

  let queueStatus: "ACTIVE" | "INACTIVE" | "STUCK" = "ACTIVE";
  if (completedLastHour === 0 && queueStats.pending + queueStats.processing === 0) {
    queueStatus = "INACTIVE";
  } else if (stuckProcessing > 0 || queueStats.processing > 3) {
    queueStatus = "STUCK";
  }

  const health = await getKandakatorSyncHealth();
  const fixtureApiConfigured = isFixtureApiConfigured();

  const fixtureApiStatus: "CONFIGURED" | "NOT_CONFIGURED" = fixtureApiConfigured
    ? "CONFIGURED"
    : "NOT_CONFIGURED";

  let ingestionStatus: "SUCCESS" | "FAILING" | "UNKNOWN" = "UNKNOWN";
  if (health.lastSuccess && (!health.lastFailure || health.lastSuccess.createdAt > health.lastFailure.createdAt)) {
    ingestionStatus = "SUCCESS";
  } else if (health.lastFailure) {
    ingestionStatus = "FAILING";
  }

  const legacyEvidence: string[] = [];
  if (health.lastFailure?.errorMessage?.includes("fixture_api_not_configured")) {
    legacyEvidence.push("fixture API not configured in last failure");
  }
  if (health.lastFailure?.errorMessage?.includes("fetch_failed")) {
    legacyEvidence.push("fetch_failed in last failure");
  }

  let systemStatus: "HEALTHY" | "DEGRADED" | "BROKEN" = "HEALTHY";
  if (dataStatus === "EMPTY" || (dataStatus === "PARTIAL" && missingRecords >= 3)) {
    systemStatus = "BROKEN";
  } else if (
    dataStatus === "PARTIAL" ||
    queueStatus !== "ACTIVE" ||
    ingestionStatus === "FAILING" ||
    health.staleMatchCount > 0
  ) {
    systemStatus = "DEGRADED";
  }

  let rootCause: string | undefined;
  let recommendedFix: string | undefined;

  if (dataStatus === "EMPTY" || missingRecords >= 3) {
    if (!fixtureApiConfigured) {
      rootCause = "FIXTURE_API_KEY not configured — server cannot fetch fixtures";
      recommendedFix = "Set FIXTURE_API_KEY and KANDAKATOR_RUNTIME_SYNC=true, then POST /api/internal/kandakator/recover";
    } else if (queueStats.deadLetter > 0 || recentFailedJobs.some((j) => j.lastError?.includes("fixture_api"))) {
      rootCause = "Queue jobs failing against Fixture API";
      recommendedFix = "Verify FIXTURE_API_KEY and call POST /api/internal/kandakator/recover";
    } else if (completedLastHour === 0) {
      rootCause = "Queue scheduler not processing jobs (instrumentation or stuck queue)";
      recommendedFix = "Redeploy app and call /api/internal/kandakator/recover with process=true";
    } else {
      rootCause = "Ingestion pipeline not writing matches for recent dates";
      recommendedFix = "POST /api/internal/kandakator/recover and verify kandakator_sync_jobs table exists (db:push)";
    }
  }

  return {
    systemStatus,
    dataLayer: {
      status: dataStatus,
      lastSevenDays,
      missingRecords,
      missingReason:
        missingRecords > 0 ? "No published kandakator matches for one or more recent Tehran dates" : undefined,
    },
    queueLayer: {
      status: queueStatus,
      stats: queueStats,
      completedLastHour,
      stuckProcessing,
      oldestPendingMinutes: oldestPending
        ? Math.round((Date.now() - oldestPending.createdAt.getTime()) / 60_000)
        : null,
    },
    fixtureApiLayer: {
      status: fixtureApiStatus,
      fixtureApiConfigured,
      recentFailures: recentFailedJobs.map((job) => ({
        dateKey: job.dateKey,
        error: job.lastError ?? "unknown",
        at: job.updatedAt.toISOString(),
      })),
    },
    ingestionLayer: {
      status: ingestionStatus,
      lastSuccessfulSyncAt: health.lastSuccess?.createdAt.toISOString() ?? null,
      lastFailedSyncAt: health.lastFailure?.createdAt.toISOString() ?? null,
    },
    legacyArtifacts: {
      present: legacyEvidence.length > 0,
      evidence: legacyEvidence,
    },
    rootCause,
    recommendedFix,
  };
}
