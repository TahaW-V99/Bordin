import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { enqueueKandakatorSyncDates } from "@/server/services/kandakator-sync-queue-service";
import { tehranDateKey } from "@/server/memory/kandakator-seed";

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  week: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);

    const body = await request.json().catch(() => ({}));
    const data = bodySchema.parse(body);

    if (data.week) {
      const weekDates = Array.from({ length: 7 }, (_, index) => {
        const base = new Date();
        base.setDate(base.getDate() + index);
        return tehranDateKey(base);
      });
      const jobs = await enqueueKandakatorSyncDates(weekDates, "admin-week-sync", session.userId);
      return NextResponse.json({ success: true, jobs });
    }

    const date = data.date ?? tehranDateKey(new Date());
    const jobs = await enqueueKandakatorSyncDates([date], "admin-date-sync", session.userId);
    return NextResponse.json({ success: true, publish: data.publish ?? true, jobs });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);

    return NextResponse.json({
      configured: true,
      provider: "queue-based fixture API sync",
      endpoint: "External API -> Queue -> Worker -> DB -> Verification",
      dashboard: "Admin enqueue only; ingestion happens in queue processor",
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 403 });
  }
}
