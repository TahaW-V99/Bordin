import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { processKandakatorSyncQueue } from "@/server/services/kandakator-sync-queue-processor";
import { runKandakatorReconciliation } from "@/server/services/kandakator-reconciliation-service";

const bodySchema = z
  .object({
    source: z.string().min(1).optional(),
  })
  .optional();

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
let lastReconcileAt = 0;

function authorize(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  try {
    if (!authorize(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json().catch(() => undefined));
    const queueResults = await processKandakatorSyncQueue(2);

    let reconciliation:
      | Awaited<ReturnType<typeof runKandakatorReconciliation>>
      | null = null;

    if (Date.now() - lastReconcileAt >= RECONCILE_INTERVAL_MS) {
      reconciliation = await runKandakatorReconciliation();
      lastReconcileAt = Date.now();
    }

    return NextResponse.json({
      success: true,
      source: body?.source ?? "tick-route",
      queueProcessed: queueResults.length,
      queueResults,
      reconciliation,
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
