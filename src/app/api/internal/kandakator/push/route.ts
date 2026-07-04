import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { syncDailyKandakatorFromFootballMatches } from "@/server/services/kandakator-sync-service";

const matchSchema = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: z.string(),
  homeTeam: z.object({ id: z.number(), name: z.string() }),
  awayTeam: z.object({ id: z.number(), name: z.string() }),
  competition: z.object({ id: z.number(), name: z.string() }).optional(),
  score: z
    .object({
      fullTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }).optional(),
      regularTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }).optional(),
    })
    .optional(),
});

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  matches: z.array(matchSchema),
  publish: z.boolean().optional(),
  /** Admin-only: explicit opt-in to remove links not present in payload */
  confirmFullRebuild: z.boolean().optional(),
});

function authorizePush(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  try {
    if (!authorizePush(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodySchema.parse(await request.json());
    const result = await syncDailyKandakatorFromFootballMatches(body.date, body.matches, {
      publish: body.publish,
      source: request.headers.get("x-bordin-sync-source") ?? "push",
      allowFullRebuild: body.confirmFullRebuild === true,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
