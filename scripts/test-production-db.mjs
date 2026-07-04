#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

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

const url = parseEnvFile(".env.production.local").DATABASE_URL?.trim();
if (!url) {
  console.error("Missing .env.production.local DATABASE_URL");
  process.exit(1);
}

const parsed = new URL(url);
const hosts = [parsed.hostname, "logan.liara.cloud", "bordindb.liara.cloud"];
const port = Number(parsed.port || 3306);

for (const host of [...new Set(hosts)]) {
  const adapter = new PrismaMariaDb({
    host,
    port,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectTimeout: 8000,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const count = await prisma.dailyKandakator.count();
    console.log(`OK host=${host} port=${port} kandakators=${count}`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL host=${host} port=${port} ${message.split("\n")[0]}`);
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  }
}

process.exit(1);
