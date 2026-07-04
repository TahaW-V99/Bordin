/**
 * Standalone kandakator week sync (no TS path aliases).
 * Usage on Liara: node scripts/sync-kandakator-week-standalone.mjs
 */
import { PrismaClient, MatchStatus } from "@prisma/client";
import { addDays, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const API_BASE = "https://api.football-data.org/v4";
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

function mapStatus(status) {
  if (status === "IN_PLAY" || status === "PAUSED") return MatchStatus.LIVE;
  if (status === "FINISHED") return MatchStatus.FINISHED;
  if (status === "POSTPONED" || status === "SUSPENDED") return MatchStatus.POSTPONED;
  if (status === "CANCELLED") return MatchStatus.CANCELLED;
  return MatchStatus.SCHEDULED;
}

function readScore(match) {
  const ft = match.score?.fullTime ?? match.score?.regularTime;
  return { homeScore: ft?.home ?? null, awayScore: ft?.away ?? null };
}

async function fetchMatchesByDate(dateKey) {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not set");

  const url = new URL(`${API_BASE}/matches`);
  url.searchParams.set("date", dateKey);
  const res = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
  if (!res.ok) throw new Error(`football-data.org ${res.status}`);
  const data = await res.json();
  return data.matches ?? [];
}

async function syncDay(dateKey) {
  const matches = await fetchMatchesByDate(dateKey);
  if (matches.length === 0) return { date: dateKey, matchCount: 0 };

  const dayStart = tehranDayStart(dateKey);
  const sorted = [...matches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
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
      const m = sorted[i];
      const { homeScore, awayScore } = readScore(m);
      const match = await tx.footballMatch.upsert({
        where: { externalId: `football-data-${m.id}` },
        create: {
          externalId: `football-data-${m.id}`,
          homeTeamName: m.homeTeam.name,
          awayTeamName: m.awayTeam.name,
          leagueName: m.competition?.name ?? null,
          kickoffAt: new Date(m.utcDate),
          homeScore,
          awayScore,
          status: mapStatus(m.status),
        },
        update: {
          homeTeamName: m.homeTeam.name,
          awayTeamName: m.awayTeam.name,
          leagueName: m.competition?.name ?? null,
          kickoffAt: new Date(m.utcDate),
          homeScore,
          awayScore,
          status: mapStatus(m.status),
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
