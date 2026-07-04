/** Mock gateway for local dev / staging simulation — no real Zibal connection */
export function isPaymentGatewayMockMode() {
  const mock = process.env.PAYMENT_GATEWAY_MOCK?.trim().toLowerCase();
  if (mock === "true" || mock === "1") return true;
  if (mock === "false" || mock === "0") return false;

  if (process.env.BORDIN_ENV?.toLowerCase() === "staging") {
    return process.env.ZIBAL_USE_LIVE_ON_STAGING?.toLowerCase() !== "true";
  }

  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

export function getPaymentReconcileIntervalMs() {
  const fromEnv = process.env.PAYMENT_RECONCILE_INTERVAL_MS?.trim();
  if (fromEnv) return Math.max(60_000, Number(fromEnv) || 300_000);

  if (process.env.BORDIN_ENV?.toLowerCase() === "staging") {
    return 3 * 60 * 1000;
  }

  return 5 * 60 * 1000;
}
