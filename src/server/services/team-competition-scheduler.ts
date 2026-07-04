import { processAllActiveTeamCompetitions } from "@/server/services/team-competition-engine";

const ENGINE_INTERVAL_MS = 5 * 60 * 1000;
let started = false;
let running = false;

function shouldSkipForMemoryDb() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true";
}

async function runEngineCycle() {
  if (running) return;
  if (shouldSkipForMemoryDb()) return;

  running = true;
  try {
    const result = await processAllActiveTeamCompetitions();
    if (result.processed > 0) {
      console.info(`[Bordin] موتور رقابت تیمی: ${result.processed} رقابت بررسی شد`);
    }
  } catch (error) {
    console.error("[Bordin] خطا در موتور رقابت تیمی:", error);
  } finally {
    running = false;
  }
}

export function startTeamCompetitionEngineScheduler() {
  if (started) return;
  if (process.env.NODE_ENV === "test") return;

  started = true;
  void runEngineCycle();
  setInterval(() => {
    void runEngineCycle();
  }, ENGINE_INTERVAL_MS);
}
