import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { readAllowFootballCredit } from "@/shared/lib/api-route";
import { runWithAssetPaymentContext } from "@/server/services/asset-payment-context";
import { footballCreditConfirmationResponse } from "@/server/services/asset-payment-response";
import { submitDailyPrediction, DisplayNameRequiredError } from "@/server/services/prediction-service";
import { jsonCaughtError } from "@/shared/lib/api-route";

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
    const allowFootballCredit = await readAllowFootballCredit(request);
    const body = await request.json();
    const data = schema.parse(body);
    const prediction = await runWithAssetPaymentContext(allowFootballCredit, () =>
      submitDailyPrediction(
        session.userId,
        data.matchId,
        data.kandakatorId,
        data.homePrediction,
        data.awayPrediction,
      ),
    );
    return NextResponse.json({ success: true, prediction });
  } catch (error) {
    const confirm = footballCreditConfirmationResponse(error);
    if (confirm) return confirm;
    if (error instanceof DisplayNameRequiredError) {
      return NextResponse.json(
        { error: "ابتدا نام خود را در تنظیمات تعیین کنید", code: "DISPLAY_NAME_REQUIRED" },
        { status: 403 },
      );
    }
    return jsonCaughtError(error);
  }
}
