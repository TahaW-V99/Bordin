#!/usr/bin/env node
/**
 * Push Prisma schema to MySQL.
 *
 *   node scripts/db-push.mjs            → production (Liara shell if internal host)
 *   node scripts/db-push.mjs staging    → staging via public URL in .env.staging.local
 *
 * Prefer: npm run db:push  |  npm run db:push:staging
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

/** Later files override earlier ones. */
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

function runPrismaDbPush(env = process.env, extraArgs = []) {
  return spawnSync("npx", ["prisma", "db", "push", ...extraArgs], {
    stdio: "inherit",
    shell: true,
    env,
  });
}

function runLiaraShellDbPush(app) {
  console.log(`Connecting via Liara shell (app: ${app})...\n`);
  const command = "npx prisma db push";
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
    console.error("Create .env.staging.local with the public MySQL URL from Liara panel, then:");
    console.error("  npm run db:push:staging\n");
  } else {
    console.error("Use one of these instead of plain `npx prisma db push`:");
    console.error("  npm run db:push              ← runs db push inside Liara (recommended)");
    console.error("  liara shell --app bordin --command \"npx prisma db push\"");
    console.error("  npm run db:push:staging      ← for staging database\n");
    console.error("Or add public MySQL URL to .env.production.local (see .env.production.local.example).\n");
  }
}

const target = process.argv[2] ?? "production";
const forceReset = process.argv.includes("--force-reset");

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

if (isInternalDatabaseUrl(databaseUrl)) {
  if (target === "production") {
    const liara = spawnSync("liara", ["--version"], { shell: true, encoding: "utf8" });
    if (liara.status !== 0) {
      printHelp(target);
      process.exit(1);
    }
    const result = runLiaraShellDbPush(PRODUCTION_APP);
    process.exit(result.status ?? 1);
  }
  printHelp(target);
  process.exit(1);
}

const label = target === "staging" ? "staging" : "production";
if (forceReset) {
  console.log(`⚠️  Force-resetting ${label} database (all data will be lost)...\n`);
}

console.log(`Pushing schema to ${label} database...\n`);

const pushArgs = forceReset ? ["--force-reset", "--accept-data-loss"] : ["--accept-data-loss"];
const result = runPrismaDbPush({ ...process.env, DATABASE_URL: databaseUrl }, pushArgs);
process.exit(result.status ?? 1);
