import { getPaymentReconcileIntervalMs } from "@/server/services/payment-gateway";
import { reconcilePendingPayments } from "@/server/services/payment-reconciliation-service";

let started = false;
let running = false;

async function runCycle() {
  if (running) return;
  if (process.env.NODE_ENV === "test") return;
  if (process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true") return;

  running = true;
  try {
    const result = await reconcilePendingPayments();
    if (result.paid > 0 || result.failed > 0) {
      console.info("[Bordin:payment] reconciliation cycle:", JSON.stringify(result));
    }
  } catch (error) {
    console.error("[Bordin:payment] reconciliation cycle error:", error);
  } finally {
    running = false;
  }
}

export function startPaymentReconciliationScheduler() {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;

  started = true;
  void runCycle();
  setInterval(() => {
    void runCycle();
  }, getPaymentReconcileIntervalMs());
}
