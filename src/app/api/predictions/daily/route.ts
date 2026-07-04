import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { submitDailyPrediction, DisplayNameRequiredError } from "@/server/services/prediction-service";

const schema = z.object({
  matchId: z.string(),
  kandakatorId: z.string(),
  homePrediction: z.number().int().min(0).max(20),
  awayPrediction: z.number().int().min(0).max(20),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const prediction = await submitDailyPrediction(
      session.userId,
      data.matchId,
      data.kandakatorId,
      data.homePrediction,
      data.awayPrediction,
    );
    return NextResponse.json({ success: true, prediction });
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
