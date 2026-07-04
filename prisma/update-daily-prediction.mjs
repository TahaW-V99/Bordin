#!/usr/bin/env node
/**
 * Update a user's daily kandakator prediction on production.
 *   liara shell --app bordin --command "node prisma/update-daily-prediction.mjs"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const PHONE = "9376910074";
const HOME_TEAM_MATCH = "بلژیک";
const AWAY_TEAM_MATCH = "غنا";
const NEW_HOME = 2;
const NEW_AWAY = 1;
const OLD_HOME = 0;
const OLD_AWAY = 0;

function phoneVariants(phone) {
  const trimmed = phone.trim();
  const phones = new Set([trimmed]);
  if (/^9\d{9}$/.test(trimmed)) phones.add(`0${trimmed}`);
  if (/^09\d{9}$/.test(trimmed)) phones.add(trimmed.slice(1));
  return [...phones];
}

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
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

function isBelgiumGhanaMatch(match) {
  const home = match.homeTeamName;
  const away = match.awayTeamName;
  const hasBelgium =
    home.includes(HOME_TEAM_MATCH) ||
    away.includes(HOME_TEAM_MATCH) ||
    home.includes("Belgium") ||
    away.includes("Belgium");
  const hasGhana =
    home.includes(AWAY_TEAM_MATCH) ||
    away.includes(AWAY_TEAM_MATCH) ||
    home.includes("Ghana") ||
    away.includes("Ghana");
  return hasBelgium && hasGhana;
}

function resolveNewScore(match) {
  const belgiumHome =
    match.homeTeamName.includes(HOME_TEAM_MATCH) ||
    match.homeTeamName.includes("Belgium");
  return belgiumHome
    ? { homePrediction: NEW_HOME, awayPrediction: NEW_AWAY }
    : { homePrediction: NEW_AWAY, awayPrediction: NEW_HOME };
}

async function main() {
  const prisma = createPrisma();

  const user = await prisma.user.findFirst({
    where: { phone: { in: phoneVariants(PHONE) } },
    include: { profile: { select: { displayName: true } } },
  });
  if (!user) throw new Error(`کاربر ${PHONE} یافت نشد`);

  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: user.id,
      competitionType: "DAILY",
      homePrediction: OLD_HOME,
      awayPrediction: OLD_AWAY,
      scoredAt: null,
      match: { kickoffAt: { gte: recentCutoff } },
    },
    include: { match: true },
    orderBy: { submittedAt: "desc" },
  });

  const target = predictions.find((p) => isBelgiumGhanaMatch(p.match));
  if (!target) {
    const hints = predictions
      .slice(0, 5)
      .map(
        (p) =>
          `${p.match.homeTeamName}-${p.match.awayTeamName} ${p.homePrediction}-${p.awayPrediction} @ ${p.match.kickoffAt.toISOString()}`,
      )
      .join(" | ");
    throw new Error(
      hints
        ? `پیش‌بینی ۰-۰ برای بلژیک-غنا یافت نشد. سایر پیش‌بینی‌های ۰-۰: ${hints}`
        : "پیش‌بینی ۰-۰ اخیر برای این کاربر یافت نشد",
    );
  }

  const newScore = resolveNewScore(target.match);
  const updated = await prisma.prediction.update({
    where: { id: target.id },
    data: newScore,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        user: { phone: user.phone, displayName: user.profile?.displayName },
        match: {
          home: target.match.homeTeamName,
          away: target.match.awayTeamName,
          kickoffAt: target.match.kickoffAt.toISOString(),
        },
        before: `${OLD_HOME}-${OLD_AWAY}`,
        after: `${updated.homePrediction}-${updated.awayPrediction}`,
        predictionId: updated.id,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
