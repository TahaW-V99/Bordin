import { NextResponse } from "next/server";
import { z } from "zod";
import { runEmergencyKandakatorRecovery } from "@/server/services/kandakator-recovery-service";
import { getRecentTehranDateKeys } from "@/server/services/kandakator-display-ingest";

export const maxDuration = 60;

const bodySchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  days: z.number().int().min(1).max(14).optional(),
  source: z.string().min(1).optional(),
  waitMs: z.number().int().min(5_000).max(180_000).optional(),
  /** Wait inline for ingest (slow). CLI uses false and polls GET instead. */
  waitForIngest: z.boolean().optional(),
});

function authorizePush(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!authorizePush(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const days = body.days ?? 10;
    const dateKeys = body.dates?.length ? body.dates : getRecentTehranDateKeys(days);
    const waitForIngest = body.waitForIngest ?? false;

    const recovery = await runEmergencyKandakatorRecovery({
      days,
      dateKeys,
      waitMs: body.waitMs ?? (waitForIngest ? 120_000 : 20_000),
      waitForIngest,
      source: body.source ?? "recover-route",
    });

    return NextResponse.json({
      success: recovery.satisfied || recovery.audit.dataLayer.status !== "EMPTY",
      recovery,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[kandakator/recover] POST failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!authorizePush(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runKandakatorSystemAudit } = await import("@/server/services/kandakator-system-audit");
    const audit = await runKandakatorSystemAudit();
    return NextResponse.json(audit);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[kandakator/recover] GET failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
