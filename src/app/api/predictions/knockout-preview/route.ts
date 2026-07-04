import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { previewKnockoutTeamPrediction } from "@/server/services/team-competition-knockout-prediction-service";

const schema = z.object({
  matchId: z.string(),
  kandakatorId: z.string(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    const preview = await previewKnockoutTeamPrediction(
      session.userId,
      body.matchId,
      body.kandakatorId,
    );
    return NextResponse.json({ preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای سرور";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
