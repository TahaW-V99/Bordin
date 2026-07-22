import { SyncJobStatus, Prisma } from "@prisma/client";
import { addMinutes } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { recordKandakatorSync } from "@/server/services/kandakator-sync-health";
import { evaluateDateSyncNeed } from "@/server/services/kandakator-sync-policy";

const DEFAULT_MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MINUTES = [1, 3, 10, 30, 60];
const STALE_LOCK_MINUTES = 10;
const ACTIVE_JOB_STATUSES: SyncJobStatus[] = [
  SyncJobStatus.PENDING,
  SyncJobStatus.PROCESSING,
  SyncJobStatus.FAILED,
];

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findActiveSyncJob(dateKey: string) {
  return prisma.kandakatorSyncJob.findFirst({
    where: {
      dateKey,
      status: { in: ACTIVE_JOB_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function createActiveSyncJob(input: EnqueueSyncJobInput) {
  try {
    return await prisma.kandakatorSyncJob.create({
      data: {
        dateKey: input.dateKey,
        activeDateKey: input.dateKey,
        source: input.source,
        requestedBy: input.requestedBy,
        payload: input.payload,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const raced = await findActiveSyncJob(input.dateKey);
    if (raced) {
      console.info("[Bordin:sync-queue]", JSON.stringify({
        event: "dedupe_race",
        dateKey: input.dateKey,
        source: input.source,
        existingJobId: raced.id,
        existingStatus: raced.status,
      }));
      return raced;
    }

    throw error;
  }
}

export type EnqueueSyncJobInput = {
  dateKey: string;
  source: string;
  requestedBy?: string;
  payload?: Prisma.InputJsonValue;
};

export type EnqueueSyncJobIfNeededInput = EnqueueSyncJobInput & {
  force?: boolean;
};

export type EnqueueSyncJobIfNeededResult = {
  dateKey: string;
  enqueued: boolean;
  reason: string;
  job: Awaited<ReturnType<typeof enqueueKandakatorSyncJob>> | null;
};

export async function enqueueKandakatorSyncJob(input: EnqueueSyncJobInput) {
  if (await shouldUseMemoryDb()) {
    return { id: `memory-${input.dateKey}`, dateKey: input.dateKey, status: "PENDING" as const };
  }

  const existing = await findActiveSyncJob(input.dateKey);

  if (existing) {
    if (
      existing.status === SyncJobStatus.FAILED ||
      existing.status === SyncJobStatus.PROCESSING ||
      existing.attemptCount >= existing.maxAttempts
    ) {
      console.info("[Bordin:sync-queue]", JSON.stringify({
        event: "requeue",
        dateKey: input.dateKey,
        source: input.source,
        existingJobId: existing.id,
        previousStatus: existing.status,
        previousAttemptCount: existing.attemptCount,
      }));
      return prisma.kandakatorSyncJob.update({
        where: { id: existing.id },
        data: {
          status: SyncJobStatus.PENDING,
          activeDateKey: input.dateKey,
          attemptCount: 0,
          nextAttemptAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: null,
          source: input.source,
          requestedBy: input.requestedBy,
          payload: input.payload,
        },
      });
    }
    console.info("[Bordin:sync-queue]", JSON.stringify({
      event: "dedupe",
      dateKey: input.dateKey,
      source: input.source,
      existingJobId: existing.id,
      existingStatus: existing.status,
    }));
    return existing;
  }

  console.info("[Bordin:sync-queue]", JSON.stringify({
    event: "enqueue",
    dateKey: input.dateKey,
    source: input.source,
    requestedBy: input.requestedBy ?? null,
  }));
  return createActiveSyncJob(input);
}

export async function enqueueKandakatorSyncDates(
  dateKeys: string[],
  source: string,
  requestedBy?: string,
) {
  const unique = [...new Set(dateKeys.filter(Boolean))];
  const jobs = [];
  for (const dateKey of unique) {
    jobs.push(await enqueueKandakatorSyncJob({ dateKey, source, requestedBy }));
  }
  return jobs;
}

/** Business-aware enqueue — evaluates lifecycle/DB state before writing to the queue. */
export async function enqueueKandakatorSyncJobIfNeeded(
  input: EnqueueSyncJobIfNeededInput,
): Promise<EnqueueSyncJobIfNeededResult> {
  const evaluation = await evaluateDateSyncNeed({
    dateKey: input.dateKey,
    force: input.force,
    source: input.source,
  });

  if (!evaluation.shouldEnqueue) {
    console.info(
      "[Bordin:sync-queue]",
      JSON.stringify({
        event: "enqueue_skipped",
        dateKey: input.dateKey,
        source: input.source,
        reason: evaluation.reason,
      }),
    );
    return {
      dateKey: input.dateKey,
      enqueued: false,
      reason: evaluation.reason,
      job: null,
    };
  }

  const job = await enqueueKandakatorSyncJob({
    dateKey: input.dateKey,
    source: input.source,
    requestedBy: input.requestedBy,
    payload: input.payload,
  });

  return {
    dateKey: input.dateKey,
    enqueued: true,
    reason: evaluation.reason,
    job,
  };
}

export async function enqueueKandakatorSyncDatesIfNeeded(
  dateKeys: string[],
  source: string,
  options?: { requestedBy?: string; force?: boolean },
) {
  const unique = [...new Set(dateKeys.filter(Boolean))];
  const results: EnqueueSyncJobIfNeededResult[] = [];
  for (const dateKey of unique) {
    results.push(
      await enqueueKandakatorSyncJobIfNeeded({
        dateKey,
        source,
        requestedBy: options?.requestedBy,
        force: options?.force,
      }),
    );
  }
  return results;
}

async function releaseStaleLocks() {
  // PENDING/FAILED rows that already burned all attempts can never be claimed
  // (claim requires attemptCount < max). Sweep them to DEAD_LETTER so the
  // unique activeDateKey slot frees and a fresh job can be enqueued.
  await prisma.kandakatorSyncJob.updateMany({
    where: {
      status: { in: [SyncJobStatus.PENDING, SyncJobStatus.FAILED] },
      attemptCount: { gte: DEFAULT_MAX_ATTEMPTS },
    },
    data: {
      status: SyncJobStatus.DEAD_LETTER,
      activeDateKey: null,
      lockedAt: null,
      lockedBy: null,
      lastError: "exhausted_attempts_swept",
    },
  });

  const cutoff = addMinutes(new Date(), -STALE_LOCK_MINUTES);
  await prisma.kandakatorSyncJob.updateMany({
    where: {
      status: SyncJobStatus.PROCESSING,
      lockedAt: { lt: cutoff },
    },
    data: {
      status: SyncJobStatus.FAILED,
      lockedAt: null,
      lockedBy: null,
      lastError: "stale_lock_released",
      nextAttemptAt: new Date(),
    },
  });
}

export async function claimNextKandakatorSyncJob(workerId: string) {
  if (await shouldUseMemoryDb()) return null;

  await releaseStaleLocks();

  const candidate = await prisma.kandakatorSyncJob.findFirst({
    where: {
      status: { in: [SyncJobStatus.PENDING, SyncJobStatus.FAILED] },
      nextAttemptAt: { lte: new Date() },
      attemptCount: { lt: DEFAULT_MAX_ATTEMPTS },
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
  });

  if (!candidate) return null;

  const claimed = await prisma.kandakatorSyncJob.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
      OR: [{ lockedAt: null }, { lockedAt: { lt: addMinutes(new Date(), -STALE_LOCK_MINUTES) } }],
    },
    data: {
      status: SyncJobStatus.PROCESSING,
      lockedAt: new Date(),
      lockedBy: workerId,
      attemptCount: { increment: 1 },
    },
  });

  if (claimed.count === 0) return null;

  const job = await prisma.kandakatorSyncJob.findUnique({ where: { id: candidate.id } });
  if (job) {
    console.info("[Bordin:sync-queue]", JSON.stringify({
      event: "claim",
      jobId: job.id,
      dateKey: job.dateKey,
      workerId,
      attemptCount: job.attemptCount,
    }));
  }
  return job;
}

export async function markKandakatorSyncJobSucceeded(
  jobId: string,
  metadata?: Prisma.InputJsonValue,
) {
  if (await shouldUseMemoryDb()) return;

  await prisma.kandakatorSyncJob.update({
    where: { id: jobId },
    data: {
      status: SyncJobStatus.COMPLETED,
      activeDateKey: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      lastVerifiedAt: new Date(),
      payload: metadata,
    },
  });
  console.info("[Bordin:sync-queue]", JSON.stringify({
    event: "success",
    jobId,
  }));
}

export async function markKandakatorSyncJobWritten(
  jobId: string,
  metadata?: Prisma.InputJsonValue,
) {
  if (await shouldUseMemoryDb()) return;

  await prisma.kandakatorSyncJob.update({
    where: { id: jobId },
    data: {
      lastWrittenAt: new Date(),
      payload: metadata,
    },
  });
  console.info("[Bordin:sync-queue]", JSON.stringify({
    event: "written",
    jobId,
  }));
}

export async function markKandakatorSyncJobFetched(
  jobId: string,
  metadata?: Prisma.InputJsonValue,
) {
  if (await shouldUseMemoryDb()) return;

  await prisma.kandakatorSyncJob.update({
    where: { id: jobId },
    data: {
      lastFetchedAt: new Date(),
      payload: metadata,
    },
  });
  console.info("[Bordin:sync-queue]", JSON.stringify({
    event: "fetched",
    jobId,
  }));
}

export async function markKandakatorSyncJobFailed(jobId: string, errorMessage: string) {
  if (await shouldUseMemoryDb()) return;

  const current = await prisma.kandakatorSyncJob.findUnique({ where: { id: jobId } });
  if (!current) return;

  const exhausted = current.attemptCount >= current.maxAttempts;
  const retryIndex = Math.min(current.attemptCount - 1, RETRY_DELAYS_MINUTES.length - 1);
  const nextAttemptAt = addMinutes(new Date(), RETRY_DELAYS_MINUTES[Math.max(retryIndex, 0)]);

  await prisma.kandakatorSyncJob.update({
    where: { id: jobId },
    data: {
      status: exhausted ? SyncJobStatus.DEAD_LETTER : SyncJobStatus.FAILED,
      activeDateKey: exhausted ? null : current.dateKey,
      lockedAt: null,
      lockedBy: null,
      lastError: errorMessage,
      nextAttemptAt,
    },
  });
  console.warn("[Bordin:sync-queue]", JSON.stringify({
    event: exhausted ? "dead_letter" : "retry_scheduled",
    jobId,
    dateKey: current.dateKey,
    errorMessage,
    attemptCount: current.attemptCount,
    maxAttempts: current.maxAttempts,
    nextAttemptAt: nextAttemptAt.toISOString(),
  }));

  await recordKandakatorSync({
    scope: `queue:${current.dateKey}`,
    status: exhausted ? "failed" : "partial",
    source: current.source,
    errorMessage,
    metadata: {
      jobId,
      attemptCount: current.attemptCount,
      maxAttempts: current.maxAttempts,
      nextAttemptAt: nextAttemptAt.toISOString(),
      deadLetter: exhausted,
    },
  });
}

export async function getOpenKandakatorSyncJobs(dateKeys: string[]) {
  if (await shouldUseMemoryDb()) return [];
  return prisma.kandakatorSyncJob.findMany({
    where: {
      dateKey: { in: dateKeys },
      status: { in: [SyncJobStatus.PENDING, SyncJobStatus.PROCESSING, SyncJobStatus.FAILED] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getKandakatorSyncQueueStats() {
  if (await shouldUseMemoryDb()) {
    return { pending: 0, processing: 0, failed: 0, deadLetter: 0 };
  }

  const [pending, processing, failed, deadLetter] = await Promise.all([
    prisma.kandakatorSyncJob.count({ where: { status: SyncJobStatus.PENDING } }),
    prisma.kandakatorSyncJob.count({ where: { status: SyncJobStatus.PROCESSING } }),
    prisma.kandakatorSyncJob.count({ where: { status: SyncJobStatus.FAILED } }),
    prisma.kandakatorSyncJob.count({ where: { status: SyncJobStatus.DEAD_LETTER } }),
  ]);

  return { pending, processing, failed, deadLetter };
}
