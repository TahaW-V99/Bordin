import { NextResponse } from "next/server";
import {
  failGatewayPayment,
  getPaymentById,
  resolvePaymentReturnOrigin,
  verifyAndFinalizeGatewayPayment,
} from "@/server/services/store-service";
import { logPaymentEvent } from "@/server/services/payment-logger";

function redirectToStorePath(request: Request, returnOrigin: string | null, path: string) {
  const base = resolvePaymentReturnOrigin(request, returnOrigin);
  return NextResponse.redirect(`${base}${path}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId") ?? "";
  const trackId =
    url.searchParams.get("trackId") ??
    url.searchParams.get("trackId".toLowerCase()) ??
    "";

  if (!paymentId) {
    return redirectToStorePath(request, null, "/store/payment/failed");
  }

  const payment = await getPaymentById(null, paymentId);
  if (!payment) {
    return redirectToStorePath(request, null, "/store/payment/failed");
  }

  const callbackPayload = Object.fromEntries(url.searchParams.entries());

  logPaymentEvent({
    step: "callback_received",
    paymentId,
    userId: payment.userId,
    trackId: trackId || payment.zibalTrackId,
    metadata: callbackPayload,
  });

  const resolvedTrackId = trackId || payment.zibalTrackId;
  if (!resolvedTrackId) {
    await failGatewayPayment(paymentId, "missing_track_id_in_callback");
    return redirectToStorePath(request, payment.returnOrigin, "/store/payment/failed");
  }

  try {
    const result = await verifyAndFinalizeGatewayPayment({
      paymentId,
      trackId: resolvedTrackId,
      callbackPayload,
      source: "callback",
    });

    if (result.status === "PAID") {
      return redirectToStorePath(
        request,
        payment.returnOrigin,
        `/store/payment/success?coins=${result.packageCoins ?? 0}`,
      );
    }

    if (result.status === "FAILED") {
      return redirectToStorePath(request, payment.returnOrigin, "/store/payment/failed");
    }

    return redirectToStorePath(request, payment.returnOrigin, "/store/payment/failed?pending=1");
  } catch {
    await failGatewayPayment(paymentId, "callback_verification_error").catch(() => {});
    return redirectToStorePath(request, payment.returnOrigin, "/store/payment/failed");
  }
}
