import { NextResponse } from "next/server";
import { getKandakatorSyncHealth } from "@/server/services/kandakator-sync-health";
import { getRecentKandakatorDateKeys } from "@/server/services/kandakator-reconciliation-service";
import { getKandakatorSyncQueueStats } from "@/server/services/kandakator-sync-queue-service";
import { runKandakatorSystemAudit } from "@/server/services/kandakator-system-audit";
import { getDeadLetterDiagnostics } from "@/server/services/kandakator-dead-letter-diagnostics";

function authorize(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await getKandakatorSyncHealth();
  const recentDates = await getRecentKandakatorDateKeys();
  const queue = await getKandakatorSyncQueueStats();
  const audit = await runKandakatorSystemAudit();
  const deadLetterDiagnostics = await getDeadLetterDiagnostics();

  const minutesSinceLastSuccess = health.lastSuccess
    ? Math.round((Date.now() - health.lastSuccess.createdAt.getTime()) / 60_000)
    : null;

  const degraded =
    health.staleMatchCount > 0 ||
    health.unsettledPredictionCount > 0 ||
    (minutesSinceLastSuccess !== null && minutesSinceLastSuccess > 30);

  return NextResponse.json({
    status: degraded || audit.systemStatus !== "HEALTHY" ? "degraded" : "healthy",
    audit,
    lastSuccessfulSync: health.lastSuccess
      ? {
          scope: health.lastSuccess.scope,
          source: health.lastSuccess.source,
          matchCount: health.lastSuccess.matchCount,
          at: health.lastSuccess.createdAt.toISOString(),
          minutesAgo: minutesSinceLastSuccess,
        }
      : null,
    lastFailedSync: health.lastFailure
      ? {
          scope: health.lastFailure.scope,
          source: health.lastFailure.source,
          errorMessage: health.lastFailure.errorMessage,
          at: health.lastFailure.createdAt.toISOString(),
        }
      : null,
    staleMatchCount: health.staleMatchCount,
    unsettledPredictionCount: health.unsettledPredictionCount,
    queue,
    deadLetterDiagnostics,
    recentKandakatorDates: recentDates,
    recentRecords: health.recentRecords.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
  });
}
