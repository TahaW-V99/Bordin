#!/usr/bin/env node
/**
 * Undo premature World Cup quarter-final resolution and restore 4-team bracket.
 *
 *   node prisma/repair-world-cup-knockout.mjs --inspect
 *   node prisma/repair-world-cup-knockout.mjs --dry-run
 *   node prisma/repair-world-cup-knockout.mjs --apply
 *
 * Liara:
 *   liara shell --app bordin --command "node prisma/repair-world-cup-knockout.mjs --apply"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, CoinTransactionType, TeamRole } from "@prisma/client";

const COMPETITION_ID = "cmr1ykqvp00g50imxjuhofa4s";

/** ۲۰ تیر ۱۴۰۵ ۰۰:۰۰ تهران */
const CAPTAIN_AUDIT_START = new Date("2026-07-10T20:30:00.000Z");
/** ۲۷ تیر ۱۴۰۵ ۲۳:۵۹ تهران */
const QUARTER_ENDS_AT = new Date("2026-07-18T20:29:00.000Z");
/** ۲۸ تیر ۱۴۰۵ ۰۰:۰۰ تهران */
const FINAL_STARTS_AT = new Date("2026-07-18T20:30:00.000Z");
/** ۲۸ تیر ۱۴۰۵ ۲۳:۵۹ تهران */
const FINAL_ENDS_AT = new Date("2026-07-19T20:29:00.000Z");

const QUARTER_FINALISTS = ["جُغد پیر", "شیاطین سرخ", "آبی اناری ها", "ته جدولی"];
const WRONGLY_ELIMINATED = ["جُغد پیر", "ته جدولی"];
/** تیم‌هایی که باید هزینه پیش‌بینی کاپیتان برای اعضای بدون پیش‌بینی انفرادی کسر شود */
const FEE_RETROACTIVE_TEAMS = ["جُغد پیر", "شیاطین سرخ"];

const BASELINES = {
  "جُغد پیر": 14800,
  "شیاطین سرخ": 14100,
  "آبی اناری ها": 13516,
  "ته جدولی": 9092,
};

const LEAGUE_FA_MAP = {
  "FIFA World Cup": "جام جهانی",
  "World Cup": "جام جهانی",
};

const TEAM_NAME_ALIASES = {
  "آبی اناری‌ها": "آبی اناری ها",
  "جوغد پیر": "جُغد پیر",
  جغدپیر: "جُغد پیر",
};

function normalizeTeamName(name) {
  const trimmed = String(name ?? "").trim();
  return TEAM_NAME_ALIASES[trimmed] ?? trimmed;
}

function leagueNameToCompetitionId(leagueName) {
  const normalized = LEAGUE_FA_MAP[leagueName] ?? leagueName ?? "سایر";
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash % 1_000_000_000 || 1;
}

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

async function loadCompetition(prisma) {
  return prisma.teamCompetition.findUnique({
    where: { id: COMPETITION_ID },
    include: {
      knockoutRounds: {
        orderBy: { sortOrder: "asc" },
        include: { footballCompetitions: true },
      },
      entries: {
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, username: true, profile: { select: { displayName: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });
}

function requireEntry(comp, teamName) {
  const normalized = normalizeTeamName(teamName);
  const entry =
    comp.entries.find((row) => normalizeTeamName(row.team.name) === normalized) ??
    comp.entries.find((row) => row.team.name.includes(teamName.replace(/\s+/g, "")));
  if (!entry) throw new Error(`تیم «${teamName}» یافت نشد.`);
  return entry;
}

function getCaptainUserId(entry) {
  const captain = entry.team.members.find((m) => m.role === TeamRole.CAPTAIN);
  const owner = entry.team.members.find((m) => m.role === TeamRole.OWNER);
  return captain?.userId ?? owner?.userId ?? null;
}

async function loadRoundConfig(prisma, round) {
  if (!round?.startsAt || !round?.endsAt) return null;
  return {
    startsAt: round.startsAt,
    endsAt: round.endsAt,
    footballCompetitionIds: round.footballCompetitions.map((row) => row.footballCompetitionId),
    feePerMember: round.predictionFeePerMember,
  };
}

async function computeCaptainXp(prisma, captainUserId, config, windowStart, windowEnd) {
  if (!captainUserId || !config) return 0;

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: captainUserId,
      competitionType: "DAILY",
      OR: [{ scoredAt: { not: null } }, { xpEarned: { not: null } }],
      match: {
        kickoffAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    },
    select: {
      xpEarned: true,
      match: { select: { leagueName: true } },
    },
  });

  const leagueIds = new Set(config.footballCompetitionIds);
  return predictions
    .filter((row) => leagueIds.has(leagueNameToCompetitionId(row.match.leagueName ?? "سایر")))
    .reduce((sum, row) => sum + (row.xpEarned ?? 0), 0);
}

async function listCaptainPredictions(prisma, captainUserId, config, windowStart, windowEnd) {
  if (!captainUserId || !config) return [];

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: captainUserId,
      competitionType: "DAILY",
      match: {
        kickoffAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    },
    select: {
      id: true,
      matchId: true,
      xpEarned: true,
      scoredAt: true,
      homePrediction: true,
      awayPrediction: true,
      match: { select: { kickoffAt: true, leagueName: true } },
    },
    orderBy: { match: { kickoffAt: "asc" } },
  });

  const leagueIds = new Set(config.footballCompetitionIds);
  return predictions.filter((row) =>
    leagueIds.has(leagueNameToCompetitionId(row.match.leagueName ?? "سایر")),
  );
}

async function deductCoins(tx, userId, amount, matchId, description) {
  const wallet = await tx.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error(`کیف پول کاربر ${userId} یافت نشد`);

  const total = wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
  if (total < amount) {
    return { ok: false, balance: total };
  }

  let remaining = amount;
  let predDeduct = 0;
  let sysDeduct = 0;
  let purchDeduct = 0;

  const spendFrom = (available, type) => {
    const take = Math.min(available, remaining);
    remaining -= take;
    if (type === "pred") predDeduct += take;
    if (type === "sys") sysDeduct += take;
    if (type === "purch") purchDeduct += take;
  };

  spendFrom(wallet.purchasedCoins, "purch");
  spendFrom(wallet.systemRewardCoins, "sys");
  spendFrom(wallet.predictionRewardCoins, "pred");

  const updatedWallet = await tx.coinWallet.update({
    where: { userId },
    data: {
      purchasedCoins: wallet.purchasedCoins - purchDeduct,
      systemRewardCoins: wallet.systemRewardCoins - sysDeduct,
      predictionRewardCoins: wallet.predictionRewardCoins - predDeduct,
    },
  });

  const balanceAfter =
    updatedWallet.predictionRewardCoins +
    updatedWallet.systemRewardCoins +
    updatedWallet.purchasedCoins;

  await tx.coinTransaction.create({
    data: {
      walletId: updatedWallet.id,
      coinType: "PURCHASED",
      amount: -amount,
      balanceAfter,
      type: CoinTransactionType.PREDICTION_ENTRY,
      referenceId: matchId,
      description,
    },
  });

  return { ok: true, balance: balanceAfter };
}

async function auditCaptainScores(prisma, comp, quarterRound, config) {
  const audit = [];
  for (const teamName of WRONGLY_ELIMINATED) {
    const entry = requireEntry(comp, teamName);
    const captainUserId = getCaptainUserId(entry);
    const predictions = await listCaptainPredictions(
      prisma,
      captainUserId,
      config,
      CAPTAIN_AUDIT_START,
      new Date(),
    );
    const xp = predictions.reduce((sum, row) => sum + (row.xpEarned ?? 0), 0);
    audit.push({
      team: teamName,
      captainUserId,
      predictionCount: predictions.length,
      xpEarnedSince20Tir: xp,
      predictions: predictions.map((row) => ({
        matchId: row.matchId,
        kickoffAt: row.match.kickoffAt,
        xpEarned: row.xpEarned,
        scoredAt: row.scoredAt,
      })),
    });
  }
  return audit;
}

async function inspect(prisma) {
  const comp = await loadCompetition(prisma);
  if (!comp) throw new Error("رقابت جام جهانی یافت نشد.");

  const quarterRound = comp.knockoutRounds.find((row) => row.roundType === "ONE_QUARTER");
  const finalRound = comp.knockoutRounds.find((row) => row.roundType === "FINAL");
  const config = await loadRoundConfig(prisma, quarterRound);

  const fixtures = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: { teamCompetitionId: comp.id },
    include: {
      entryA: { include: { team: { select: { name: true } } } },
      entryB: { include: { team: { select: { name: true } } } },
      knockoutRound: true,
    },
    orderBy: [{ knockoutRound: { sortOrder: "asc" } }, { waveIndex: "asc" }, { fixtureIndex: "asc" }],
  });

  const scores = [];
  for (const teamName of QUARTER_FINALISTS) {
    const entry = requireEntry(comp, teamName);
    const captainUserId = getCaptainUserId(entry);
    const baseline = BASELINES[normalizeTeamName(teamName)] ?? entry.knockoutRoundScoreBaseline ?? 0;
    const liveXp = await computeCaptainXp(
      prisma,
      captainUserId,
      config,
      quarterRound.startsAt,
      new Date(Math.min(Date.now(), QUARTER_ENDS_AT.getTime())),
    );
    scores.push({
      team: teamName,
      baseline,
      liveCaptainXp: liveXp,
      totalScore: baseline + liveXp,
      isEliminated: entry.isEliminated,
    });
  }

  console.log(
    JSON.stringify(
      {
        competition: {
          id: comp.id,
          titleFa: comp.titleFa,
          stage: comp.stage,
        },
        rounds: comp.knockoutRounds.map((row) => ({
          roundType: row.roundType,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          feePerMember: row.predictionFeePerMember,
        })),
        fixtures: fixtures.map((row) => ({
          round: row.knockoutRound.roundType,
          wave: row.waveIndex,
          a: row.entryA?.team.name,
          b: row.entryB?.team.name,
          scoreA: row.entryAScore,
          scoreB: row.entryBScore,
          resolved: Boolean(row.resolvedAt),
          winnerEntryId: row.winnerEntryId,
        })),
        quarterFinalScores: scores,
        captainAuditSince20Tir: await auditCaptainScores(prisma, comp, quarterRound, config),
      },
      null,
      2,
    ),
  );
}

async function applyRepair(prisma, { dryRun }) {
  const comp = await loadCompetition(prisma);
  if (!comp) throw new Error("رقابت جام جهانی یافت نشد.");

  const quarterRound = comp.knockoutRounds.find((row) => row.roundType === "ONE_QUARTER");
  const finalRound = comp.knockoutRounds.find((row) => row.roundType === "FINAL");
  if (!quarterRound || !finalRound) throw new Error("مراحل حذفی ONE_QUARTER/FINAL یافت نشد.");

  const config = await loadRoundConfig(prisma, quarterRound);
  if (!config) throw new Error("تنظیمات مرحله یک‌چهارم یافت نشد.");

  const scoreWindowEnd = new Date(Math.min(Date.now(), QUARTER_ENDS_AT.getTime()));
  const teamScores = new Map();

  for (const teamName of QUARTER_FINALISTS) {
    const entry = requireEntry(comp, teamName);
    const captainUserId = getCaptainUserId(entry);
    const baseline = BASELINES[normalizeTeamName(teamName)] ?? entry.knockoutRoundScoreBaseline ?? 0;
    const liveXp = await computeCaptainXp(
      prisma,
      captainUserId,
      config,
      quarterRound.startsAt,
      scoreWindowEnd,
    );
    teamScores.set(normalizeTeamName(teamName), {
      entryId: entry.id,
      teamId: entry.team.id,
      baseline,
      liveXp,
      total: baseline + liveXp,
    });
  }

  const feePlan = [];
  for (const teamName of FEE_RETROACTIVE_TEAMS) {
    const entry = requireEntry(comp, teamName);
    const captainUserId = getCaptainUserId(entry);
    const memberIds = entry.team.members.map((row) => row.userId);
    const predictions = await listCaptainPredictions(
      prisma,
      captainUserId,
      config,
      CAPTAIN_AUDIT_START,
      new Date(),
    );

    for (const prediction of predictions) {
      for (const member of entry.team.members) {
        const existing = await prisma.prediction.findFirst({
          where: {
            matchId: prediction.matchId,
            competitionType: "DAILY",
            userId: member.userId,
          },
          select: { id: true, userId: true },
        });
        if (existing) continue;
        if (member.userId === captainUserId) continue;
        feePlan.push({
          team: teamName,
          userId: member.userId,
          matchId: prediction.matchId,
          amount: config.feePerMember,
        });
      }
    }
  }

  const report = {
    competitionId: comp.id,
    dryRun,
    teamScores: Object.fromEntries(
      [...teamScores.entries()].map(([name, row]) => [
        name,
        { baseline: row.baseline, liveCaptainXp: row.liveXp, total: row.total },
      ]),
    ),
    captainAuditSince20Tir: await auditCaptainScores(prisma, comp, quarterRound, config),
    retroactiveFeeCharges: feePlan,
    actions: [
      "delete FINAL fixtures",
      "unresolve ONE_QUARTER wave 1 fixtures",
      "restore isEliminated=false for جُغد پیر and ته جدولی",
      "update quarter-final scores",
      "apply retroactive prediction fees for non-individual members",
      "ensure round dates (quarter ends 27 Tir, final starts 28 Tir)",
    ],
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    console.log("\nDry-run only — no database changes.");
    return report;
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamCompetitionKnockoutFixture.deleteMany({
      where: {
        teamCompetitionId: comp.id,
        knockoutRoundId: finalRound.id,
      },
    });

    await tx.teamCompetition.update({
      where: { id: comp.id },
      data: {
        stage: "KNOCKOUT",
        winnerEntryId: null,
        runnerUpEntryId: null,
        finishedAt: null,
        rewardsDistributedAt: null,
        knockoutEndsAt: FINAL_ENDS_AT,
      },
    });

    await tx.teamCompetitionKnockoutRound.update({
      where: { id: quarterRound.id },
      data: { endsAt: QUARTER_ENDS_AT },
    });
    await tx.teamCompetitionKnockoutRound.update({
      where: { id: finalRound.id },
      data: { startsAt: FINAL_STARTS_AT, endsAt: FINAL_ENDS_AT },
    });

    for (const teamName of QUARTER_FINALISTS) {
      const normalized = normalizeTeamName(teamName);
      const score = teamScores.get(normalized);
      await tx.teamCompetitionEntry.update({
        where: { id: score.entryId },
        data: {
          isEliminated: false,
          knockoutRoundScoreBaseline: score.baseline,
          knockoutRoundScore: score.total,
        },
      });
    }

    for (const teamName of ["بیژن", "ایرج", "نارنجک", "کاپ"]) {
      const entry = comp.entries.find((row) => normalizeTeamName(row.team.name) === teamName);
      if (!entry) continue;
      await tx.teamCompetitionEntry.update({
        where: { id: entry.id },
        data: { isEliminated: true, knockoutRoundScore: 0, knockoutRoundScoreBaseline: 0 },
      });
    }

    const wave1Fixtures = await tx.teamCompetitionKnockoutFixture.findMany({
      where: {
        teamCompetitionId: comp.id,
        knockoutRoundId: quarterRound.id,
        waveIndex: 1,
      },
      include: {
        entryA: { include: { team: { select: { name: true } } } },
        entryB: { include: { team: { select: { name: true } } } },
      },
    });

    for (const fixture of wave1Fixtures) {
      const nameA = normalizeTeamName(fixture.entryA?.team.name ?? "");
      const nameB = normalizeTeamName(fixture.entryB?.team.name ?? "");
      const scoreA = teamScores.get(nameA)?.total ?? fixture.entryAScore;
      const scoreB = teamScores.get(nameB)?.total ?? fixture.entryBScore;

      await tx.teamCompetitionKnockoutFixture.update({
        where: { id: fixture.id },
        data: {
          entryAScore: scoreA,
          entryBScore: scoreB,
          winnerEntryId: null,
          tieBreakApplied: false,
          tieBreakWinnerId: null,
          resolvedAt: null,
        },
      });
    }

    const feeResults = [];
    for (const charge of feePlan) {
      const result = await deductCoins(
        tx,
        charge.userId,
        charge.amount,
        charge.matchId,
        `هزینه پیش‌بینی مرحله حذفی رقابت تیمی (${charge.team})`,
      );
      feeResults.push({ ...charge, ...result });
      if (!result.ok) {
        throw new Error(
          `موجودی کافی برای کسر هزینه پیش‌بینی نیست (تیم ${charge.team}, user ${charge.userId})`,
        );
      }
    }
    report.feeResults = feeResults;
  });

  console.log(JSON.stringify(report, null, 2));
  console.log("\n✓ World Cup knockout repair applied.");
  return report;
}

async function main() {
  const inspectMode = process.argv.includes("--inspect");
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");

  if (!inspectMode && !dryRun && !apply) {
    console.error(
      "Usage: node prisma/repair-world-cup-knockout.mjs --inspect|--dry-run|--apply",
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
    await applyRepair(prisma, { dryRun });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
