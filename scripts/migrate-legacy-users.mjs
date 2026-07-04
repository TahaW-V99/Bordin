#!/usr/bin/env node
/**
 * Run legacy user import against the correct database.
 *
 *   node scripts/migrate-legacy-users.mjs              → production
 *   node scripts/migrate-legacy-users.mjs staging      → staging
 *   node scripts/migrate-legacy-users.mjs production path/to/data.json
 *
 * Prefer: npm run migrate:legacy-users | npm run migrate:legacy-users:staging
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const INTERNAL_HOSTS = ["bordindb:3306", "bordindbtest:3306"];
const PRODUCTION_APP = "bordin";
const STAGING_APP = "bordintest";

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

function runLiaraShell(app, command) {
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

function printHelp(target) {
  console.error("\n❌ DATABASE_URL uses Liara internal host — not reachable from your PC.\n");
  if (target === "staging") {
    console.error("1. Create .env.staging.local with the public MySQL URL from Liara panel");
    console.error("2. Push schema:  npm run db:push:staging");
    console.error("3. Run import:   npm run migrate:legacy-users:staging\n");
  } else {
    console.error("1. Push schema first:  npm run db:push");
    console.error("2. Run import:         npm run migrate:legacy-users");
    console.error("\nOr run inside Liara (uses internal DATABASE_URL on the server):");
    console.error(`  liara shell --app ${PRODUCTION_APP} --command "node prisma/legacy-user-import.mjs"\n`);
  }
}

const args = process.argv.slice(2);
const target = args[0] === "staging" || args[0] === "production" ? args[0] : "production";
const dataArg = args.find((arg) => arg !== "staging" && arg !== "production");
const dataPath = dataArg ?? "scripts/data/legacy-users.json";

const envFiles =
  target === "staging"
    ? [".env.staging", ".env.staging.local"]
    : [".env", ".env.production.local"];

const merged = mergeEnvFiles(envFiles);
const databaseUrl = merged.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL not found. Check your env files.");
  process.exit(1);
}

const remoteCommand = "node prisma/legacy-user-import.mjs";

if (isInternalDatabaseUrl(databaseUrl)) {
  if (target === "staging") {
    printHelp(target);
    process.exit(1);
  }

  const liara = spawnSync("liara", ["--version"], { shell: true, encoding: "utf8" });
  if (liara.status !== 0) {
    printHelp(target);
    process.exit(1);
  }

  const result = runLiaraShell(PRODUCTION_APP, "node prisma/legacy-user-import.mjs");
  process.exit(result.status ?? 1);
}

if (target === "staging" && isInternalDatabaseUrl(databaseUrl)) {
  printHelp(target);
  process.exit(1);
}

if (target !== "staging") {
  console.log("Running legacy user import on production (bordin.ir)...\n");
  const result = spawnSync("node", ["prisma/legacy-user-import.mjs", dataPath], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      ...merged,
      DEV_MEMORY_DB: "false",
    },
  });
  process.exit(result.status ?? 1);
}

console.log(`Running legacy user import on ${target} database...\n`);

const tsxArgs = ["tsx", "scripts/migrate-legacy-users.ts", "--remote", dataPath];
const result = spawnSync("npx", tsxArgs, {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    ...merged,
    DEV_MEMORY_DB: "false",
    BORDIN_ENV: target === "staging" ? "staging" : process.env.BORDIN_ENV,
  },
});

process.exit(result.status ?? 1);
