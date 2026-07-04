const SETTLEMENT_INTERVAL_MS = 5 * 60 * 1000;
let started = false;
let running = false;

function shouldSkipForMemoryDb() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true";
}

async function runSettlementCycle() {
  if (running) return;
  if (shouldSkipForMemoryDb()) return;

  running = true;
  try {
    const { settleAllFinishedMatches } = await import("@/server/services/settlement-service");
    const result = await settleAllFinishedMatches();
    if (result.settled > 0) {
      console.info(`[Bordin] تسویه خودکار: ${result.settled} پیش‌بینی`);
    }
  } catch (error) {
    console.error("[Bordin] خطا در تسویه خودکار پیش‌بینی‌ها:", error);
  } finally {
    running = false;
  }
}

/** هر ۵ دقیقه پیش‌بینی‌هایی که نتیجه بازی‌شان در دیتابیس هست را تسویه می‌کند. */
export function startPredictionSettlementScheduler() {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;

  started = true;
  void runSettlementCycle();
  setInterval(() => {
    void runSettlementCycle();
  }, SETTLEMENT_INTERVAL_MS);
}
