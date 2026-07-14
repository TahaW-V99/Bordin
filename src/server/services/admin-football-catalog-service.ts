import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { TEHRAN_TZ } from "@/shared/lib/dates";
import {
  buildFixtureExternalId,
  fetchMatchesInRange,
  type FixtureMatch,
  isFixtureApiConfigured,
  mapFixtureStatus,
  parseFixtureExternalId,
  readMatchScore,
} from "@/server/services/fixture-api";
import { translateMatchTeamsToFa, translateLeagueNameToFa } from "@/shared/lib/football-names-fa";
import type { MatchStatus } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";

export type AdminFootballCompetitionGroup = {
  competitionId: number;
  competitionName: string;
  matchCount: number;
};

export type AdminFootballMatchOption = {
  externalId: string;
  apiMatchId: number;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string;
  kickoffAt: string;
  status: string;
  matchId?: string;
};

type CatalogMatch = {
  competitionId: number;
  competitionName: string;
  externalId: string;
  apiMatchId: number;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string;
  kickoffAt: Date;
  status: string;
  matchId?: string;
};

const UPCOMING_CACHE_MS = 10 * 60 * 1000;
let upcomingCache: { expiresAt: number; matches: CatalogMatch[] } | null = null;

export function leagueNameToCompetitionId(leagueName: string) {
  const normalized = translateLeagueNameToFa(leagueName) || "سایر";
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash % 1_000_000_000 || 1;
}

function parseApiMatchId(externalId: string) {
  return parseFixtureExternalId(externalId) ?? 0;
}

function normalizeApiMatch(match: FixtureMatch) {
  const { homeScore, awayScore } = readMatchScore(match);
  const status = mapFixtureStatus(match.status) as MatchStatus;
  const kickoffAt = new Date(match.utcDate);
  return translateMatchTeamsToFa({
    externalId: buildFixtureExternalId(match.id),
    homeTeamName: match.homeTeam.name,
    awayTeamName: match.awayTeam.name,
    leagueName: match.competition?.name ?? "سایر",
    kickoffAt,
    homeScore,
    awayScore,
    status,
  });
}

async function fetchUpcomingApiMatches(daysAhead = 30): Promise<FixtureMatch[]> {
  if (!isFixtureApiConfigured()) {
    throw new Error("FIXTURE_API_KEY در env تنظیم نشده است");
  }

  const todayKey = formatInTimeZone(new Date(), TEHRAN_TZ, "yyyy-MM-dd");
  const endKey = formatInTimeZone(
    addDays(new Date(`${todayKey}T12:00:00+03:30`), daysAhead),
    TEHRAN_TZ,
    "yyyy-MM-dd",
  );

  const matches = await fetchMatchesInRange(todayKey, endKey, { noCache: true });
  return matches
    .filter((m) => !["FT", "AET", "PEN", "AWD", "WO"].includes(m.status))
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}

async function fetchUpcomingMatchesFromDb(daysAhead = 30): Promise<CatalogMatch[]> {
  const now = new Date();
  const until = addDays(now, daysAhead);
  const rows = await prisma.footballMatch.findMany({
    where: {
      kickoffAt: { gte: now, lte: until },
      status: { in: ["SCHEDULED", "LIVE", "POSTPONED"] },
      externalId: { not: null },
    },
    orderBy: { kickoffAt: "asc" },
  });

  return rows.map((row) => {
    const leagueName = row.leagueName ?? "سایر";
    const externalId = row.externalId!;
    return {
      competitionId: leagueNameToCompetitionId(leagueName),
      competitionName: leagueName,
      externalId,
      apiMatchId: parseApiMatchId(externalId),
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      leagueName,
      kickoffAt: row.kickoffAt,
      status: row.status,
      matchId: row.id,
    };
  });
}

async function loadUpcomingCatalogMatches(daysAhead = 30): Promise<CatalogMatch[]> {
  const now = Date.now();
  if (upcomingCache && upcomingCache.expiresAt > now) {
    return upcomingCache.matches;
  }

  let catalog: CatalogMatch[] = [];
  try {
    const apiMatches = await fetchUpcomingApiMatches(daysAhead);
    catalog = apiMatches.map((match) => {
      const normalized = normalizeApiMatch(match);
      const leagueName = normalized.leagueName ?? "سایر";
      return {
        competitionId: match.competition?.id ?? leagueNameToCompetitionId(leagueName),
        competitionName: leagueName,
        externalId: normalized.externalId,
        apiMatchId: match.id,
        homeTeamName: normalized.homeTeamName,
        awayTeamName: normalized.awayTeamName,
        leagueName,
        kickoffAt: normalized.kickoffAt,
        status: normalized.status,
      };
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Bordin] admin football API unavailable (${reason}) — using database catalog`);
    catalog = await fetchUpcomingMatchesFromDb(daysAhead);
  }

  if (catalog.length === 0) {
    catalog = await fetchUpcomingMatchesFromDb(daysAhead);
  }

  upcomingCache = { expiresAt: now + UPCOMING_CACHE_MS, matches: catalog };
  return catalog;
}

function toAdminMatchOption(match: CatalogMatch): AdminFootballMatchOption {
  return {
    externalId: match.externalId,
    apiMatchId: match.apiMatchId,
    homeTeamName: match.homeTeamName,
    awayTeamName: match.awayTeamName,
    leagueName: match.leagueName,
    kickoffAt: match.kickoffAt.toISOString(),
    status: match.status,
    matchId: match.matchId,
  };
}

export async function listAdminFootballCompetitions(): Promise<AdminFootballCompetitionGroup[]> {
  const matches = await loadUpcomingCatalogMatches();
  const groups = new Map<number, AdminFootballCompetitionGroup>();

  for (const match of matches) {
    const existing = groups.get(match.competitionId);
    if (existing) {
      existing.matchCount += 1;
    } else {
      groups.set(match.competitionId, {
        competitionId: match.competitionId,
        competitionName: match.competitionName,
        matchCount: 1,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) =>
    a.competitionName.localeCompare(b.competitionName, "fa"),
  );
}

export async function listAdminFootballMatchesByCompetition(
  competitionId: number,
): Promise<AdminFootballMatchOption[]> {
  const matches = await loadUpcomingCatalogMatches();
  const filtered = matches.filter((m) => m.competitionId === competitionId);

  const missingExternalIds = filtered
    .filter((m) => !m.matchId)
    .map((m) => m.externalId);
  if (missingExternalIds.length > 0) {
    const dbMatches = await prisma.footballMatch.findMany({
      where: { externalId: { in: missingExternalIds } },
      select: { id: true, externalId: true },
    });
    const dbByExternal = new Map(dbMatches.map((m) => [m.externalId, m.id]));
    for (const match of filtered) {
      if (!match.matchId && match.externalId) {
        match.matchId = dbByExternal.get(match.externalId);
      }
    }
  }

  return filtered.map(toAdminMatchOption);
}

function catalogMatchFromApi(match: FixtureMatch): CatalogMatch {
  const normalized = normalizeApiMatch(match);
  const leagueName = normalized.leagueName ?? "سایر";
  return {
    competitionId: match.competition?.id ?? leagueNameToCompetitionId(leagueName),
    competitionName: leagueName,
    externalId: normalized.externalId,
    apiMatchId: match.id,
    homeTeamName: normalized.homeTeamName,
    awayTeamName: normalized.awayTeamName,
    leagueName,
    kickoffAt: normalized.kickoffAt,
    status: normalized.status,
  };
}

/** Load catalog matches for an admin-configured stage window (source of truth for rule-based stages). */
export async function loadCatalogMatchesInRange(
  startsAt: Date,
  endsAt: Date,
): Promise<CatalogMatch[]> {
  if (endsAt.getTime() < startsAt.getTime()) return [];

  const dateFrom = formatInTimeZone(startsAt, TEHRAN_TZ, "yyyy-MM-dd");
  const dateTo = formatInTimeZone(endsAt, TEHRAN_TZ, "yyyy-MM-dd");
  const startMs = startsAt.getTime();
  const endMs = endsAt.getTime();

  const byExternal = new Map<string, CatalogMatch>();

  try {
    if (isFixtureApiConfigured()) {
      const apiMatches = await fetchMatchesInRange(dateFrom, dateTo, { noCache: true });
      for (const match of apiMatches) {
        const catalog = catalogMatchFromApi(match);
        if (
          catalog.kickoffAt.getTime() >= startMs &&
          catalog.kickoffAt.getTime() <= endMs
        ) {
          byExternal.set(catalog.externalId, catalog);
        }
      }
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[Bordin] stage catalog API range fetch failed (${reason})`);
  }

  const dbRows = await prisma.footballMatch.findMany({
    where: {
      kickoffAt: { gte: startsAt, lte: endsAt },
      externalId: { not: null },
    },
    orderBy: { kickoffAt: "asc" },
  });

  for (const row of dbRows) {
    const leagueName = row.leagueName ?? "سایر";
    const externalId = row.externalId!;
    byExternal.set(externalId, {
      competitionId: leagueNameToCompetitionId(leagueName),
      competitionName: leagueName,
      externalId,
      apiMatchId: parseApiMatchId(externalId),
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      leagueName,
      kickoffAt: row.kickoffAt,
      status: row.status,
      matchId: row.id,
    });
  }

  return Array.from(byExternal.values()).sort(
    (a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime(),
  );
}

export function filterCatalogMatchesByStageRules(
  catalog: CatalogMatch[],
  startsAt: Date,
  endsAt: Date,
  footballCompetitionIds: number[],
): CatalogMatch[] {
  const idSet = new Set(footballCompetitionIds);
  const startMs = startsAt.getTime();
  const endMs = endsAt.getTime();
  return catalog.filter(
    (m) =>
      idSet.has(m.competitionId) &&
      m.kickoffAt.getTime() >= startMs &&
      m.kickoffAt.getTime() <= endMs,
  );
}

/** Upsert FootballMatch rows for admin-selected external IDs; returns internal match IDs in order. */
export async function upsertFootballMatchesByExternalIds(externalIds: string[]) {
  const catalog = await loadUpcomingCatalogMatches();
  const catalogByExternal = new Map(catalog.map((m) => [m.externalId, m]));

  const results: Array<{ externalId: string; matchId: string; kickoffAt: Date }> = [];

  for (const externalId of externalIds) {
    const cached = catalogByExternal.get(externalId);
    if (cached?.matchId) {
      results.push({
        externalId,
        matchId: cached.matchId,
        kickoffAt: cached.kickoffAt,
      });
      continue;
    }

    const existing = await prisma.footballMatch.findUnique({ where: { externalId } });
    if (existing) {
      results.push({
        externalId,
        matchId: existing.id,
        kickoffAt: existing.kickoffAt,
      });
      continue;
    }

    if (!isFixtureApiConfigured()) {
      throw new Error("FIXTURE_API_KEY در env تنظیم نشده است");
    }

    const apiMatches = await fetchUpcomingApiMatches();
    const apiMatch = apiMatches.find((m) => buildFixtureExternalId(m.id) === externalId);
    if (!apiMatch) {
      throw new Error(`مسابقه ${externalId} در بازه یک ماه آینده یافت نشد`);
    }

    const normalized = normalizeApiMatch(apiMatch);
    const match = await prisma.footballMatch.upsert({
      where: { externalId: normalized.externalId },
      create: normalized,
      update: {
        homeTeamName: normalized.homeTeamName,
        awayTeamName: normalized.awayTeamName,
        leagueName: normalized.leagueName,
        kickoffAt: normalized.kickoffAt,
        homeScore: normalized.homeScore,
        awayScore: normalized.awayScore,
        status: normalized.status,
      },
    });
    results.push({
      externalId: normalized.externalId,
      matchId: match.id,
      kickoffAt: match.kickoffAt,
    });
  }

  return results;
}
