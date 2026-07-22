import { NextResponse } from "next/server";
import { z } from "zod";
import { addDays } from "date-fns";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { processKandakatorSyncQueue } from "@/server/services/kandakator-sync-queue-processor";
import { runKandakatorReconciliation } from "@/server/services/kandakator-reconciliation-service";
import { enqueueKandakatorSyncDatesIfNeeded } from "@/server/services/kandakator-sync-queue-service";
import { getTehranWeekDays } from "@/server/services/kandakator-service";
import { settleAllFinishedMatches } from "@/server/services/settlement-service";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { kandakatorDateFromKey } from "@/shared/lib/dates";

const bodySchema = z
  .object({
    source: z.string().min(1).optional(),
  })
  .optional();

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const WEEK_ENQUEUE_INTERVAL_MS = 15 * 60 * 1000;
let lastReconcileAt = 0;
let lastWeekEnqueueAt = 0;

function authorize(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

function getNearDates() {
  const todayKey = tehranDateKey(new Date());
  const today = kandakatorDateFromKey(todayKey);
  return [
    tehranDateKey(addDays(today, -1)),
    todayKey,
    tehranDateKey(addDays(today, 1)),
  ];
}

export async function POST(request: Request) {
  try {
    if (!authorize(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json().catch(() => undefined));
    const source = body?.source ?? "tick-route";

    // Every tick: only yesterday/today/tomorrow (bounded API use).
    await enqueueKandakatorSyncDatesIfNeeded(getNearDates(), source);

    // Frequently: full Tehran week so home strip fills with plan-covered fixtures.
    if (Date.now() - lastWeekEnqueueAt >= WEEK_ENQUEUE_INTERVAL_MS) {
      const week = getTehranWeekDays().map((day) => day.date);
      await enqueueKandakatorSyncDatesIfNeeded(week, `${source}:week`);
      lastWeekEnqueueAt = Date.now();
    }

    // Keep batch small to avoid gateway 504/502 while league caches warm.
    const queueResults = await processKandakatorSyncQueue(3);

    let reconciliation:
      | Awaited<ReturnType<typeof runKandakatorReconciliation>>
      | null = null;

    if (Date.now() - lastReconcileAt >= RECONCILE_INTERVAL_MS) {
      reconciliation = await runKandakatorReconciliation();
      lastReconcileAt = Date.now();
    }

    // Every tick: settle predictions whose match scores are already in DB.
    // (Reconciliation also settles, but only every 5 minutes.)
    const settlement = await settleAllFinishedMatches();

    return NextResponse.json({
      success: true,
      source,
      queueProcessed: queueResults.length,
      queueResults,
      reconciliation,
      settlement,
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
