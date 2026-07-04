#!/usr/bin/env node
/**
 * One-off production bonuses.
 * Usage: node scripts/apply-production-user-bonus.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const GRANTS = [
  {
    phone: "09376910074",
    label: "صدرا",
    sellableDelta: 800,
    xpDelta: 552,
    systemDelta: 0,
    ref: "admin-bonus-2026-07-02-sadra",
  },
  {
    phone: "09010558858",
    label: "طاهاوی",
    sellableDelta: 0,
    xpDelta: 0,
    systemDelta: 1000,
    ref: "admin-bonus-2026-07-02-tahaavi",
  },
];

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

function phoneVariants(phone) {
  const trimmed = phone.trim();
  const phones = new Set([trimmed]);
  if (/^9\d{9}$/.test(trimmed)) phones.add(`0${trimmed}`);
  if (/^09\d{9}$/.test(trimmed)) phones.add(trimmed.slice(1));
  return [...phones];
}

function createPrisma() {
  const merged = { ...parseEnvFile(".env"), ...parseEnvFile(".env.production.local") };
  const databaseUrl = (merged.DATABASE_URL ?? process.env.DATABASE_URL)?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL not configured");
  if (databaseUrl.includes("bordindbtest")) {
    throw new Error("Refusing to run on staging database");
  }

  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectTimeout: 15000,
  });
  return new PrismaClient({ adapter });
}

async function resolveLevelId(tx, totalXp) {
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => totalXp >= entry.xpThreshold) ?? levels.at(-1);
  return level?.id ?? null;
}

async function applyGrant(prisma, grant) {
  const user = await prisma.user.findFirst({
    where: { phone: { in: phoneVariants(grant.phone) } },
    include: { wallet: true, profile: true },
  });
  if (!user?.wallet || !user.profile) {
    throw new Error(`کاربر ${grant.label} یافت نشد`);
  }

  const existing = await prisma.coinTransaction.findFirst({
    where: { referenceId: grant.ref },
  });
  if (existing) {
    return {
      ok: true,
      skipped: true,
      phone: user.phone,
      displayName: user.profile.displayName,
      ref: grant.ref,
    };
  }

  await prisma.$transaction(async (tx) => {
    let wallet = user.wallet;

    if (grant.sellableDelta > 0) {
      wallet = await tx.coinWallet.update({
        where: { userId: user.id },
        data: { predictionRewardCoins: { increment: grant.sellableDelta } },
      });
      await tx.coinTransaction.create({
        data: {
          walletId: wallet.id,
          coinType: "PREDICTION_REWARD",
          amount: grant.sellableDelta,
          balanceAfter:
            wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins,
          type: "ADMIN_ADJUSTMENT",
          referenceId: grant.ref,
          description: "افزایش دستی سکه قابل فروش",
        },
      });
    }

    if (grant.systemDelta > 0) {
      wallet = await tx.coinWallet.update({
        where: { userId: user.id },
        data: { systemRewardCoins: { increment: grant.systemDelta } },
      });
      await tx.coinTransaction.create({
        data: {
          walletId: wallet.id,
          coinType: "SYSTEM_REWARD",
          amount: grant.systemDelta,
          balanceAfter:
            wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins,
          type: "ADMIN_ADJUSTMENT",
          referenceId: grant.ref,
          description: "افزایش دستی سکه سیستمی",
        },
      });
    }

    if (grant.xpDelta > 0) {
      const nextXp = user.profile.totalXp + grant.xpDelta;
      const levelId = await resolveLevelId(tx, nextXp);
      await tx.userProfile.update({
        where: { userId: user.id },
        data: { totalXp: nextXp, currentLevelId: levelId },
      });
      await tx.xpTransaction.create({
        data: {
          userId: user.id,
          amount: grant.xpDelta,
          type: "ADMIN_ADJUSTMENT",
          referenceId: grant.ref,
          description: "افزایش دستی امتیاز",
        },
      });
    }
  });

  const refreshed = await prisma.user.findUnique({
    where: { id: user.id },
    include: { wallet: true, profile: true },
  });

  return {
    ok: true,
    skipped: false,
    phone: refreshed?.phone,
    displayName: refreshed?.profile?.displayName,
    sellableCoins: refreshed?.wallet?.predictionRewardCoins,
    systemCoins: refreshed?.wallet?.systemRewardCoins,
    totalXp: refreshed?.profile?.totalXp,
    added: {
      sellableCoins: grant.sellableDelta,
      systemCoins: grant.systemDelta,
      xp: grant.xpDelta,
    },
  };
}

const prisma = createPrisma();
const results = [];

try {
  for (const grant of GRANTS) {
    const result = await applyGrant(prisma, grant);
    results.push(result);
    console.log(JSON.stringify(result, null, 2));
  }
} finally {
  await prisma.$disconnect();
}

if (results.some((r) => !r.ok)) process.exitCode = 1;
