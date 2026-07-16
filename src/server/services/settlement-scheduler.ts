/**
 * In-process settlement scheduling (Phase 1 — temporary, not production-durable).
 *
 * WHY THIS EXISTS
 * User-facing read paths must not perform settlement writes (wallet, XP,
 * notifications, team-competition aggregation). Reads may only query DB state
 * and signal background work. These helpers fire-and-forget settlement with
 * per-key debounce to limit stampedes when many users load the same kandakator
 * or finished match at once.
 *
 * RESTART BEHAVIOR
 * All debounce Sets are in-memory. On deploy/restart/crash:
 * - In-flight settlement may be interrupted mid-match.
 * - Debounce keys are cleared; duplicate scheduling can occur briefly.
 * - Unsettled rows remain in DB unchanged.
 * - Recovery: reconciliation tick (every 5 min) runs settleAllFinishedMatches;
 *   sync queue processor settles after score ingest; next user read re-signals.
 *
 * FAILURE SCENARIO
 * If settleMatchPredictions throws, the error is logged and the debounce key
 * clears after SETTLEMENT_DEBOUNCE_MS. There is no retry queue in Phase 1 —
 * reconciliation or a subsequent read must re-schedule.
 *
 * PHASE 2 MIGRATION (not implemented in Phase 1)
 * Replace with a durable settlement_jobs queue (MySQL, same pattern as
 * kandakator_sync_jobs): at-least-once delivery, idempotent settlement,
 * metrics (pending/latency/DLQ), and worker coalescing by matchId.
 */

const SETTLEMENT_DEBOUNCE_MS = 60_000;

const kandakatorSettlementScheduled = new Set<string>();
const matchSettlementScheduled = new Set<string>();

/** Debounced background settlement for all finished matches in one kandakator day. */
export function scheduleKandakatorSettlement(kandakatorId: string) {
  if (kandakatorSettlementScheduled.has(kandakatorId)) return;
  kandakatorSettlementScheduled.add(kandakatorId);

  void (async () => {
    try {
      const { settleKandakatorFinishedMatches } = await import(
        "@/server/services/settlement-service"
      );
      await settleKandakatorFinishedMatches(kandakatorId);
    } catch (error) {
      console.error(
        "[Bordin:settlement-scheduler] kandakator settlement failed:",
        kandakatorId,
        error,
      );
    } finally {
      setTimeout(() => kandakatorSettlementScheduled.delete(kandakatorId), SETTLEMENT_DEBOUNCE_MS);
    }
  })();
}

/** Debounced background settlement for one or more finished matches. */
export function scheduleMatchPredictionsSettlement(matchIds: string | string[]) {
  const ids = [...new Set((Array.isArray(matchIds) ? matchIds : [matchIds]).filter(Boolean))];
  for (const matchId of ids) {
    scheduleOneMatchSettlement(matchId);
  }
}

function scheduleOneMatchSettlement(matchId: string) {
  if (matchSettlementScheduled.has(matchId)) return;
  matchSettlementScheduled.add(matchId);

  void (async () => {
    try {
      const { settleMatchPredictions } = await import("@/server/services/settlement-service");
      await settleMatchPredictions(matchId);
    } catch (error) {
      console.error("[Bordin:settlement-scheduler] match settlement failed:", matchId, error);
    } finally {
      setTimeout(() => matchSettlementScheduled.delete(matchId), SETTLEMENT_DEBOUNCE_MS);
    }
  })();
}
