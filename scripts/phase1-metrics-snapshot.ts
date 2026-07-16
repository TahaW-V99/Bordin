/**
 * One-off Phase 1 metrics snapshot from DB + health API.
 * Usage: npx dotenv -e .env.staging.local -e .env.staging -- npx tsx scripts/phase1-metrics-snapshot.ts staging
 */
import { prisma } from "@/shared/lib/prisma";

const envLabel = process.argv[2] ?? "production";
const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

async function jobMetrics(since) {
  const [created, completed, failed, deadLetter, fetched] = await Promise.all([
    prisma.kandakatorSyncJob.count({ where: { createdAt: { gte: since } } }),
    prisma.kandakatorSyncJob.count({
      where: { status: "COMPLETED", lastVerifiedAt: { gte: since } },
    }),
    prisma.kandakatorSyncJob.count({
      where: { status: "FAILED", updatedAt: { gte: since } },
    }),
    prisma.kandakatorSyncJob.count({
      where: { status: "DEAD_LETTER", updatedAt: { gte: since } },
    }),
    prisma.kandakatorSyncJob.count({ where: { lastFetchedAt: { gte: since } } }),
  ]);

  const bySource = await prisma.kandakatorSyncJob.groupBy({
    by: ["source"],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  });

  const githubCreated = await prisma.kandakatorSyncJob.count({
    where: {
      createdAt: { gte: since },
      OR: [{ source: { contains: "github" } }, { source: "github-actions" }],
    },
  });

  return { created, completed, failed, deadLetter, fetched, bySource, githubCreated };
}

async function syncRecordMetrics(since) {
  const records = await prisma.kandakatorSyncRecord.findMany({
    where: { createdAt: { gte: since } },
    select: { source: true, status: true, scope: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return { count: records.length, records };
}

async function fetchHealth(baseUrl, token) {
  if (!token) return { error: "no_token" };
  try {
    const res = await fetch(`${baseUrl}/api/internal/kandakator/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });
    return { status: res.status, body: await res.json() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const [m24h, m7d, syncRecords] = await Promise.all([
    jobMetrics(since24h),
    jobMetrics(since7d),
    syncRecordMetrics(since24h),
  ]);

  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  const baseUrl =
    envLabel === "staging"
      ? process.env.BORDIN_STAGING_URL?.trim() || "https://bordintest.ir"
      : process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://bordin.ir";

  const health = await fetchHealth(baseUrl, token);

  console.log(
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        env: envLabel,
        baseUrl,
        phase1CodeDeployed: false,
        phase1CodeDeployedNote:
          "Phase 1 changes are uncommitted locally — these metrics reflect pre-Phase-1 production/staging behavior",
        jobs24h: m24h,
        jobs7d: m7d,
        syncRecords24h: syncRecords,
        health,
        notAvailableFromDb: {
          enqueueSkipped:
            "Not persisted — requires Liara log grep on [Bordin:sync-queue] enqueue_skipped",
          kandakatorResponseTimeBeforeAfter:
            "Not instrumented — no response-time field in DB or sync records",
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("METRICS_ERROR", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
