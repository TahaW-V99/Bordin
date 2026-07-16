#!/usr/bin/env node
/**
 * Run AFTER deploy:production (script must exist on Liara app).
 *
 *   npm run fix:france-spain:production
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

function parseEnvFile(path) {
  const env = {};
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

function liara(command) {
  console.error(`\n→ liara shell: ${command}\n`);
  const result = spawnSync(`liara shell --app bordin --command ${JSON.stringify(command)}`, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, CI: "true", TERM: "dumb" },
  });
  return result.status ?? 1;
}

const fixExit = liara("node prisma/fix-france-spain-score-prod.mjs");
if (fixExit !== 0) {
  console.error("\nFix failed. Deploy first: npm run deploy:production");
  process.exit(fixExit);
}

const token = parseEnvFile(".env.staging").KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
if (!token) {
  console.error("KANDAKATOR_SYNC_PUSH_TOKEN missing in .env.staging");
  process.exit(1);
}

console.error("\n→ POST /api/internal/kandakator/settle\n");
const settle = spawnSync(
  "curl.exe",
  [
    "-sS",
    "-X",
    "POST",
    "https://bordin.ir/api/internal/kandakator/settle",
    "-H",
    `Authorization: Bearer ${token}`,
  ],
  { encoding: "utf8", stdio: ["ignore", "inherit", "inherit"] },
);

process.exit(settle.status ?? 1);
