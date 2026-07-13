#!/usr/bin/env node
/**
 * Reconcile wrongly-settled kandakator matches after final scores arrive.
 *
 * Usage:
 *   liara shell --app bordin --command "node prisma/reconcile-yesterday-kandakator-results.mjs --inspect"
 *   liara shell --app bordin --command "node prisma/reconcile-yesterday-kandakator-results.mjs --sync-scores"
 *   liara shell --app bordin --command "node prisma/reconcile-yesterday-kandakator-results.mjs --apply"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { CoinTransactionType, CoinType, PrismaClient, XpTransactionType } from "@prisma/client";
import {
  bucketAccuracy,
  calculatePredictionAccuracy,
} from "./lib/prediction-accuracy.mjs";

const TARGET_MATCHES = [
  [["انگلیس", "England"], ["کنگو", "Congo"]],
  [["بلژیک", "Belgium"], ["سنگال", "Senegal"]],
  [["امریکا", "آمریکا", "USA", "United States"], ["Bosnia", "Herzegovina", "Bosnia-Herzegovina", "بوسنی"]],
];

/** Verified final scores when Fixture API fulltime is stale or missing. */
const MANUAL_FINAL_SCORES = [
  {
    homeAliases: ["امریکا", "آمریکا", "USA", "United States"],
    awayAliases: ["Bosnia", "Herzegovina", "Bosnia-Herzegovina", "بوسنی"],
    homeScore: 2,
    awayScore: 0,
  },
];

function assertProductionOnly() {
  const dbUrl = (process.env.DATABASE_URL ?? "").toLowerCase();
  if (dbUrl.includes("bordindbtest") || dbUrl.includes("xenodochial")) {
    throw new Error("این اسکریپت فقط برای production (bordin.ir) است.");
  }
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

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamNameMatches(name, aliases) {
  const hay = normalize(name);
  return aliases.some((alias) => hay.includes(normalize(alias)));
}

function matchIsTarget(match) {
  return TARGET_MATCHES.some(([aAliases, bAliases]) => {
    const home = match.homeTeamName ?? "";
    const away = match.awayTeamName ?? "";
    return (
      (teamNameMatches(home, aAliases) && teamNameMatches(away, bAliases)) ||
      (teamNameMatches(home, bAliases) && teamNameMatches(away, aAliases))
    );
  });
}

function parseApiMatchId(externalId) {
  const tail = String(externalId ?? "").split("-").pop();
  const id = Number(tail);
  return Number.isFinite(id) ? id : null;
}

function getApiKey() {
  return process.env.FIXTURE_API_KEY?.trim() ?? "";
}

function mapApiFixture(row) {
  const short = row.fixture?.status?.short ?? "NS";
  const isFinished = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
  const regularHome = row.goals?.home ?? row.score?.halftime?.home ?? null;
  const regularAway = row.goals?.away ?? row.score?.halftime?.away ?? null;
  const fullHome = row.score?.fulltime?.home ?? null;
  const fullAway = row.score?.fulltime?.away ?? null;
  return {
    status: short,
    score: {
      fullTime: isFinished ? { home: fullHome, away: fullAway } : undefined,
      regularTime: { home: regularHome, away: regularAway },
    },
  };
}

function readMatchScoreFromApi(apiMatch) {
  const fullTime = apiMatch.score?.fullTime;
  const regularTime = apiMatch.score?.regularTime;
  const isFinished = ["FT", "AET", "PEN", "AWD", "WO"].includes(apiMatch.status);

  if (isFinished) {
    if (fullTime?.home != null && fullTime?.away != null) {
      return { homeScore: fullTime.home, awayScore: fullTime.away, status: "FINISHED" };
    }
    return { homeScore: null, awayScore: null, status: "FINISHED" };
  }

  if (regularTime?.home != null && regularTime?.away != null) {
    return { homeScore: regularTime.home, awayScore: regularTime.away, status: "LIVE" };
  }

  return { homeScore: null, awayScore: null, status: "SCHEDULED" };
}

function resolveManualFinalScore(match) {
  for (const entry of MANUAL_FINAL_SCORES) {
    const home = match.homeTeamName ?? "";
    const away = match.awayTeamName ?? "";
    const direct =
      teamNameMatches(home, entry.homeAliases) && teamNameMatches(away, entry.awayAliases);
    const swapped =
      teamNameMatches(home, entry.awayAliases) && teamNameMatches(away, entry.homeAliases);
    if (direct) {
      return { homeScore: entry.homeScore, awayScore: entry.awayScore };
    }
    if (swapped) {
      return { homeScore: entry.awayScore, awayScore: entry.homeScore };
    }
  }
  return null;
}

async function fetchApiMatch(apiMatchId) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("FIXTURE_API_KEY در env تنظیم نشده است");
  }

  const apiBase = process.env.FIXTURE_API_BASE_URL?.trim() || "https://v3.football.api-sports.io";
  const res = await fetch(`${apiBase}/fixtures?id=${apiMatchId}`, {
    headers: { "x-apisports-key": apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Fixture API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const row = json.response?.[0];
  if (!row) throw new Error(`Fixture API: match ${apiMatchId} not found`);
  return mapApiFixture(row);
}

async function resolveRewardMeta(prisma, prediction, accuracy) {
  let slug = "daily-prediction";
  let coinType = CoinTransactionType.PREDICTION_REWARD;
  let xpType = XpTransactionType.PREDICTION;
  if (prediction.competitionType === "CUP" && prediction.competitionRefId) {
    const cup = await prisma.cup.findUnique({
      where: { id: prediction.competitionRefId },
      select: { mode: true },
    });
    slug = cup?.mode === "LEGEND" ? "cup-legend" : "cup-normal";
    coinType = CoinTransactionType.CUP_REWARD;
    xpType = XpTransactionType.CUP;
  } else if (prediction.competitionType === "TOURNAMENT") {
    slug = "tournament-fath";
    coinType = CoinTransactionType.TOURNAMENT_REWARD;
    xpType = XpTransactionType.TOURNAMENT;
  }

  const table = await prisma.rewardTable.findUnique({
    where: { slug },
    include: { tiers: { include: { medal: true } } },
  });
  if (!table) throw new Error(`Reward table not found: ${slug}`);

  const bucket = bucketAccuracy(accuracy);
  const tier =
    table.tiers.find((item) => item.accuracyPercent === bucket) ??
    table.tiers.find((item) => item.accuracyPercent === 0);
  if (!tier) throw new Error(`Reward tier missing for table ${slug}`);

  return {
    slug,
    bucket,
    coins: tier.coins,
    xp: tier.xp,
    medal: tier.medal ?? null,
    coinType,
    xpType,
  };
}

async function recalcProfileLevel(tx, userId) {
  const profile = await tx.userProfile.findUnique({
    where: { userId },
    select: { totalXp: true },
  });
  if (!profile) return;
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((item) => profile.totalXp >= item.xpThreshold) ?? levels.at(-1) ?? null;
  await tx.userProfile.update({
    where: { userId },
    data: { ...(level ? { currentLevelId: level.id } : {}) },
  });
}

async function findTargetMatches(prisma, statusFilter) {
  const matches = await prisma.footballMatch.findMany({
    where: statusFilter,
    orderBy: { kickoffAt: "desc" },
    take: 200,
  });
  return matches.filter(matchIsTarget);
}

async function inspect(prisma) {
  const targets = await findTargetMatches(prisma, { status: { in: ["LIVE", "FINISHED"] } });
  console.log(
    JSON.stringify(
      targets.map((match) => ({
        id: match.id,
        externalId: match.externalId,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        kickoffAt: match.kickoffAt,
        manualFinal: resolveManualFinalScore(match),
      })),
      null,
      2,
    ),
  );
}

async function syncScores(prisma) {
  const targets = await findTargetMatches(prisma, { status: { in: ["LIVE", "FINISHED", "SCHEDULED"] } });
  const report = [];

  for (const match of targets) {
    let nextHome = match.homeScore;
    let nextAway = match.awayScore;
    let nextStatus = match.status;
    let source = "unchanged";

    const apiMatchId = parseApiMatchId(match.externalId);
    if (apiMatchId) {
      try {
        const apiMatch = await fetchApiMatch(apiMatchId);
        const parsed = readMatchScoreFromApi(apiMatch);
        if (parsed.homeScore !== null && parsed.awayScore !== null) {
          nextHome = parsed.homeScore;
          nextAway = parsed.awayScore;
          nextStatus = parsed.status === "FINISHED" ? "FINISHED" : match.status;
          source = "api-fullTime";
        }
      } catch (error) {
        report.push({
          match: `${match.homeTeamName} - ${match.awayTeamName}`,
          warning: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const manual = resolveManualFinalScore(match);
    if (
      manual &&
      (nextHome !== manual.homeScore ||
        nextAway !== manual.awayScore ||
        nextHome === null ||
        nextAway === null)
    ) {
      nextHome = manual.homeScore;
      nextAway = manual.awayScore;
      nextStatus = "FINISHED";
      source = source === "unchanged" ? "manual" : `${source}+manual`;
    }

    if (nextHome === null || nextAway === null) {
      report.push({
        match: `${match.homeTeamName} - ${match.awayTeamName}`,
        skipped: true,
        reason: "final score unavailable",
      });
      continue;
    }

    if (
      match.homeScore === nextHome &&
      match.awayScore === nextAway &&
      match.status === nextStatus
    ) {
      report.push({
        match: `${match.homeTeamName} - ${match.awayTeamName}`,
        skipped: true,
        reason: "already correct",
        homeScore: nextHome,
        awayScore: nextAway,
      });
      continue;
    }

    await prisma.footballMatch.update({
      where: { id: match.id },
      data: {
        homeScore: nextHome,
        awayScore: nextAway,
        status: nextStatus,
        scoresUpdatedAt: new Date(),
      },
    });

    report.push({
      match: `${match.homeTeamName} - ${match.awayTeamName}`,
      source,
      old: { homeScore: match.homeScore, awayScore: match.awayScore, status: match.status },
      new: { homeScore: nextHome, awayScore: nextAway, status: nextStatus },
    });
  }

  console.log(JSON.stringify({ synced: report.filter((item) => !item.skipped).length, report }, null, 2));
}

async function apply(prisma) {
  const targets = await findTargetMatches(prisma, { status: "FINISHED" });
  if (targets.length === 0) {
    throw new Error("هیچ‌کدام از سه بازی هدف با وضعیت FINISHED پیدا نشد.");
  }

  const report = [];
  for (const match of targets) {
    if (match.homeScore === null || match.awayScore === null) {
      throw new Error(`نتیجه نهایی بازی ${match.homeTeamName} - ${match.awayTeamName} هنوز کامل نیست.`);
    }

    const predictions = await prisma.prediction.findMany({
      where: { matchId: match.id, scoredAt: { not: null } },
      include: { user: { select: { id: true } } },
    });

    for (const prediction of predictions) {
      const oldCoins = prediction.coinsEarned ?? 0;
      const oldXp = prediction.xpEarned ?? 0;
      const oldAccuracy = prediction.accuracyPercent ?? 0;
      const oldPerfect = oldAccuracy === 100;

      const newAccuracy = calculatePredictionAccuracy(
        prediction.homePrediction,
        prediction.awayPrediction,
        match.homeScore,
        match.awayScore,
      );
      const reward = await resolveRewardMeta(prisma, prediction, newAccuracy);
      const newPerfect = newAccuracy === 100;
      const coinsDelta = reward.coins - oldCoins;
      const xpDelta = reward.xp - oldXp;

      await prisma.$transaction(async (tx) => {
        await tx.prediction.update({
          where: { id: prediction.id },
          data: {
            accuracyPercent: newAccuracy,
            coinsEarned: reward.coins,
            xpEarned: reward.xp,
            medalId: reward.medal?.id ?? null,
            scoredAt: prediction.scoredAt ?? new Date(),
          },
        });

        if (coinsDelta !== 0) {
          const wallet = await tx.coinWallet.update({
            where: { userId: prediction.userId },
            data: { predictionRewardCoins: { increment: coinsDelta } },
          });
          const balance =
            wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
          await tx.coinTransaction.create({
            data: {
              walletId: wallet.id,
              coinType: CoinType.PREDICTION_REWARD,
              amount: coinsDelta,
              balanceAfter: balance,
              type: CoinTransactionType.ADMIN_ADJUSTMENT,
              description: `اصلاح تسویه پیش‌بینی ${match.homeTeamName} - ${match.awayTeamName}`,
            },
          });
        }

        if (xpDelta !== 0) {
          await tx.userProfile.update({
            where: { userId: prediction.userId },
            data: { totalXp: { increment: xpDelta } },
          });
          await tx.xpTransaction.create({
            data: {
              userId: prediction.userId,
              amount: xpDelta,
              type: XpTransactionType.ADMIN_ADJUSTMENT,
              description: `اصلاح XP پیش‌بینی ${match.homeTeamName} - ${match.awayTeamName}`,
              referenceId: prediction.id,
            },
          });
          await recalcProfileLevel(tx, prediction.userId);
        }

        if (oldPerfect !== newPerfect) {
          await tx.userProfile.update({
            where: { userId: prediction.userId },
            data: {
              perfectPredictions: {
                increment: newPerfect ? 1 : -1,
              },
            },
          });
        }

        await tx.userMedal.deleteMany({
          where: {
            userId: prediction.userId,
            referenceId: prediction.id,
          },
        });

        if (reward.medal) {
          await tx.userMedal.create({
            data: {
              userId: prediction.userId,
              medalId: reward.medal.id,
              earnedReason: "اصلاح تسویه پیش‌بینی",
              referenceId: prediction.id,
            },
          });
        }
      });

      report.push({
        match: `${match.homeTeamName} - ${match.awayTeamName}`,
        predictionId: prediction.id,
        userId: prediction.userId,
        oldAccuracy,
        newAccuracy,
        oldCoins,
        newCoins: reward.coins,
        oldXp,
        newXp: reward.xp,
      });
    }
  }

  console.log(JSON.stringify({ updated: report.length, report }, null, 2));
}

async function main() {
  const inspectMode = process.argv.includes("--inspect");
  const syncScoresMode = process.argv.includes("--sync-scores");
  const applyMode = process.argv.includes("--apply");
  if (!inspectMode && !syncScoresMode && !applyMode) {
    console.error(
      "Usage: node prisma/reconcile-yesterday-kandakator-results.mjs --inspect|--sync-scores|--apply",
    );
    process.exit(1);
  }

  assertProductionOnly();
  const prisma = createPrisma();
  try {
    if (inspectMode) {
      await inspect(prisma);
      return;
    }
    if (syncScoresMode) {
      await syncScores(prisma);
      return;
    }
    await apply(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
