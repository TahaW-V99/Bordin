import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is not configured");
  process.exit(1);
}

const parsedUrl = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: parsedUrl.pathname.replace(/^\//, ""),
});
const p = new PrismaClient({ adapter });

const s24 = new Date(Date.now() - 86400000);

async function main() {
  const newest = await p.kandakatorSyncJob.findFirst({
    where: { status: "DEAD_LETTER" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      source: true,
      dateKey: true,
      lastError: true,
      createdAt: true,
      attemptCount: true,
    },
  });

  const deadLetterCreated24h = await p.kandakatorSyncJob.count({
    where: { status: "DEAD_LETTER", createdAt: { gte: s24 } },
  });

  const oldestByCreatedAt = await p.kandakatorSyncJob.findFirst({
    where: { status: "DEAD_LETTER" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });

  const top10Raw = await p.$queryRaw`
    SELECT lastError AS reason, COUNT(*) AS count
    FROM kandakator_sync_jobs
    WHERE status = 'DEAD_LETTER'
    GROUP BY lastError
    ORDER BY count DESC
    LIMIT 10
  `;

  const total = await p.kandakatorSyncJob.count({ where: { status: "DEAD_LETTER" } });

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        database: "production (Liara internal DATABASE_URL)",
        totalDeadLetter: total,
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
        deadLetterCreatedLast24h: deadLetterCreated24h,
        top10DeadLetterReasons: top10Raw.map((r) => ({
          lastError: r.reason,
          count: Number(r.count),
        })),
        oldestDeadLetterCreatedAt: oldestByCreatedAt?.createdAt.toISOString() ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
