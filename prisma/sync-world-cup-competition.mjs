#!/usr/bin/env node
/**
 * One-off data sync for team competition «جام جهانی» on production (bordin.ir).
 *
 *   node prisma/sync-world-cup-competition.mjs --inspect
 *   node prisma/sync-world-cup-competition.mjs --dry-run
 *   node prisma/sync-world-cup-competition.mjs --apply
 *   node prisma/sync-world-cup-competition.mjs --patch-quarter
 *
 * Liara:
 *   liara shell --app bordin --command "node prisma/sync-world-cup-competition.mjs --apply"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const COMPETITION_TITLE_MATCH = "جام";
const RANKING_ENDS_AT = new Date("2026-06-17T20:30:00.000Z"); // ۲۷ خرداد ۱۴۰۵ پایان روز تهران

const RANKING_TEAMS = [
  { name: "جُغد پیر", score: 18502 },
  { name: "شیاطین سرخ", score: 13619 },
  { name: "آبی اناری ها", score: 13617 },
  { name: "ته جدولی", score: 11827 },
  { name: "کاپ", score: 7956 },
  { name: "نارنجک", score: 6504 },
  { name: "ایرج", score: 5182 },
  { name: "بیژن", score: 1272 },
];

/** ONE_QUARTER wave 0 — ۴ بازی (۸ تیم) */
const ROUND_OF_16 = [
  {
    high: "جُغد پیر",
    low: "بیژن",
    highScore: 18110,
    lowScore: 15660,
    pairIndex: 0,
  },
  {
    high: "شیاطین سرخ",
    low: "ایرج",
    highScore: 14182,
    lowScore: 10360,
    pairIndex: 1,
  },
  {
    high: "آبی اناری ها",
    low: "نارنجک",
    highScore: 13242,
    lowScore: 10620,
    pairIndex: 2,
  },
  {
    high: "ته جدولی",
    low: "کاپ",
    highScore: 18266,
    lowScore: 16280,
    pairIndex: 3,
  },
];

/** ONE_QUARTER wave 1 — یک‌چهارم (۴ تیم) — fixtureIndex سراسری در wave */
const QUARTER_FINALS = [
  {
    side: "RIGHT",
    fixtureIndex: 0,
    high: "جُغد پیر",
    low: "شیاطین سرخ",
    highScore: 14800,
    lowScore: 14100,
  },
  {
    side: "LEFT",
    fixtureIndex: 1,
    high: "آبی اناری ها",
    low: "ته جدولی",
    highScore: 13516,
    lowScore: 9092,
  },
];

const ELIMINATED_TEAM_NAMES = new Set(["بیژن", "ایرج", "نارنجک", "کاپ"]);

const TEAM_NAME_ALIASES = {
  "آبی اناری‌ها": "آبی اناری ها",
  "جوغد پیر": "جُغد پیر",
  جغدپیر: "جُغد پیر",
};

function normalizeTeamName(name) {
  const trimmed = String(name ?? "").trim();
  return TEAM_NAME_ALIASES[trimmed] ?? trimmed;
}

function bracketSideForPairIndex(pairIndex, capacity = 8) {
  const perSide = capacity / 4;
  if (pairIndex < perSide) {
    return { side: "RIGHT", groupIndex: pairIndex };
  }
  return { side: "LEFT", groupIndex: pairIndex - perSide };
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

async function findCompetition(prisma) {
  const competitions = await prisma.teamCompetition.findMany({
    where: {
      OR: [
        { titleFa: { contains: "جام جهانی" } },
        { titleFa: { contains: "جام‌جهانی" } },
        { titleFa: { contains: COMPETITION_TITLE_MATCH } },
      ],
    },
    select: {
      id: true,
      titleFa: true,
      stage: true,
      teamCapacity: true,
      rankingEndsAt: true,
      rankingFinalizedAt: true,
      bracketGeneratedAt: true,
      usesRuleBasedStages: true,
      rankingPredictionFeePerMember: true,
      knockoutRounds: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          roundType: true,
          sortOrder: true,
          predictionFeePerMember: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  });

  const exact =
    competitions.find((c) => c.titleFa.includes("جام جهانی") || c.titleFa.includes("جام‌جهانی")) ??
    competitions.find((c) => /جام\s*جهانی/i.test(c.titleFa));

  if (!exact && competitions.length === 1) return competitions[0];
  return exact ?? null;
}

async function loadEntries(prisma, competitionId) {
  return prisma.teamCompetitionEntry.findMany({
    where: { teamCompetitionId: competitionId },
    include: { team: { select: { id: true, name: true } } },
  });
}

function mapEntriesByTeamName(entries) {
  const map = new Map();
  for (const entry of entries) {
    map.set(normalizeTeamName(entry.team.name), entry);
    map.set(entry.team.name.trim(), entry);
  }
  return map;
}

function requireEntry(map, teamName) {
  const entry =
    map.get(normalizeTeamName(teamName)) ??
    [...map.values()].find((row) => row.team.name.includes(teamName.replace(/\s+/g, "")));
  if (!entry) {
    const available = [...new Set([...map.values()].map((row) => row.team.name))].join(", ");
    throw new Error(`تیم «${teamName}» در این رقابت یافت نشد. تیم‌های موجود: ${available}`);
  }
  return entry;
}

async function inspect(prisma) {
  const comp = await findCompetition(prisma);
  if (!comp) {
    console.log("رقابت جام جهانی یافت نشد.");
    const all = await prisma.teamCompetition.findMany({
      select: { id: true, titleFa: true, stage: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    console.log("رقابت‌های اخیر:", all);
    return;
  }

  console.log("Competition:", comp);
  const entries = await loadEntries(prisma, comp.id);
  console.log(
    "Entries:",
    entries
      .map((e) => ({
        team: e.team.name,
        rankingScore: e.rankingScore,
        seedRank: e.seedRank,
        isEliminated: e.isEliminated,
        knockoutRoundScore: e.knockoutRoundScore,
        knockoutRoundScoreBaseline: e.knockoutRoundScoreBaseline ?? 0,
      }))
      .sort((a, b) => b.rankingScore - a.rankingScore),
  );

  const fixtures = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: { teamCompetitionId: comp.id },
    include: {
      entryA: { include: { team: { select: { id: true, name: true } } } },
      entryB: { include: { team: { select: { id: true, name: true } } } },
      knockoutRound: true,
    },
    orderBy: [{ knockoutRound: { sortOrder: "asc" } }, { waveIndex: "asc" }, { fixtureIndex: "asc" }],
  });

  console.log(
    "Fixtures:",
    fixtures.map((f) => ({
      round: f.knockoutRound.roundType,
      wave: f.waveIndex,
      side: f.bracketSide,
      index: f.fixtureIndex,
      a: f.entryA?.team.name,
      b: f.entryB?.team.name,
      scoreA: f.entryAScore,
      scoreB: f.entryBScore,
      resolved: Boolean(f.resolvedAt),
      winner: f.winnerEntryId,
    })),
  );
}

async function applySync(prisma, { dryRun }) {
  const comp = await findCompetition(prisma);
  if (!comp) throw new Error("رقابت جام جهانی در production یافت نشد.");

  if (comp.teamCapacity !== 8) {
    throw new Error(`ظرفیت رقابت باید ۸ باشد؛ فعلی: ${comp.teamCapacity}`);
  }

  const quarterRound = comp.knockoutRounds.find((r) => r.roundType === "ONE_QUARTER");
  if (!quarterRound) {
    throw new Error("مرحله ONE_QUARTER برای این رقابت تعریف نشده است.");
  }

  const entries = await loadEntries(prisma, comp.id);
  const entryByName = mapEntriesByTeamName(entries);

  for (const row of RANKING_TEAMS) {
    requireEntry(entryByName, row.name);
  }

  const report = {
    competitionId: comp.id,
    titleFa: comp.titleFa,
    dryRun,
    rankingUpdated: RANKING_TEAMS.length,
    wave0Fixtures: ROUND_OF_16.length,
    wave1Fixtures: QUARTER_FINALS.length,
    eliminated: [...ELIMINATED_TEAM_NAMES],
    predictionFees: {
      ranking: comp.rankingPredictionFeePerMember,
      knockoutRounds: comp.knockoutRounds.map((r) => ({
        roundType: r.roundType,
        predictionFeePerMember: r.predictionFeePerMember,
      })),
    },
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    console.log("\nDry-run only — no database changes.");
    return report;
  }

  await prisma.$transaction(async (tx) => {
    await tx.teamCompetition.update({
      where: { id: comp.id },
      data: {
        stage: "KNOCKOUT",
        rankingEndsAt: RANKING_ENDS_AT,
        rankingFinalizedAt: RANKING_ENDS_AT,
        bracketGeneratedAt: comp.bracketGeneratedAt ?? RANKING_ENDS_AT,
        knockoutStartsAt: comp.knockoutRounds[0]?.startsAt ?? RANKING_ENDS_AT,
      },
    });

    for (let i = 0; i < RANKING_TEAMS.length; i += 1) {
      const row = RANKING_TEAMS[i];
      const entry = requireEntry(entryByName, row.name);
      const quarterScore =
        QUARTER_FINALS.find((q) => normalizeTeamName(q.high) === normalizeTeamName(row.name))
          ?.highScore ??
        QUARTER_FINALS.find((q) => normalizeTeamName(q.low) === normalizeTeamName(row.name))
          ?.lowScore ??
        0;

      await tx.teamCompetitionEntry.update({
        where: { id: entry.id },
        data: {
          rankingScore: row.score,
          seedRank: i + 1,
          isEliminated: ELIMINATED_TEAM_NAMES.has(normalizeTeamName(row.name)),
          knockoutRoundScoreBaseline: ELIMINATED_TEAM_NAMES.has(normalizeTeamName(row.name))
            ? 0
            : quarterScore,
          knockoutRoundScore: ELIMINATED_TEAM_NAMES.has(normalizeTeamName(row.name)) ? 0 : quarterScore,
        },
      });
    }

    for (const pairing of ROUND_OF_16) {
      const highEntry = requireEntry(entryByName, pairing.high);
      const lowEntry = requireEntry(entryByName, pairing.low);
      const { side, groupIndex } = bracketSideForPairIndex(pairing.pairIndex, comp.teamCapacity);

      await tx.teamCompetitionEntry.update({
        where: { id: highEntry.id },
        data: {
          bracketSide: side,
          bracketGroupIndex: groupIndex,
          pairedEntryId: lowEntry.id,
        },
      });
      await tx.teamCompetitionEntry.update({
        where: { id: lowEntry.id },
        data: {
          bracketSide: side,
          bracketGroupIndex: groupIndex,
          pairedEntryId: highEntry.id,
        },
      });
    }

    await tx.teamCompetitionKnockoutFixture.deleteMany({
      where: {
        teamCompetitionId: comp.id,
        knockoutRoundId: quarterRound.id,
      },
    });

    for (const pairing of ROUND_OF_16) {
      const highEntry = requireEntry(entryByName, pairing.high);
      const lowEntry = requireEntry(entryByName, pairing.low);
      const { side, groupIndex } = bracketSideForPairIndex(pairing.pairIndex, comp.teamCapacity);
      const winnerEntryId = pairing.highScore >= pairing.lowScore ? highEntry.id : lowEntry.id;

      await tx.teamCompetitionKnockoutFixture.create({
        data: {
          teamCompetitionId: comp.id,
          knockoutRoundId: quarterRound.id,
          waveIndex: 0,
          fixtureIndex: pairing.pairIndex,
          bracketSide: side,
          entryAId: highEntry.id,
          entryBId: lowEntry.id,
          entryAScore: pairing.highScore,
          entryBScore: pairing.lowScore,
          winnerEntryId,
          resolvedAt: RANKING_ENDS_AT,
        },
      });
    }

    for (const pairing of QUARTER_FINALS) {
      const highEntry = requireEntry(entryByName, pairing.high);
      const lowEntry = requireEntry(entryByName, pairing.low);

      await tx.teamCompetitionKnockoutFixture.create({
        data: {
          teamCompetitionId: comp.id,
          knockoutRoundId: quarterRound.id,
          waveIndex: 1,
          fixtureIndex: pairing.fixtureIndex,
          bracketSide: pairing.side,
          entryAId: highEntry.id,
          entryBId: lowEntry.id,
          entryAScore: pairing.highScore,
          entryBScore: pairing.lowScore,
          winnerEntryId: null,
          resolvedAt: null,
        },
      });
    }
  });

  console.log(JSON.stringify(report, null, 2));
  console.log("\n✓ World Cup team competition data synced.");
  console.log(
    "هزینه پیش‌بینی حذفی از تنظیمات ادمین (predictionFeePerMember) استفاده می‌شود؛ مقدار ۶۰۰ اعمال نشده.",
  );
  console.log("برای به‌روزرسانی لیدر برد تیمی، syncTeamLeaderboardRanks را اجرا کنید یا deploy کنید.");

  return report;
}

/** فقط امتیازهای مرحله یک‌چهارم (wave 1) را به‌روز می‌کند. */
async function patchQuarterFinalScores(prisma, { dryRun }) {
  const comp = await findCompetition(prisma);
  if (!comp) throw new Error("رقابت جام جهانی در production یافت نشد.");

  const quarterRound = comp.knockoutRounds.find((r) => r.roundType === "ONE_QUARTER");
  if (!quarterRound) throw new Error("مرحله ONE_QUARTER یافت نشد.");

  const entries = await loadEntries(prisma, comp.id);
  const entryByName = mapEntriesByTeamName(entries);

  const report = {
    competitionId: comp.id,
    titleFa: comp.titleFa,
    dryRun,
    quarterFinals: QUARTER_FINALS.map((q) => ({
      high: q.high,
      low: q.low,
      highScore: q.highScore,
      lowScore: q.lowScore,
    })),
  };

  if (dryRun) {
    console.log(JSON.stringify(report, null, 2));
    console.log("\nDry-run only — quarter-final scores not changed.");
    return report;
  }

  await prisma.$transaction(async (tx) => {
    for (const pairing of QUARTER_FINALS) {
      const highEntry = requireEntry(entryByName, pairing.high);
      const lowEntry = requireEntry(entryByName, pairing.low);

      const fixture = await tx.teamCompetitionKnockoutFixture.findFirst({
        where: {
          teamCompetitionId: comp.id,
          knockoutRoundId: quarterRound.id,
          waveIndex: 1,
          fixtureIndex: pairing.fixtureIndex,
        },
      });
      if (!fixture) {
        throw new Error(`بازی wave 1 با fixtureIndex ${pairing.fixtureIndex} یافت نشد.`);
      }

      await tx.teamCompetitionKnockoutFixture.update({
        where: { id: fixture.id },
        data: {
          entryAId: highEntry.id,
          entryBId: lowEntry.id,
          entryAScore: pairing.highScore,
          entryBScore: pairing.lowScore,
          resolvedAt: null,
          winnerEntryId: null,
        },
      });

      await tx.teamCompetitionEntry.update({
        where: { id: highEntry.id },
        data: {
          knockoutRoundScoreBaseline: pairing.highScore,
          knockoutRoundScore: pairing.highScore,
          isEliminated: false,
        },
      });
      await tx.teamCompetitionEntry.update({
        where: { id: lowEntry.id },
        data: {
          knockoutRoundScoreBaseline: pairing.lowScore,
          knockoutRoundScore: pairing.lowScore,
          isEliminated: false,
        },
      });
    }
  });

  console.log(JSON.stringify(report, null, 2));
  console.log("\n✓ Quarter-final (wave 1) scores updated.");
  return report;
}

async function main() {
  const inspectMode = process.argv.includes("--inspect");
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const patchQuarter = process.argv.includes("--patch-quarter");

  if (!inspectMode && !dryRun && !apply && !patchQuarter) {
    console.error(
      "Usage: node prisma/sync-world-cup-competition.mjs --inspect|--dry-run|--apply|--patch-quarter",
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
    if (patchQuarter) {
      await patchQuarterFinalScores(prisma, { dryRun });
      return;
    }
    await applySync(prisma, { dryRun });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
