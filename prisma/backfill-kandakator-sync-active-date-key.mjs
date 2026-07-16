/**
 * Prepare kandakator_sync_jobs for activeDateKey unique index.
 *
 * Run on Liara AFTER `npx prisma db push` adds the activeDateKey column:
 *   liara shell --app bordin --command "node prisma/backfill-kandakator-sync-active-date-key.mjs"
 *
 * Safe to re-run. Read-only reporting + idempotent backfill/dedupe.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

const ACTIVE_STATUSES = ["PENDING", "PROCESSING", "FAILED"];

async function main() {
  const prisma = createPrisma();

  try {
    const totalRows = await prisma.kandakatorSyncJob.count();
    const activeRows = await prisma.kandakatorSyncJob.count({
      where: { status: { in: ACTIVE_STATUSES } },
    });

    const duplicateGroups = await prisma.$queryRaw`
      SELECT dateKey, COUNT(*) AS cnt
      FROM kandakator_sync_jobs
      WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
      GROUP BY dateKey
      HAVING COUNT(*) > 1
    `;

    console.log(
      JSON.stringify(
        {
          event: "backfill_active_date_key_report",
          totalRows,
          activeRows,
          duplicateActiveDateKeys: duplicateGroups.length,
        },
        null,
        2,
      ),
    );

    for (const group of duplicateGroups) {
      const dateKey = group.dateKey;
      const jobs = await prisma.kandakatorSyncJob.findMany({
        where: {
          dateKey,
          status: { in: ACTIVE_STATUSES },
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      });

      const [keeper, ...extras] = jobs;
      if (!keeper) continue;

      for (const extra of extras) {
        await prisma.kandakatorSyncJob.update({
          where: { id: extra.id },
          data: {
            status: "DEAD_LETTER",
            activeDateKey: null,
            lockedAt: null,
            lockedBy: null,
            lastError: "deduped_before_active_date_key_migration",
          },
        });
      }

      await prisma.kandakatorSyncJob.update({
        where: { id: keeper.id },
        data: { activeDateKey: dateKey },
      });

      console.log(
        JSON.stringify({
          event: "deduped_active_date_key",
          dateKey,
          keptJobId: keeper.id,
          removedCount: extras.length,
        }),
      );
    }

    const backfilled = await prisma.$executeRaw`
      UPDATE kandakator_sync_jobs
      SET activeDateKey = dateKey
      WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
        AND activeDateKey IS NULL
    `;

    const cleared = await prisma.$executeRaw`
      UPDATE kandakator_sync_jobs
      SET activeDateKey = NULL
      WHERE status IN ('COMPLETED', 'DEAD_LETTER')
        AND activeDateKey IS NOT NULL
    `;

    const remainingDuplicates = await prisma.$queryRaw`
      SELECT dateKey, COUNT(*) AS cnt
      FROM kandakator_sync_jobs
      WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
        AND activeDateKey IS NOT NULL
      GROUP BY activeDateKey
      HAVING COUNT(*) > 1
    `;

    console.log(
      JSON.stringify(
        {
          event: "backfill_active_date_key_done",
          backfilledActiveRows: Number(backfilled),
          clearedTerminalRows: Number(cleared),
          remainingActiveDuplicates: remainingDuplicates.length,
        },
        null,
        2,
      ),
    );

    if (remainingDuplicates.length > 0) {
      console.error("Remaining active duplicates detected — resolve before adding unique index.");
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
