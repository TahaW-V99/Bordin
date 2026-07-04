#!/usr/bin/env node
/**
 * One-off production grants for specific users on bordin.ir.
 * Usage: node scripts/apply-production-user-grants.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const GRANT_REF = "admin-grant-2026-07-01";
const MEDAL_REF_PREFIX = "admin-grant";

const CUP_TITLE_TO_SLUG = {
  مهاجم: "cup-normal-60",
  گلزن: "cup-normal-70",
  ستاره: "cup-normal-80",
  آذرخش: "cup-normal-90",
  فاتح: "cup-normal-100",
  سایه: "cup-legend-50",
  کمین: "cup-legend-60",
  طوفان: "cup-legend-70",
  شکار: "cup-legend-80",
  تاج: "cup-legend-90",
  اسطوره: "cup-legend-100",
};

const MISSION_HONOR_TO_SLUG = {
  "وفادار برنز": "vafadar-bronze",
  "وفادار نقره": "vafadar-silver",
  "وفادار طلایی": "vafadar-gold",
  "شکارچی برنز": "sheykarchee-bronze",
  "شکارچی نقره": "sheykarchee-silver",
  "شکارچی طلایی": "sheykarchee-gold",
};

const TARGETS = [
  {
    phone: "9339006248",
    displayName: "صدرا13",
    sellableCoins: 1000,
    systemCoins: 5000,
    purchasedCoins: 0,
    points: 60000,
    inviteCount: 8,
    predictionCount: 116,
    perfectPredictionCount: 9,
    cupMedals: "اسطوره",
    tournamentMedals: "ندارد",
    missionHonors: "وفادار برنز",
  },
  {
    displayName: "حسین ظهرابی",
    sellableCoins: 1000,
    systemCoins: 5000,
    purchasedCoins: 0,
    points: 12000,
    inviteCount: 0,
    predictionCount: 15,
    perfectPredictionCount: 1,
    cupMedals: "ندارد",
    tournamentMedals: "ندارد",
    missionHonors: "ندارد",
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

function isNone(value) {
  return ["ندارد", "نداره", "خالی", ""].includes(String(value ?? "").trim());
}

function parseCupSlugs(value) {
  if (isNone(value)) return [];
  const label = String(value).trim();
  return CUP_TITLE_TO_SLUG[label] ? [CUP_TITLE_TO_SLUG[label]] : [];
}

function parseMissionSlugs(value) {
  if (isNone(value)) return [];
  const label = String(value).trim();
  return MISSION_HONOR_TO_SLUG[label] ? [MISSION_HONOR_TO_SLUG[label]] : [];
}

function inviteStubPhone(key, index) {
  return `grant-inv-${key}-${index}`;
}

function createPrisma() {
  const merged = { ...parseEnvFile(".env"), ...parseEnvFile(".env.production.local") };
  const databaseUrl = merged.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL not found in .env.production.local");
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

async function findUser(prisma, target) {
  if (target.phone) {
    const user = await prisma.user.findFirst({
      where: { phone: { in: phoneVariants(target.phone) } },
      include: { profile: true, wallet: true },
    });
    if (user) return user;
  }

  const users = await prisma.user.findMany({
    where: {
      profile: {
        displayName: { contains: target.displayName },
      },
    },
    include: { profile: true, wallet: true },
    take: 5,
  });

  if (users.length === 1) return users[0];
  if (users.length > 1) {
    const exact = users.find((u) => u.profile?.displayName === target.displayName);
    if (exact) return exact;
    throw new Error(`چند کاربر برای «${target.displayName}» یافت شد`);
  }

  throw new Error(`کاربر «${target.displayName}» یافت نشد`);
}

async function applyMedals(tx, userId, key, slugs) {
  for (const slug of slugs) {
    const medal = await tx.medal.findUnique({ where: { slug } });
    if (!medal) throw new Error(`مدال ${slug} یافت نشد`);

    const referenceId = `${MEDAL_REF_PREFIX}:${slug}`;
    const existing = await tx.userMedal.findFirst({
      where: { userId, medalId: medal.id, referenceId },
    });
    if (existing) continue;

    await tx.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
        referenceId,
        earnedReason: `اعطای دستی (${GRANT_REF})`,
      },
    });
  }
}

async function applyInvites(tx, inviterId, key, targetCount) {
  const existingCount = await tx.inviteLog.count({ where: { inviterId } });
  if (existingCount >= targetCount) return;

  for (let index = existingCount; index < targetCount; index += 1) {
    const stubPhone = inviteStubPhone(key, index);
    let stubUser = await tx.user.findUnique({ where: { phone: stubPhone } });
    if (!stubUser) {
      stubUser = await tx.user.create({
        data: {
          phone: stubPhone,
          username: `grant_inv_${key}_${index}`,
          isActive: false,
          profile: { create: { displayName: stubPhone } },
          wallet: { create: {} },
        },
      });
    }

    const existingLog = await tx.inviteLog.findUnique({ where: { inviteeId: stubUser.id } });
    if (existingLog) continue;

    await tx.inviteLog.create({
      data: { inviterId, inviteeId: stubUser.id, coinsAwarded: 0, xpAwarded: 0 },
    });
  }
}

async function resolveLevelId(tx, totalXp) {
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => totalXp >= entry.xpThreshold) ?? levels.at(-1);
  return level?.id ?? null;
}

async function applyTarget(prisma, target) {
  const user = await findUser(prisma, target);
  if (!user.wallet) throw new Error("کیف پول یافت نشد");

  const key = target.phone ?? target.displayName.replace(/\s+/g, "_");
  const medalSlugs = [
    ...parseCupSlugs(target.cupMedals),
    ...parseMissionSlugs(target.missionHonors),
  ];

  await prisma.$transaction(async (tx) => {
    if (target.displayName && user.profile?.displayName !== target.displayName) {
      await tx.userProfile.update({
        where: { userId: user.id },
        data: { displayName: target.displayName },
      });
    }

    await tx.coinWallet.update({
      where: { userId: user.id },
      data: {
        predictionRewardCoins: target.sellableCoins,
        systemRewardCoins: target.systemCoins,
        purchasedCoins: target.purchasedCoins,
      },
    });

    const levelId = await resolveLevelId(tx, target.points);
    const profile = await tx.userProfile.findUnique({ where: { userId: user.id } });
    const xpDelta = target.points - (profile?.totalXp ?? 0);

    await tx.userProfile.update({
      where: { userId: user.id },
      data: {
        totalXp: target.points,
        currentLevelId: levelId,
        totalPredictions: target.predictionCount,
        perfectPredictions: target.perfectPredictionCount,
      },
    });

    if (xpDelta !== 0) {
      await tx.xpTransaction.create({
        data: {
          userId: user.id,
          amount: xpDelta,
          type: "ADMIN_ADJUSTMENT",
          referenceId: `${GRANT_REF}:${key}`,
          description: "تنظیم دستی امتیاز",
        },
      });
    }

    await applyMedals(tx, user.id, key, medalSlugs);
    await applyInvites(tx, user.id, key, target.inviteCount);
  });

  const updated = await prisma.user.findUnique({
    where: { id: user.id },
    include: { profile: true, wallet: true },
  });

  const inviteCount = await prisma.inviteLog.count({ where: { inviterId: user.id } });
  const medals = await prisma.userMedal.findMany({
    where: { userId: user.id },
    include: { medal: true },
  });

  return {
    phone: updated?.phone,
    displayName: updated?.profile?.displayName,
    wallet: {
      sellable: updated?.wallet?.predictionRewardCoins,
      system: updated?.wallet?.systemRewardCoins,
      purchased: updated?.wallet?.purchasedCoins,
    },
    totalXp: updated?.profile?.totalXp,
    totalPredictions: updated?.profile?.totalPredictions,
    perfectPredictions: updated?.profile?.perfectPredictions,
    inviteCount,
    medals: medals.map((m) => m.medal.slug),
  };
}

async function main() {
  const prisma = createPrisma();
  const results = [];

  for (const target of TARGETS) {
    console.log(`Applying grants for ${target.displayName}...`);
    try {
      const result = await applyTarget(prisma, target);
      results.push({ ok: true, ...result });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, displayName: target.displayName, error: message });
      console.error(`FAILED ${target.displayName}: ${message}`);
    }
  }

  await prisma.$disconnect();

  if (results.some((r) => !r.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
