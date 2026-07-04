type PaymentLogStep =
  | "request_created"
  | "redirect"
  | "callback_received"
  | "verification_started"
  | "verification_success"
  | "verification_failed"
  | "reconciliation"
  | "coins_granted"
  | "marked_failed";

export function logPaymentEvent(input: {
  step: PaymentLogStep;
  paymentId: string;
  userId?: string;
  trackId?: string | null;
  status?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}) {
  console.info(
    "[Bordin:payment]",
    JSON.stringify({
      ts: new Date().toISOString(),
      ...input,
    }),
  );
}
