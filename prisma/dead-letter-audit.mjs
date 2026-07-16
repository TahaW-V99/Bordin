const { PrismaClient } = require("@prisma/client");

const p = new PrismaClient();
const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

function bucketError(msg) {
  if (!msg) return "(null)";
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("request limit")) return "rate_limit";
  if (m.includes("fixture_api_not_configured")) return "fixture_api_not_configured";
  if (m.includes("fetch failed") || m.includes("اتصال")) return "network_error";
  if (m.includes("db_write_verification_failed")) return "db_write_verification_failed";
  if (m.includes("stale_lock")) return "stale_lock";
  if (m.includes("401") || m.includes("403") || m.includes("unauthorized")) return "auth_error";
  return msg.slice(0, 120);
}

async function main() {
  const [
    totalDeadLetter,
    deadLetter24h,
    deadLetter7d,
    oldestDeadLetter,
    newestDeadLetter,
    failed24h,
    pendingNow,
    processingNow,
  ] = await Promise.all([
    p.kandakatorSyncJob.count({ where: { status: "DEAD_LETTER" } }),
    p.kandakatorSyncJob.count({
      where: { status: "DEAD_LETTER", updatedAt: { gte: since24h } },
    }),
    p.kandakatorSyncJob.count({
      where: { status: "DEAD_LETTER", updatedAt: { gte: since7d } },
    }),
    p.kandakatorSyncJob.findFirst({
      where: { status: "DEAD_LETTER" },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true, dateKey: true, lastError: true },
    }),
    p.kandakatorSyncJob.findFirst({
      where: { status: "DEAD_LETTER" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, dateKey: true, lastError: true, source: true },
    }),
    p.kandakatorSyncJob.count({
      where: { status: "FAILED", updatedAt: { gte: since24h } },
    }),
    p.kandakatorSyncJob.count({ where: { status: "PENDING" } }),
    p.kandakatorSyncJob.count({ where: { status: "PROCESSING" } }),
  ]);

  const recentDeadLetters = await p.kandakatorSyncJob.findMany({
    where: { status: "DEAD_LETTER", updatedAt: { gte: since7d } },
    select: { lastError: true, dateKey: true, source: true, updatedAt: true, attemptCount: true },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });

  const errorBuckets = new Map();
  for (const row of recentDeadLetters) {
    const key = bucketError(row.lastError);
    errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1);
  }

  const topErrors = [...errorBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([reason, count]) => ({ reason, count }));

  const byDateKey24h = await p.kandakatorSyncJob.groupBy({
    by: ["dateKey"],
    where: { status: "DEAD_LETTER", updatedAt: { gte: since24h } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const hourly24h = await p.$queryRaw`
    SELECT DATE_FORMAT(updatedAt, '%Y-%m-%d %H:00') AS hour_bucket, COUNT(*) AS cnt
    FROM kandakator_sync_jobs
    WHERE status = 'DEAD_LETTER' AND updatedAt >= ${since24h}
    GROUP BY hour_bucket
    ORDER BY hour_bucket ASC
  `;

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        totalDeadLetter,
        deadLetter24h,
        deadLetter7d,
        failed24h,
        pendingNow,
        processingNow,
        stillIncreasing:
          deadLetter24h > 0
            ? "yes — new dead-letters in last 24h"
            : "no new dead-letters in last 24h (accumulation only)",
        oldestDeadLetter,
        newestDeadLetter,
        topErrorsLast7d: topErrors,
        deadLetterByDateKey24h: byDateKey24h,
        deadLetterHourly24h: hourly24h,
      },
      null,
      2,
    ),
  );

  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
