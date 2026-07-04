import { existsSync, readFileSync } from "node:fs";

function parseEnvFile(path: string) {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function mergeEnvFiles(paths: string[]) {
  const merged: Record<string, string> = {};
  for (const path of paths) {
    Object.assign(merged, parseEnvFile(path));
  }
  return merged;
}

const isStaging = process.argv.includes("--staging");

if (isStaging) {
  const merged = mergeEnvFiles([".env.staging", ".env.staging.local"]);
  process.env.DEV_MEMORY_DB = "false";
  process.env.FOOTBALL_DATA_FETCH_TIMEOUT_MS ??= "30000";
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
  process.env.DEV_MEMORY_DB = "false";
}

async function main() {
  const { syncTehranWeekFromApi } = await import("@/server/services/kandakator-sync-service");
  const { settleAllFinishedMatches } = await import("@/server/services/settlement-service");
  const { isFootballDataConfigured } = await import("@/server/services/football-data-api");

  if (!isFootballDataConfigured()) {
    console.error("FOOTBALL_DATA_API_KEY is not set.");
    process.exit(1);
  }

  const results = await syncTehranWeekFromApi();
  const total = results.reduce((sum, row) => sum + row.matchCount, 0);
  console.log(`Synced ${results.length} days, ${total} matches total.`);

  const { settled } = await settleAllFinishedMatches();
  console.log(`Settled ${settled} predictions.`);
  for (const row of results) {
    console.log(`  ${row.date}: ${row.matchCount} matches`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
