#!/usr/bin/env node
/**
 * Grant admin on production.
 *
 * 1) If .env.production.local has a public DATABASE_URL → direct DB update (recommended).
 * 2) Else → liara shell (requires deploy so prisma/grant-admin-production.mjs exists on server).
 *
 * Usage: node scripts/run-make-admin-production.mjs 0901... [0918...]
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const INTERNAL_HOSTS = ["bordindb:3306", "bordindbtest:3306"];

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

function hasPublicProductionDatabaseUrl() {
  const merged = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.production.local"),
  };
  const url = merged.DATABASE_URL?.trim();
  if (!url) return false;
  return !INTERNAL_HOSTS.some((host) => url.includes(`@${host}`));
}

function runLiaraGrant(phones) {
  const remoteCommand = `node prisma/grant-admin-production.mjs ${phones.join(" ")}`;
  // Liara CLI on Windows only keeps the first word of --command unless the full command is quoted.
  return spawnSync(`liara shell --app bordin --command "${remoteCommand}"`, {
    encoding: "utf8",
    shell: true,
  });
}

const phones = process.argv.slice(2);
if (phones.length === 0) {
  console.error("Usage: node scripts/run-make-admin-production.mjs <phone> [phone...]");
  process.exit(1);
}

if (!phones.every((p) => /^09\d{9}$/.test(p))) {
  console.error("Phone numbers must be Iranian mobile format, e.g. 09123456789");
  process.exit(1);
}

console.log(`Granting admin on bordin.ir for: ${phones.join(", ")}\n`);

if (hasPublicProductionDatabaseUrl()) {
  console.log("Using direct database connection (.env.production.local)...\n");
  const direct = spawnSync(process.execPath, ["scripts/grant-admin-direct.mjs", ...phones], {
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exit(direct.status ?? 0);
}

console.log("No public DATABASE_URL in .env.production.local — using Liara shell...\n");
const result = runLiaraGrant(phones);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!result.stdout?.includes("AFTER:") && !result.stdout?.includes("NOT_FOUND:")) {
  console.error("\n---");
  console.error("Liara command did not update the database.");
  console.error("");
  console.error("Option A (recommended): create .env.production.local with public DATABASE_URL");
  console.error("  Liara panel → Databases → bordindb → Public Network");
  console.error("  Then run this script again.");
  console.error("");
  console.error("Option B: deploy, then run:");
  console.error("  npm run deploy:production");
  console.error(
    `  liara shell --app bordin --command "node prisma/grant-admin-production.mjs ${phones.join(" ")}"`,
  );
  process.exit(1);
}

console.log("\nDone. Refresh profile or open https://bordin.ir/admin");
