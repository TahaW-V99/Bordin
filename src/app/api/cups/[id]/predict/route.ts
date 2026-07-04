import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { predictCup } from "@/server/services/competition-service";

const schema = z.object({
  homePrediction: z.number().int().min(0).max(20),
  awayPrediction: z.number().int().min(0).max(20),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = schema.parse(await request.json());
    const prediction = await predictCup(
      id,
      session.userId,
      body.homePrediction,
      body.awayPrediction,
    );
    return NextResponse.json({ success: true, prediction });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
