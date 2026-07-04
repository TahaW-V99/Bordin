import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import {
  failGatewayPayment,
  getPaymentById,
  verifyAndFinalizeGatewayPayment,
} from "@/server/services/store-service";
import { isPaymentGatewayMockMode } from "@/server/services/payment-gateway";

const schema = z.object({
  paymentId: z.string().min(1),
  success: z.boolean(),
});

export async function POST(request: Request) {
  try {
    if (!isPaymentGatewayMockMode()) {
      return NextResponse.json({ error: "Mock verify only available in test mode" }, { status: 403 });
    }

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = schema.parse(await request.json());
    const payment = await getPaymentById(session.userId, body.paymentId);
    if (!payment) return NextResponse.json({ error: "تراکنش یافت نشد" }, { status: 404 });

    if (!payment.zibalTrackId) {
      return NextResponse.json({ error: "تراکنش درگاه معتبر نیست" }, { status: 400 });
    }

    if (!body.success) {
      const result = await failGatewayPayment(body.paymentId, "mock_user_declined");
      return NextResponse.json({ ok: false, ...result });
    }

    const result = await verifyAndFinalizeGatewayPayment({
      paymentId: body.paymentId,
      trackId: payment.zibalTrackId,
      source: "mock",
      mockOutcome: "success",
      callbackPayload: { mock: true, success: body.success },
    });

    return NextResponse.json({
      success: result.status === "PAID",
      packageCoins: result.packageCoins ?? 0,
      status: result.status,
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
