/**
 * Fixture API (API-Football / api-sports.io v3)
 * Auth: x-apisports-key
 * Docs: https://www.api-football.com/documentation-v3
 */

import { fromZonedTime } from "date-fns-tz";
import { TEHRAN_TZ } from "@/shared/lib/dates";

const DEFAULT_API_BASE = "https://v3.football.api-sports.io";

type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: { id: number; name: string };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: { home: number | null; away: number | null };
  score: {
    fulltime?: { home: number | null; away: number | null };
    halftime?: { home: number | null; away: number | null };
  };
};

type ApiFootballFixturesResponse = {
  response?: ApiFootballFixture[];
  errors?: Record<string, string> | string[];
};

export type FixtureMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  competition?: { id: number; name: string };
  score?: {
    fullTime?: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
  };
};

export const FIXTURE_EXTERNAL_ID_PREFIX = "fixture-";

export function buildFixtureExternalId(apiId: number) {
  return `${FIXTURE_EXTERNAL_ID_PREFIX}${apiId}`;
}

export function parseFixtureExternalId(externalId: string | null | undefined) {
  if (!externalId?.trim()) return null;
  const tail = externalId.split("-").pop();
  const id = Number(tail);
  return Number.isFinite(id) ? id : null;
}

function getApiBase() {
  return process.env.FIXTURE_API_BASE_URL?.trim() || DEFAULT_API_BASE;
}

function getApiKey() {
  return process.env.FIXTURE_API_KEY?.trim() ?? "";
}

export function isFixtureApiConfigured() {
  return Boolean(getApiKey());
}

function getFetchTimeoutMs(options?: { noCache?: boolean }) {
  const fromEnv = process.env.FIXTURE_API_FETCH_TIMEOUT_MS?.trim();
  if (fromEnv) return Math.max(1000, Number(fromEnv) || 8000);
  return options?.noCache ? 15_000 : 8_000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapApiFixture(row: ApiFootballFixture): FixtureMatch {
  const short = row.fixture.status.short;
  const isFinished = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
  const regularHome = row.goals.home ?? row.score.halftime?.home ?? null;
  const regularAway = row.goals.away ?? row.score.halftime?.away ?? null;
  const fullHome = row.score.fulltime?.home ?? null;
  const fullAway = row.score.fulltime?.away ?? null;

  return {
    id: row.fixture.id,
    utcDate: row.fixture.date,
    status: short,
    homeTeam: { id: row.teams.home.id, name: row.teams.home.name },
    awayTeam: { id: row.teams.away.id, name: row.teams.away.name },
    competition: { id: row.league.id, name: row.league.name },
    score: {
      fullTime: isFinished ? { home: fullHome, away: fullAway } : undefined,
      regularTime: { home: regularHome, away: regularAway },
    },
  };
}

async function fetchFixturesFromApi(
  params: Record<string, string>,
  options?: { noCache?: boolean },
): Promise<FixtureMatch[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("FIXTURE_API_KEY در env تنظیم نشده است");
  }

  const url = new URL(`${getApiBase()}/fixtures`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "x-apisports-key": apiKey,
        },
        signal: AbortSignal.timeout(getFetchTimeoutMs(options)),
        ...(options?.noCache
          ? { cache: "no-store" as RequestCache }
          : { next: { revalidate: 300 } }),
      });

      const json = (await res.json().catch(() => null)) as ApiFootballFixturesResponse | null;

      if (!res.ok) {
        const message =
          (typeof json?.errors === "object" && json?.errors
            ? Object.values(json.errors).join(", ")
            : Array.isArray(json?.errors)
              ? json.errors.join(", ")
              : null) ?? `Fixture API خطا: ${res.status}`;
        if (res.status === 429 || /rate limit/i.test(message)) {
          await sleep(15_000);
          continue;
        }
        throw new Error(message);
      }

      return (json?.response ?? []).map(mapApiFixture);
    } catch (error) {
      if (error instanceof Error && /fetch failed/i.test(error.message)) {
        throw new Error(
          "اتصال به سرویس مسابقات برقرار نشد. کلید API یا دسترسی اینترنت سرور را بررسی کنید.",
        );
      }
      const isLast = attempt >= 3;
      if (isLast) throw error;
      await sleep(2_000 * (attempt + 1));
    }
  }

  throw new Error("Fixture API: rate limit exceeded after retries");
}

export async function fetchMatchesByDate(date: string, options?: { noCache?: boolean }) {
  return fetchFixturesFromApi({ date, timezone: TEHRAN_TZ }, options);
}

export async function fetchMatchesInRange(
  dateFrom: string,
  dateTo: string,
  options?: { noCache?: boolean },
) {
  return fetchFixturesFromApi(
    { from: dateFrom, to: dateTo, timezone: TEHRAN_TZ },
    options,
  );
}

export async function fetchMatchById(apiMatchId: number, options?: { noCache?: boolean }) {
  const rows = await fetchFixturesFromApi({ id: String(apiMatchId) }, options);
  return rows[0] ?? null;
}

export async function fetchMatchesForTehranDate(
  tehranDateKey: string,
  options?: { noCache?: boolean },
) {
  const dayStart = fromZonedTime(`${tehranDateKey}T00:00:00`, TEHRAN_TZ);
  const dayEnd = fromZonedTime(`${tehranDateKey}T23:59:59`, TEHRAN_TZ);

  const matches = await fetchMatchesByDate(tehranDateKey, options);

  return matches
    .filter((match) => {
      const kickoff = new Date(match.utcDate).getTime();
      return kickoff >= dayStart.getTime() && kickoff <= dayEnd.getTime();
    })
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}

export function mapFixtureStatus(
  status: string,
): "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED" | "POSTPONED" {
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(status)) return "FINISHED";
  if (["1H", "2H", "HT", "ET", "BT", "LIVE", "P"].includes(status)) return "LIVE";
  if (["CANC", "ABD"].includes(status)) return "CANCELLED";
  if (["PST", "SUSP", "INT", "TBD"].includes(status)) return "POSTPONED";
  return "SCHEDULED";
}

function hasScorePair(pair?: { home: number | null; away: number | null } | null) {
  return pair?.home != null && pair?.away != null;
}

export function readMatchScore(match: FixtureMatch) {
  const fullTime = match.score?.fullTime;
  const regularTime = match.score?.regularTime;
  const isFinished = mapFixtureStatus(match.status) === "FINISHED";

  if (isFinished) {
    if (hasScorePair(fullTime)) {
      return { homeScore: fullTime!.home, awayScore: fullTime!.away };
    }
    return { homeScore: null, awayScore: null };
  }

  if (hasScorePair(regularTime)) {
    return { homeScore: regularTime!.home, awayScore: regularTime!.away };
  }

  return { homeScore: null, awayScore: null };
}
