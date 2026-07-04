/**
 * Sets kandakator auto-sync env vars on Liara production (bordin).
 * Reads shared secrets from .env.staging — does not change DATABASE_URL or JWT.
 *
 * Usage: npm run env:sync:production:kandakator
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const STAGING_ENV_FILE = ".env.staging";
const PRODUCTION_APP = "bordin";
const CF_SYNC_URL = "https://bordin-kandakator-sync.bordinir.workers.dev";

function parseEnvFile(content) {
  const env = {};
  for (const line of content.split("\n")) {
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

if (!existsSync(STAGING_ENV_FILE)) {
  console.error(`Missing ${STAGING_ENV_FILE}`);
  process.exit(1);
}

const staging = parseEnvFile(readFileSync(STAGING_ENV_FILE, "utf8"));
const pushToken = staging.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
const apiKey = staging.FOOTBALL_DATA_API_KEY?.trim();

if (!pushToken || !apiKey) {
  console.error("KANDAKATOR_SYNC_PUSH_TOKEN and FOOTBALL_DATA_API_KEY required in .env.staging");
  process.exit(1);
}

const pairs = [
  `KANDAKATOR_SYNC_PUSH_TOKEN=${pushToken}`,
  `FOOTBALL_DATA_API_KEY=${apiKey}`,
  "KANDAKATOR_RUNTIME_SYNC=false",
  "FOOTBALL_DATA_FETCH_TIMEOUT_MS=15000",
  `KANDAKATOR_CF_SYNC_URL=${CF_SYNC_URL}`,
];

console.log(`Setting kandakator env on Liara app "${PRODUCTION_APP}"...`);

const result = spawnSync("liara", ["env", "set", "-f", "-a", PRODUCTION_APP, ...pairs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Production kandakator env updated.");
