/**
 * Pushes variables from .env.staging to the Liara staging app (liara.staging.json).
 * Does not touch the production app or production env vars.
 *
 * Usage: npm run env:sync:staging
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const STAGING_ENV_FILE = ".env.staging";
const STAGING_LIARA_FILE = "liara.staging.json";

function parseEnvFile(content) {
  const pairs = [];
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
    pairs.push(`${key}=${value}`);
  }
  return pairs;
}

if (!existsSync(STAGING_ENV_FILE)) {
  console.error(`Missing ${STAGING_ENV_FILE}. Copy from .env.staging.example first.`);
  process.exit(1);
}

if (!existsSync(STAGING_LIARA_FILE)) {
  console.error(`Missing ${STAGING_LIARA_FILE}.`);
  process.exit(1);
}

const { app } = JSON.parse(readFileSync(STAGING_LIARA_FILE, "utf8"));
if (!app) {
  console.error(`"app" is required in ${STAGING_LIARA_FILE}.`);
  process.exit(1);
}

const envPairs = parseEnvFile(readFileSync(STAGING_ENV_FILE, "utf8"));
if (envPairs.length === 0) {
  console.error(`No variables found in ${STAGING_ENV_FILE}.`);
  process.exit(1);
}

console.log(`Syncing ${envPairs.length} variables to Liara app "${app}" (staging only)...`);

const result = spawnSync("liara", ["env", "set", "-f", "-a", app, ...envPairs], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Staging environment variables updated.");
