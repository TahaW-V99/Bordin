import { NextResponse } from "next/server";
import { z } from "zod";
import {
  enqueueKandakatorSyncDates,
  enqueueKandakatorSyncDatesIfNeeded,
} from "@/server/services/kandakator-sync-queue-service";

const bodySchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1),
  source: z.string().min(1).optional(),
  force: z.boolean().optional(),
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

  const body = bodySchema.parse(await request.json());
  const source = body.source ?? request.headers.get("x-bordin-sync-source") ?? "enqueue-route";

  if (body.force) {
    const jobs = await enqueueKandakatorSyncDates(body.dates, source);
    return NextResponse.json({
      success: true,
      forced: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        dateKey: job.dateKey,
        status: job.status,
      })),
    });
  }

  const results = await enqueueKandakatorSyncDatesIfNeeded(body.dates, source);

  return NextResponse.json({
    success: true,
    forced: false,
    jobs: results
      .filter((result) => result.job)
      .map((result) => ({
        id: result.job!.id,
        dateKey: result.job!.dateKey,
        status: result.job!.status,
        reason: result.reason,
      })),
    skipped: results
      .filter((result) => !result.enqueued)
      .map((result) => ({ dateKey: result.dateKey, reason: result.reason })),
  });
}
