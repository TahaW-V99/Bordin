import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { submitKnockoutTeamPrediction } from "@/server/services/team-competition-knockout-prediction-service";
import { DisplayNameRequiredError } from "@/server/services/prediction-errors";

const schema = z.object({
  matchId: z.string(),
  kandakatorId: z.string(),
  homePrediction: z.number().int().min(0).max(20),
  awayPrediction: z.number().int().min(0).max(20),
  confirmCover: z.boolean().optional(),
  cancelCover: z.boolean().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    const result = await submitKnockoutTeamPrediction(
      session.userId,
      body.matchId,
      body.kandakatorId,
      body.homePrediction,
      body.awayPrediction,
      { confirmCover: body.confirmCover, cancelCover: body.cancelCover },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DisplayNameRequiredError) {
      return NextResponse.json(
        { error: "ابتدا نام خود را در تنظیمات تعیین کنید", code: "DISPLAY_NAME_REQUIRED" },
        { status: 403 },
      );
    }
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
