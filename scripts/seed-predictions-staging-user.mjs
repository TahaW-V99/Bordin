#!/usr/bin/env node
/**
 * Staging-only: seed prediction results for 09182102583 on bordintest.ir.
 * Local:  node scripts/seed-predictions-staging-user.mjs
 * Remote: liara shell --app bordintest --command "node scripts/seed-predictions-staging-user.mjs"
 */
import { existsSync, readFileSync } from "node:fs";
import {
  CompetitionType,
  MatchStatus,
  PrismaClient,
} from "@prisma/client";

const PHONE = "09182102583";
const TOTAL_PREDICTIONS = 320;
const PERFECT_PREDICTIONS = 18;
const EXTERNAL_ID_PREFIX = "staging-seed-9182102583-";
const BATCH_SIZE = 40;

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

for (const path of [".env.staging", ".env.staging.local"]) {
  for (const [key, value] of Object.entries(parseEnvFile(path))) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function assertStagingOnly() {
  const dbUrl = (process.env.DATABASE_URL ?? "").toLowerCase();
  const bordinEnv = (process.env.BORDIN_ENV ?? "").toLowerCase();

  const onStagingServer =
    bordinEnv === "staging" ||
    dbUrl.includes("bordindbtest") ||
    dbUrl.includes("xenodochial");

  if (!onStagingServer) {
    throw new Error("فقط روی staging (bordintest) اجرا شود.");
  }

  if (dbUrl.includes("naughty_shannon")) {
    throw new Error("DATABASE_URL شبیه production است — اجرا متوقف شد.");
  }
}

const prisma = new PrismaClient();

function daysAgo(days, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function cleanupUserPredictions(userId) {
  const all = await prisma.prediction.findMany({
    where: { userId },
    select: { id: true, matchId: true, match: { select: { externalId: true } } },
  });

  if (all.length === 0) return;

  const seededMatchIds = all
    .filter((p) => p.match.externalId?.startsWith(EXTERNAL_ID_PREFIX))
    .map((p) => p.matchId);

  await prisma.prediction.deleteMany({ where: { userId } });

  if (seededMatchIds.length > 0) {
    await prisma.footballMatch.deleteMany({
      where: { id: { in: [...new Set(seededMatchIds)] } },
    });
  }

  console.log(`✓ ${all.length} پیش‌بینی قبلی کاربر حذف شد.`);
}

async function main() {
  assertStagingOnly();

  const user = await prisma.user.findUnique({
    where: { phone: PHONE },
    include: { profile: true },
  });

  if (!user) {
    throw new Error(
      `کاربر ${PHONE} روی staging یافت نشد. ابتدا در bordintest.ir لاگین کنید.`,
    );
  }

  console.log(
    `Seeding ${TOTAL_PREDICTIONS} predictions (${PERFECT_PREDICTIONS} × 100%) for ${PHONE}`,
  );

  await cleanupUserPredictions(user.id);

  let created = 0;

  for (let batchStart = 0; batchStart < TOTAL_PREDICTIONS; batchStart += BATCH_SIZE) {
    const batchCount = Math.min(BATCH_SIZE, TOTAL_PREDICTIONS - batchStart);

    for (let i = 0; i < batchCount; i++) {
      const index = batchStart + i;
      const isPerfect = index < PERFECT_PREDICTIONS;
      const dayOffset = index % 7;
      const kickoffAt = daysAgo(dayOffset, 18 + (index % 5));
      const submittedAt = new Date(kickoffAt.getTime() - 2 * 60 * 60 * 1000);
      const scoredAt = new Date(kickoffAt.getTime() + 2 * 60 * 60 * 1000);

      const homeScore = 2 + (index % 3);
      const awayScore = isPerfect ? 1 : index % 2;
      const homePrediction = isPerfect ? homeScore : homeScore === 2 ? 1 : 2;
      const awayPrediction = isPerfect ? awayScore : awayScore === 1 ? 0 : 1;
      const accuracyPercent = isPerfect ? 100 : 40 + (index % 50);

      const match = await prisma.footballMatch.create({
        data: {
          homeTeamName: `تیم الف ${index + 1}`,
          awayTeamName: `تیم ب ${index + 1}`,
          leagueName: "لیگ تست staging",
          kickoffAt,
          homeScore,
          awayScore,
          status: MatchStatus.FINISHED,
          scoresUpdatedAt: scoredAt,
          externalId: `${EXTERNAL_ID_PREFIX}${index}`,
        },
      });

      await prisma.prediction.create({
        data: {
          userId: user.id,
          matchId: match.id,
          competitionType: CompetitionType.DAILY,
          competitionRefId: null,
          homePrediction,
          awayPrediction,
          entryFeeCoins: 0,
          accuracyPercent,
          coinsEarned: isPerfect ? 1200 : Math.max(0, Math.floor(accuracyPercent * 2)),
          xpEarned: isPerfect ? 900 : Math.max(0, Math.floor(accuracyPercent * 1.5)),
          scoredAt,
          submittedAt,
        },
      });

      created += 1;
    }

    console.log(`  … ${created}/${TOTAL_PREDICTIONS}`);
  }

  const since = daysAgo(7, 0);
  since.setHours(0, 0, 0, 0);

  const [last7Count, perfectCount, totalCount, perfectAll] = await Promise.all([
    prisma.prediction.count({
      where: { userId: user.id, submittedAt: { gte: since } },
    }),
    prisma.prediction.count({
      where: {
        userId: user.id,
        accuracyPercent: 100,
        scoredAt: { not: null },
        submittedAt: { gte: since },
      },
    }),
    prisma.prediction.count({ where: { userId: user.id } }),
    prisma.prediction.count({
      where: { userId: user.id, accuracyPercent: 100, scoredAt: { not: null } },
    }),
  ]);

  await prisma.userProfile.update({
    where: { userId: user.id },
    data: {
      totalPredictions: totalCount,
      perfectPredictions: perfectAll,
    },
  });

  console.log(`✓ ${created} پیش‌بینی جدید ثبت شد.`);
  console.log(`✓ ۷ روز اخیر: ${last7Count} | ۱۰۰٪ (۷ روز): ${perfectCount}`);
  console.log(`✓ پروفایل — total: ${totalCount}, perfect: ${perfectAll}`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
