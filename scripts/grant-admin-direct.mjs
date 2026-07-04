#!/usr/bin/env node
/**
 * Grant admin via direct Prisma connection (public DATABASE_URL on your PC).
 * Requires .env.production.local — see .env.production.local.example
 */
import { existsSync, readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

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

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  if (digits.startsWith("09") && digits.length === 11) return digits;
  return digits;
}

function loadProductionDatabaseUrl() {
  const merged = {
    ...parseEnvFile(".env"),
    ...parseEnvFile(".env.production.local"),
  };
  return merged.DATABASE_URL?.trim() ?? "";
}

const phones = process.argv.slice(2);
if (phones.length === 0) {
  console.error("Usage: node scripts/grant-admin-direct.mjs <phone> [phone...]");
  process.exit(1);
}

const databaseUrl = loadProductionDatabaseUrl();
if (!databaseUrl) {
  console.error("DATABASE_URL not found. Create .env.production.local (see .env.production.local.example).");
  process.exit(1);
}

if (INTERNAL_HOSTS.some((host) => databaseUrl.includes(`@${host}`))) {
  console.error("DATABASE_URL uses Liara internal host and is not reachable from your PC.");
  console.error("Add the public MySQL URL from Liara → Databases → bordindb → Public Network.");
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;

function createPrisma() {
  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

try {
  for (const rawPhone of phones) {
    const phone = normalizePhone(rawPhone);
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, username: true, role: true },
    });

    if (!user) {
      console.log(`NOT_FOUND: ${phone}`);
      continue;
    }

    console.log(`BEFORE: ${JSON.stringify(user)}`);
    const updated = await prisma.user.update({
      where: { phone },
      data: { role: "admin" },
      select: { id: true, phone: true, username: true, role: true },
    });
    console.log(`AFTER: ${JSON.stringify(updated)}`);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
