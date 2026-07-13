/**
 * Standalone kandakator week sync (no TS path aliases).
 * Usage on Liara: node scripts/sync-kandakator-week-standalone.mjs
 */
import { PrismaClient, MatchStatus } from "@prisma/client";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const API_BASE = process.env.FIXTURE_API_BASE_URL?.trim() || "https://v3.football.api-sports.io";
const TEHRAN = "Asia/Tehran";
const prisma = new PrismaClient();

function tehranDateKey(date = new Date()) {
  return format(toZonedTime(date, TEHRAN), "yyyy-MM-dd");
}

function tehranDayStart(dateKey) {
  return new Date(`${dateKey}T00:00:00+03:30`);
}

function getTehranWeekStart() {
  const today = toZonedTime(new Date(), TEHRAN);
  const day = today.getDay();
  const offset = day === 6 ? 0 : day + 1;
  return addDays(today, -offset);
}

function mapStatus(short) {
  if (["1H", "2H", "HT", "ET", "BT", "LIVE", "P"].includes(short)) return MatchStatus.LIVE;
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(short)) return MatchStatus.FINISHED;
  if (["PST", "SUSP", "INT", "TBD"].includes(short)) return MatchStatus.POSTPONED;
  if (["CANC", "ABD"].includes(short)) return MatchStatus.CANCELLED;
  return MatchStatus.SCHEDULED;
}

function readScore(row) {
  const short = row.fixture.status.short;
  const isFinished = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
  if (isFinished) {
    const ft = row.score?.fulltime;
    return { homeScore: ft?.home ?? null, awayScore: ft?.away ?? null };
  }
  return { homeScore: row.goals?.home ?? null, awayScore: row.goals?.away ?? null };
}

async function fetchMatchesByDate(dateKey) {
  const apiKey = process.env.FIXTURE_API_KEY?.trim();
  if (!apiKey) throw new Error("FIXTURE_API_KEY is not set");

  const url = new URL(`${API_BASE}/fixtures`);
  url.searchParams.set("date", dateKey);
  url.searchParams.set("timezone", TEHRAN);
  const res = await fetch(url, { headers: { "x-apisports-key": apiKey } });
  if (!res.ok) throw new Error(`Fixture API ${res.status}`);
  const data = await res.json();
  return data.response ?? [];
}

async function syncDay(dateKey) {
  const matches = await fetchMatchesByDate(dateKey);
  if (matches.length === 0) return { date: dateKey, matchCount: 0 };

  const dayStart = tehranDayStart(dateKey);
  const sorted = [...matches].sort(
    (a, b) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime(),
  );

  await prisma.$transaction(async (tx) => {
    const kandakator = await tx.dailyKandakator.upsert({
      where: { date: dayStart },
      create: {
        date: dayStart,
        title: `کنداکتور ${dateKey}`,
        isPublished: true,
        entryFeeCoins: 600,
      },
      update: { isPublished: true },
    });

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      const { homeScore, awayScore } = readScore(row);
      const externalId = `fixture-${row.fixture.id}`;
      const match = await tx.footballMatch.upsert({
        where: { externalId },
        create: {
          externalId,
          homeTeamName: row.teams.home.name,
          awayTeamName: row.teams.away.name,
          leagueName: row.league?.name ?? null,
          kickoffAt: new Date(row.fixture.date),
          homeScore,
          awayScore,
          status: mapStatus(row.fixture.status.short),
        },
        update: {
          homeTeamName: row.teams.home.name,
          awayTeamName: row.teams.away.name,
          leagueName: row.league?.name ?? null,
          kickoffAt: new Date(row.fixture.date),
          homeScore,
          awayScore,
          status: mapStatus(row.fixture.status.short),
        },
      });

      await tx.kandakatorMatch.upsert({
        where: {
          kandakatorId_matchId: { kandakatorId: kandakator.id, matchId: match.id },
        },
        create: {
          kandakatorId: kandakator.id,
          matchId: match.id,
          sortOrder: i,
          predictionCutoffMinutes: 5,
        },
        update: { sortOrder: i },
      });
    }
  });

  return { date: dateKey, matchCount: sorted.length };
}

async function main() {
  const weekStart = getTehranWeekStart();
  const results = [];

  for (let i = 0; i < 7; i++) {
    const dateKey = tehranDateKey(addDays(weekStart, i));
    results.push(await syncDay(dateKey));
  }

  const total = results.reduce((sum, row) => sum + row.matchCount, 0);
  console.log(`Synced ${results.length} days, ${total} matches.`);
  for (const row of results) console.log(`  ${row.date}: ${row.matchCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
