import { runKandakatorReconciliation } from "@/server/services/kandakator-reconciliation-service";
import { staleMatchesNeedRemoteSync } from "@/server/services/kandakator-remote-sync-service";

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
let started = false;
let running = false;

function shouldSkipForMemoryDb() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true";
}

async function runReconcileCycle() {
  if (running) return;
  if (shouldSkipForMemoryDb()) return;
  if (process.env.NODE_ENV === "test") return;

  running = true;
  try {
    const needsRemote = await staleMatchesNeedRemoteSync();
    const result = await runKandakatorReconciliation();

    if (needsRemote && result.status === "failed") {
      console.warn(
        "[Bordin] reconciliation could not refresh stale scores — verify CF worker + push token",
      );
    }
  } catch (error) {
    console.error("[Bordin] reconciliation cycle error:", error);
  } finally {
    running = false;
  }
}

/** Every 5 minutes: detect orphan states, trigger sync, settle predictions */
export function startKandakatorReconciliationScheduler() {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;

  started = true;
  void runReconcileCycle();
  setInterval(() => {
    void runReconcileCycle();
  }, RECONCILE_INTERVAL_MS);
}
