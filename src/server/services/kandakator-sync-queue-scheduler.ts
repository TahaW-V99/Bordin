import { addDays } from "date-fns";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { kandakatorDateFromKey } from "@/shared/lib/dates";

const QUEUE_INTERVAL_MS = 60_000;
let started = false;
let running = false;

function shouldSkipForMemoryDb() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true";
}

function getDefaultQueuedDates() {
  const todayKey = tehranDateKey(new Date());
  const today = kandakatorDateFromKey(todayKey);
  return [
    tehranDateKey(addDays(today, -1)),
    todayKey,
    tehranDateKey(addDays(today, 1)),
  ];
}

async function runQueueCycle() {
  if (running) return;
  if (shouldSkipForMemoryDb()) return;
  if (process.env.NODE_ENV === "test") return;

  running = true;
  try {
    const [{ processKandakatorSyncQueue }, { enqueueKandakatorSyncDates }] = await Promise.all([
      import("@/server/services/kandakator-sync-queue-processor"),
      import("@/server/services/kandakator-sync-queue-service"),
    ]);
    const { countPublishedMatchesForDate, getRecentTehranDateKeys, hasPublishedKandakatorForDate } = await import(
      "@/server/services/kandakator-display-ingest"
    );
    const recentDates = getRecentTehranDateKeys(10);
    const missingDates: string[] = [];
    for (const dateKey of recentDates) {
      const [matchCount, hasPublished] = await Promise.all([
        countPublishedMatchesForDate(dateKey),
        hasPublishedKandakatorForDate(dateKey),
      ]);
      if (matchCount === 0 && !hasPublished) {
        missingDates.push(dateKey);
      }
    }
    if (missingDates.length > 0) {
      await enqueueKandakatorSyncDates(missingDates, "scheduler-recovery");
    }

    await enqueueKandakatorSyncDates(getDefaultQueuedDates(), "scheduler");
    await processKandakatorSyncQueue(2);
  } catch (error) {
    console.error("[Bordin] kandakator queue cycle error:", error);
  } finally {
    running = false;
  }
}

export function startKandakatorSyncQueueScheduler() {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;

  started = true;
  void runQueueCycle();
  setInterval(() => {
    void runQueueCycle();
  }, QUEUE_INTERVAL_MS);
}
