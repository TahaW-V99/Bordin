#!/usr/bin/env node
/**
 * Wrapper around Prisma CLI.
 * `db push` uses scripts/db-push.mjs (Liara shell / public URL).
 * Other commands forward to npx prisma with merged local env.
 *
 * Usage: npm run prisma -- db push
 *        npm run prisma -- migrate status
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

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

const args = process.argv.slice(2);

const INTERNAL_HOSTS = ["bordindb:3306", "bordindbtest:3306"];

function isInternalDatabaseUrl(url) {
  return INTERNAL_HOSTS.some((host) => url.includes(`@${host}`));
}

function printMigrateHelp() {
  console.error("\n❌ prisma migrate dev از روی PC به دیتابیس Liara وصل نمی‌شود.\n");
  console.error("این پروژه از migration فایل‌ها استفاده نمی‌کند؛ schema با db push همگام می‌شود.\n");
  console.error("به‌جای migrate dev یکی از این‌ها را بزنید:");
  console.error("  npm run db:push              ← production (خودکار از Liara shell)");
  console.error("  npm run db:push:staging      ← staging");
  console.error("  docker compose up -d && DATABASE_URL=mysql://bordin:bordin@localhost:3306/bordin npx prisma db push");
  console.error("\nبرای توسعه محلی بدون MySQL: DEV_MEMORY_DB=true در .env.local\n");
}

if (args[0] === "migrate") {
  const localEnv = mergeEnvFiles([".env", ".env.production.local", ".env.local"]);
  const databaseUrl = localEnv.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
  if (!databaseUrl || isInternalDatabaseUrl(databaseUrl)) {
    printMigrateHelp();
    process.exit(1);
  }
}

if (args[0] === "db" && args[1] === "push") {
  const staging = process.env.BORDIN_DB_TARGET === "staging";
  const result = spawnSync(
    "node",
    ["scripts/db-push.mjs", ...(staging ? ["staging"] : [])],
    { stdio: "inherit", shell: true },
  );
  process.exit(result.status ?? 1);
}

const localEnv = mergeEnvFiles([".env", ".env.production.local", ".env.local"]);
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, ...localEnv },
});
process.exit(result.status ?? 1);
