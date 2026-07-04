#!/usr/bin/env node
/**
 * Recover kandakator on the correct database target.
 *
 *   node scripts/recover-kandakator.mjs              → staging
 *   node scripts/recover-kandakator.mjs production   → production
 *
 * Prefer: npm run recover:kandakator:staging | npm run recover:kandakator:production
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const INTERNAL_HOSTS = ["bordindb:3306", "bordindbtest:3306"];
const PRODUCTION_APP = "bordin";

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

function mergeEnvFiles(paths) {
  const merged = {};
  for (const path of paths) {
    Object.assign(merged, parseEnvFile(path));
  }
  return merged;
}

function isInternalDatabaseUrl(url) {
  return INTERNAL_HOSTS.some((host) => url.includes(`@${host}`));
}

function runRecoverCli(extraArgs = []) {
  const args = ["tsx", "scripts/recover-kandakator.ts", ...extraArgs];
  return spawnSync("npx", args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
}

function runLiaraShellRecover(app) {
  const command = "node prisma/recover-kandakator-liara.mjs";
  console.log(`Connecting via Liara shell (app: ${app})...\n`);
  if (process.platform === "win32") {
    return spawnSync(`liara shell --app ${app} --command "${command}"`, {
      stdio: "inherit",
      shell: true,
    });
  }
  return spawnSync("liara", ["shell", "--app", app, "--command", command], {
    stdio: "inherit",
  });
}

function printProductionHelp() {
  console.error("\n❌ Production recover cannot use http-push from your PC (server DB pool errors).\n");
  console.error("Use one of these:");
  console.error("  1. npm run recover:kandakator:production");
  console.error("     → runs inside Liara shell with internal DATABASE_URL (recommended)");
  console.error("  2. Create .env.production.local with public MySQL URL from Liara panel");
  console.error("     → Databases → bordindb → Public Network (see .env.production.local.example)");
  console.error("     → then run npm run recover:kandakator:production again\n");
}

const targetArg = process.argv[2];
const target =
  targetArg === "production" || process.argv.includes("--production") ? "production" : "staging";

if (target === "staging") {
  const result = runRecoverCli();
  process.exit(result.status ?? 1);
}

const merged = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.staging"),
  ...parseEnvFile(".env.production.local"),
};
const databaseUrl = merged.DATABASE_URL?.trim() ?? "";

if (!databaseUrl) {
  console.error("DATABASE_URL not found. Check .env or .env.production.local.");
  process.exit(1);
}

if (databaseUrl && !isInternalDatabaseUrl(databaseUrl)) {
  console.log("Running production recover with public DATABASE_URL (local-db mode)...\n");
  for (const [key, value] of Object.entries(merged)) {
    if (value) process.env[key] = value;
  }
  const result = runRecoverCli(["--production"]);
  process.exit(result.status ?? 1);
}

const liara = spawnSync("liara", ["--version"], { shell: true, encoding: "utf8" });
if (liara.status !== 0) {
  printProductionHelp();
  process.exit(1);
}

const result = runLiaraShellRecover(PRODUCTION_APP);
if ((result.status ?? 1) !== 0) {
  console.error("\nLiara shell recover failed. Deploy latest code first: npm run deploy:production");
  printProductionHelp();
}
process.exit(result.status ?? 1);
