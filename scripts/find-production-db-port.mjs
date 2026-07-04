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

const merged = { ...parseEnvFile(".env"), ...parseEnvFile(".env.production.local") };
const internalUrl = merged.DATABASE_URL?.trim();
if (!internalUrl) {
  console.error("DATABASE_URL not found");
  process.exit(1);
}

const parsed = new URL(internalUrl);
const password = decodeURIComponent(parsed.password);
const database = parsed.pathname.replace(/^\//, "");
const host = process.env.LIARA_DB_PUBLIC_HOST?.trim() || "logan.liara.cloud";
const ports = (process.env.LIARA_DB_PUBLIC_PORTS || "34080,34081,34082,34083,34084,34085,34086,34087,34088,34089,34090")
  .split(",")
  .map((p) => Number(p.trim()))
  .filter(Boolean);

for (const port of ports) {
  const adapter = new PrismaMariaDb({
    host,
    port,
    user: decodeURIComponent(parsed.username),
    password,
    database,
    connectTimeout: 5000,
  });
  const prisma = new PrismaClient({ adapter });
  try {
    const count = await prisma.dailyKandakator.count();
    const publicUrl = `mysql://${parsed.username}:${parsed.password}@${host}:${port}/${database}`;
    console.log(JSON.stringify({ host, port, database, count, publicUrl }));
    await prisma.$disconnect();
    process.exit(0);
  } catch {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  }
}

console.error("No working public port found. Enable Public Network in Liara panel for bordindb.");
process.exit(1);
