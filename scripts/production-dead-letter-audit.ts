/**
 * Read-only dead-letter audit against DATABASE_URL (production when using .env.production.local).
 * Usage: npx dotenv -e .env.production.local -- npx tsx scripts/production-dead-letter-audit.ts
 */
import { SyncJobStatus } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function main() {
  const [
    totalDeadLetter,
    deadLetterCreatedLast24h,
    newest,
    oldest,
    top10Raw,
  ] = await Promise.all([
    prisma.kandakatorSyncJob.count({ where: { status: SyncJobStatus.DEAD_LETTER } }),
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
        attemptCount: true,
      },
    }),
    prisma.kandakatorSyncJob.findFirst({
      where: { status: SyncJobStatus.DEAD_LETTER },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
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

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        database: "production (via DATABASE_URL)",
        totalDeadLetter,
        newestDeadLetterJob: newest
          ? {
              id: newest.id,
              source: newest.source,
              dateKey: newest.dateKey,
              lastError: newest.lastError,
              createdAt: newest.createdAt.toISOString(),
              attemptCount: newest.attemptCount,
            }
          : null,
        deadLetterCreatedLast24h,
        top10DeadLetterReasons: top10Raw.map((row) => ({
          lastError: row.reason,
          count: Number(row.count),
        })),
        oldestDeadLetterCreatedAt: oldest?.createdAt.toISOString() ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("AUDIT_ERROR", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
