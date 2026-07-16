import { SyncJobStatus } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";

export type DeadLetterDiagnostics = {
  totalDeadLetter: number;
  deadLetterMarkedLast24h: number;
  deadLetterCreatedLast24h: number;
  newestDeadLetterJob: {
    id: string;
    source: string;
    dateKey: string;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
    attemptCount: number;
    maxAttempts: number;
  } | null;
  oldestDeadLetterByCreatedAt: {
    id: string;
    source: string;
    dateKey: string;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
    attemptCount: number;
  } | null;
  top10DeadLetterReasons: Array<{ reason: string | null; count: number }>;
  queueStatsQueryMs: number;
};

export async function getDeadLetterDiagnostics(): Promise<DeadLetterDiagnostics | null> {
  if (await shouldUseMemoryDb()) return null;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const statsStarted = Date.now();

  const [
    totalDeadLetter,
    deadLetterMarkedLast24h,
    deadLetterCreatedLast24h,
    newest,
    oldest,
    top10Raw,
  ] = await Promise.all([
    prisma.kandakatorSyncJob.count({ where: { status: SyncJobStatus.DEAD_LETTER } }),
    prisma.kandakatorSyncJob.count({
      where: { status: SyncJobStatus.DEAD_LETTER, updatedAt: { gte: since24h } },
    }),
    prisma.kandakatorSyncJob.count({
      where: { status: SyncJobStatus.DEAD_LETTER, createdAt: { gte: since24h } },
    }),
    prisma.kandakatorSyncJob.findFirst({
      where: { status: SyncJobStatus.DEAD_LETTER },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        source: true,
        dateKey: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        attemptCount: true,
        maxAttempts: true,
      },
    }),
    prisma.kandakatorSyncJob.findFirst({
      where: { status: SyncJobStatus.DEAD_LETTER },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        source: true,
        dateKey: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
        attemptCount: true,
      },
    }),
    prisma.$queryRaw<Array<{ reason: string | null; count: bigint }>>`
      SELECT lastError AS reason, COUNT(*) AS count
      FROM kandakator_sync_jobs
      WHERE status = 'DEAD_LETTER'
      GROUP BY lastError
      ORDER BY count DESC
      LIMIT 10
    `,
  ]);

  const queueStatsQueryMs = Date.now() - statsStarted;

  return {
    totalDeadLetter,
    deadLetterMarkedLast24h,
    deadLetterCreatedLast24h,
    newestDeadLetterJob: newest
      ? {
          ...newest,
          createdAt: newest.createdAt.toISOString(),
          updatedAt: newest.updatedAt.toISOString(),
        }
      : null,
    oldestDeadLetterByCreatedAt: oldest
      ? {
          ...oldest,
          createdAt: oldest.createdAt.toISOString(),
          updatedAt: oldest.updatedAt.toISOString(),
        }
      : null,
    top10DeadLetterReasons: top10Raw.map((row) => ({
      reason: row.reason,
      count: Number(row.count),
    })),
    queueStatsQueryMs,
  };
}
