import { prisma } from "@/shared/lib/prisma";

const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

function bucketError(msg: string | null) {
  if (!msg) return "(null)";
  const m = msg.toLowerCase();
  if (m.includes("rate limit") || m.includes("request limit")) return "rate_limit";
  if (m.includes("fixture_api_not_configured")) return "fixture_api_not_configured";
  if (m.includes("fetch failed") || m.includes("اتصال")) return "network_error";
  if (m.includes("db_write_verification_failed")) return "db_write_verification_failed";
  if (m.includes("stale_lock")) return "stale_lock";
  if (m.includes("401") || m.includes("403")) return "auth_error";
  return msg.slice(0, 120);
}

async function main() {
  const [
    totalDeadLetter,
    deadLetter24h,
    deadLetter7d,
    failed24h,
    pendingNow,
    processingNow,
    completed24h,
  ] = await Promise.all([
    prisma.kandakatorSyncJob.count({ where: { status: "DEAD_LETTER" } }),
    prisma.kandakatorSyncJob.count({
      where: { status: "DEAD_LETTER", updatedAt: { gte: since24h } },
    }),
    prisma.kandakatorSyncJob.count({
      where: { status: "DEAD_LETTER", updatedAt: { gte: since7d } },
    }),
    prisma.kandakatorSyncJob.count({
      where: { status: "FAILED", updatedAt: { gte: since24h } },
    }),
    prisma.kandakatorSyncJob.count({ where: { status: "PENDING" } }),
    prisma.kandakatorSyncJob.count({ where: { status: "PROCESSING" } }),
    prisma.kandakatorSyncJob.count({
      where: { status: "COMPLETED", lastVerifiedAt: { gte: since24h } },
    }),
  ]);

  const [oldestDeadLetter, newestDeadLetter] = await Promise.all([
    prisma.kandakatorSyncJob.findFirst({
      where: { status: "DEAD_LETTER" },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true, dateKey: true, lastError: true, createdAt: true },
    }),
    prisma.kandakatorSyncJob.findFirst({
      where: { status: "DEAD_LETTER" },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true, dateKey: true, lastError: true, source: true, attemptCount: true },
    }),
  ]);

  const recentDeadLetters = await prisma.kandakatorSyncJob.findMany({
    where: { status: "DEAD_LETTER", updatedAt: { gte: since7d } },
    select: { lastError: true },
    take: 2000,
  });

  const errorBuckets = new Map<string, number>();
  for (const row of recentDeadLetters) {
    const key = bucketError(row.lastError);
    errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1);
  }

  const topErrors = [...errorBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([reason, count]) => ({ reason, count }));

  const allDeadLetters = await prisma.kandakatorSyncJob.findMany({
    where: { status: "DEAD_LETTER" },
    select: { lastError: true },
    take: 5000,
  });

  const allTimeBuckets = new Map<string, number>();
  for (const row of allDeadLetters) {
    const key = bucketError(row.lastError);
    allTimeBuckets.set(key, (allTimeBuckets.get(key) ?? 0) + 1);
  }

  const topErrorsAllTime = [...allTimeBuckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([reason, count]) => ({ reason, count }));

  const deadLetterByDateKey24h = await prisma.kandakatorSyncJob.groupBy({
    by: ["dateKey"],
    where: { status: "DEAD_LETTER", updatedAt: { gte: since24h } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 10,
  });

  const deadLetterHourly24h = await prisma.$queryRaw<
    Array<{ hour_bucket: string; cnt: bigint }>
  >`
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
        completed24h,
        pendingNow,
        processingNow,
        stillIncreasing: deadLetter24h > 0,
        oldestDeadLetter,
        newestDeadLetter,
        topErrorsLast7d: topErrors,
        topErrorsAllTime: topErrorsAllTime,
        deadLetterByDateKey24h,
        deadLetterHourly24h: deadLetterHourly24h.map((r) => ({
          hour: r.hour_bucket,
          count: Number(r.cnt),
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error("AUDIT_ERROR", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
