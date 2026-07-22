/**
 * Fixture API — VictoryAPI (https://victoryapi.ir)
 * Docs: https://victoryapi.ir/Home/Documentation
 * Auth: x-vapi-key
 */

import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TEHRAN_TZ } from "@/shared/lib/dates";

const DEFAULT_API_BASE = "https://api.v1.victoryapi.ir";

type ApiFixture = {
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

type ApiFixturesResponse = {
  response?: ApiFixture[] | Record<string, unknown>;
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

function normalizeApiKey(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.includes(" ") && !trimmed.includes("+")) {
    return trimmed.replace(/ /g, "+");
  }
  return trimmed;
}

function getApiKey() {
  return normalizeApiKey(process.env.FIXTURE_API_KEY?.trim() ?? "");
}

function getApiBase() {
  return (process.env.FIXTURE_API_BASE_URL?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
}

export function isFixtureApiConfigured() {
  return Boolean(getApiKey());
}

function getFetchTimeoutMs(options?: { noCache?: boolean }) {
  const fromEnv = process.env.FIXTURE_API_FETCH_TIMEOUT_MS?.trim();
  if (fromEnv) return Math.max(1000, Number(fromEnv) || 45_000);
  return options?.noCache ? 45_000 : 30_000;
}

// VictoryAPI plan allows 8000 requests/day; cap well below to keep headroom
// for manual scripts, restarts, and a safety margin so the quota never fills.
const DEFAULT_FIXTURE_API_DAILY_BUDGET = 6000;

function fixtureApiDailyBudget() {
  const raw = process.env.FIXTURE_API_DAILY_BUDGET?.trim();
  if (!raw) return DEFAULT_FIXTURE_API_DAILY_BUDGET;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : DEFAULT_FIXTURE_API_DAILY_BUDGET;
}

const apiBudgetState = { dateKey: "", count: 0, warned: false };

/**
 * Global per-day VictoryAPI request budget (in-memory, Tehran day).
 * Returns false once the daily cap is reached so callers degrade to DB data
 * instead of exhausting the upstream quota. Configure via FIXTURE_API_DAILY_BUDGET.
 */
function tryConsumeFixtureApiBudget(): boolean {
  const today = formatInTimeZone(new Date(), TEHRAN_TZ, "yyyy-MM-dd");
  if (apiBudgetState.dateKey !== today) {
    apiBudgetState.dateKey = today;
    apiBudgetState.count = 0;
    apiBudgetState.warned = false;
  }

  const budget = fixtureApiDailyBudget();
  if (apiBudgetState.count >= budget) {
    if (!apiBudgetState.warned) {
      apiBudgetState.warned = true;
      console.warn(
        `[Bordin] fixture API daily budget (${budget}) reached for ${today}; serving from DB until reset`,
      );
    }
    return false;
  }

  apiBudgetState.count += 1;
  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapApiFixture(row: ApiFixture): FixtureMatch {
  const short = row.fixture.status.short;
  const isFinished = ["FT", "AET", "PEN", "AWD", "WO"].includes(short);
  const regularHome = row.goals.home ?? row.score.halftime?.home ?? null;
  const regularAway = row.goals.away ?? row.score.halftime?.away ?? null;
  const fullHome = row.score.fulltime?.home ?? null;
  const fullAway = row.score.fulltime?.away ?? null;
  const homeId = row.teams?.home?.id ?? 0;
  const awayId = row.teams?.away?.id ?? 0;
  const leagueId = row.league?.id ?? 0;

  return {
    id: row.fixture.id,
    utcDate: row.fixture.date,
    status: short,
    homeTeam: {
      id: homeId,
      name: row.teams?.home?.name?.trim() || `Team ${homeId}`,
    },
    awayTeam: {
      id: awayId,
      name: row.teams?.away?.name?.trim() || `Team ${awayId}`,
    },
    competition: {
      id: leagueId,
      name: row.league?.name?.trim() || `League ${leagueId}`,
    },
    score: {
      fullTime: isFinished
        ? { home: fullHome ?? regularHome, away: fullAway ?? regularAway }
        : undefined,
      regularTime: { home: regularHome, away: regularAway },
    },
  };
}

function parseApiErrors(json: ApiFixturesResponse | null) {
  if (!json?.errors) return null;
  if (Array.isArray(json.errors) && json.errors.length === 0) return null;
  const message = Array.isArray(json.errors)
    ? json.errors.join(", ")
    : Object.values(json.errors).join(", ");
  return message || null;
}

function normalizeApiFixtures(response: ApiFixturesResponse["response"]): ApiFixture[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === "object") {
    // VictoryAPI sometimes returns an id-keyed object instead of an array.
    return Object.values(response).filter(
      (row): row is ApiFixture =>
        !!row &&
        typeof row === "object" &&
        "fixture" in row &&
        "teams" in row,
    );
  }
  return [];
}

function parseApiJsonBody(raw: unknown): ApiFixturesResponse | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "string") {
        return JSON.parse(parsed) as ApiFixturesResponse;
      }
      return parsed as ApiFixturesResponse;
    } catch {
      return null;
    }
  }
  return raw as ApiFixturesResponse;
}

async function fetchFixturesFromApi(
  params: Record<string, string>,
  options?: { noCache?: boolean; skipLocalization?: boolean },
): Promise<FixtureMatch[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("FIXTURE_API_KEY در env تنظیم نشده است");
  }

  // One budget unit per logical request — retries must not multiply usage.
  if (!tryConsumeFixtureApiBudget()) {
    throw new Error("fixture_api_daily_budget_exhausted");
  }

  const url = new URL(`${getApiBase()}/fixtures`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (!url.searchParams.has("timezone")) {
    url.searchParams.set("timezone", TEHRAN_TZ);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { "x-vapi-key": apiKey },
        signal: AbortSignal.timeout(getFetchTimeoutMs(options)),
        ...(options?.noCache
          ? { cache: "no-store" as RequestCache }
          : { next: { revalidate: 300 } }),
      });

      const raw = await res.json().catch(() => null);
      const json = parseApiJsonBody(raw);
      const apiError = parseApiErrors(json);

      if (!res.ok) {
        const message = apiError ?? `Fixture API خطا: ${res.status}`;
        if (res.status === 429 || /rate limit/i.test(message)) {
          await sleep(15_000);
          continue;
        }
        throw new Error(message);
      }

      if (apiError) {
        // Permanent API errors must not be retried (burns timeout budget).
        if (/something wrong with the server|Parameter |should enter/i.test(apiError)) {
          throw new Error(apiError);
        }
        throw new Error(apiError);
      }

      const mapped = normalizeApiFixtures(json?.response).map(mapApiFixture);
      if (options?.skipLocalization) return mapped;
      try {
        const { localizeFixtureMatches } = await import("@/server/services/fixture-persian-names");
        return await localizeFixtureMatches(mapped);
      } catch (localizeError) {
        console.warn(
          "[Bordin] fixture localization skipped:",
          localizeError instanceof Error ? localizeError.message : localizeError,
        );
        return mapped;
      }
    } catch (error) {
      if (error instanceof Error && /fetch failed/i.test(error.message)) {
        throw new Error(
          "اتصال به سرویس مسابقات برقرار نشد. کلید API یا دسترسی اینترنت سرور را بررسی کنید.",
        );
      }
      // Do not retry permanent VictoryAPI contract/server errors.
      if (
        error instanceof Error &&
        /something wrong with the server|Parameter |should enter|fixture_api_daily_budget/i.test(
          error.message,
        )
      ) {
        throw error;
      }
      const isLast = attempt >= 2;
      if (isLast) throw error;
      await sleep(2_000 * (attempt + 1));
    }
  }

  throw new Error("Fixture API: rate limit exceeded after retries");
}

function enumerateDateKeys(dateFrom: string, dateTo: string) {
  const start = parseISO(dateFrom);
  const end = parseISO(dateTo);
  const dayCount = Math.max(0, differenceInCalendarDays(end, start));
  return Array.from({ length: dayCount + 1 }, (_, index) => {
    const date = addDays(start, index);
    return date.toISOString().slice(0, 10);
  });
}

export async function fetchMatchesByDate(
  date: string,
  options?: { noCache?: boolean; skipLocalization?: boolean },
) {
  return fetchFixturesFromApi({ date }, options);
}

export async function fetchMatchesInRange(
  dateFrom: string,
  dateTo: string,
  options?: { noCache?: boolean; skipLocalization?: boolean },
) {
  const dates = enumerateDateKeys(dateFrom, dateTo);
  if (dates.length === 0) return [];

  const seen = new Set<number>();
  const merged: FixtureMatch[] = [];

  for (const date of dates) {
    const dayMatches = await fetchMatchesByDate(date, options);
    for (const match of dayMatches) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      merged.push(match);
    }
  }

  return merged.sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );
}

export async function fetchMatchById(
  apiMatchId: number,
  options?: { noCache?: boolean; skipLocalization?: boolean },
) {
  const rows = await fetchFixturesFromApi({ id: String(apiMatchId) }, options);
  return rows[0] ?? null;
}

const DEFAULT_COVERED_LEAGUE_IDS = [
  2, 3, 39, 61, 71, 72, 78, 88, 94, 135, 140, 290,
];

type SeasonCacheEntry = { fetchedAt: number; matches: FixtureMatch[] };
const seasonFixtureCache = new Map<string, SeasonCacheEntry>();

function seasonCacheTtlMs() {
  const raw = process.env.FIXTURE_API_SEASON_CACHE_TTL_MS?.trim();
  if (!raw) return 6 * 60 * 60 * 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 60_000
    ? Math.floor(parsed)
    : 6 * 60 * 60 * 1000;
}

export function getConfiguredFixtureLeagueIds(): number[] {
  const raw = process.env.FIXTURE_API_LEAGUE_IDS?.trim();
  if (raw) {
    const parsed = raw
      .split(/[,\s]+/)
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (parsed.length > 0) return [...new Set(parsed)];
  }
  return DEFAULT_COVERED_LEAGUE_IDS;
}

export function resolveFixtureSeasonForDate(tehranDateKey: string): number {
  const forced = process.env.FIXTURE_API_SEASON?.trim();
  if (forced) {
    const year = Number(forced);
    if (Number.isFinite(year) && year >= 2000) return Math.floor(year);
  }
  const [yearStr, monthStr] = tehranDateKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return new Date().getFullYear();
  }
  // API-Football / VictoryAPI season = start year of the campaign.
  // European leagues: Aug–May. Until July inclusive, use previous calendar year.
  return month >= 8 ? year : year - 1;
}

type LeagueSeasonCacheEntry = { season: number; fetchedAt: number };
const leagueCurrentSeasonCache = new Map<number, LeagueSeasonCacheEntry>();

function leagueSeasonCacheTtlMs() {
  const raw = process.env.FIXTURE_API_LEAGUE_SEASON_CACHE_TTL_MS?.trim();
  if (!raw) return 24 * 60 * 60 * 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 60_000
    ? Math.floor(parsed)
    : 24 * 60 * 60 * 1000;
}

type ApiLeagueSeasonRow = {
  seasons?: Array<{ year?: number; current?: boolean }>;
};

export async function resolveSeasonForLeague(
  leagueId: number,
  tehranDateKey: string,
): Promise<number> {
  const forced = process.env.FIXTURE_API_SEASON?.trim();
  if (forced) {
    const year = Number(forced);
    if (Number.isFinite(year) && year >= 2000) return Math.floor(year);
  }

  const cached = leagueCurrentSeasonCache.get(leagueId);
  if (cached && Date.now() - cached.fetchedAt < leagueSeasonCacheTtlMs()) {
    return cached.season;
  }

  try {
    if (!tryConsumeFixtureApiBudget()) {
      return resolveFixtureSeasonForDate(tehranDateKey);
    }

    const apiKey = getApiKey();
    if (!apiKey) return resolveFixtureSeasonForDate(tehranDateKey);

    const url = new URL(`${getApiBase()}/leagues`);
    url.searchParams.set("id", String(leagueId));
    url.searchParams.set("current", "true");

    const res = await fetch(url.toString(), {
      headers: { "x-vapi-key": apiKey },
      signal: AbortSignal.timeout(getFetchTimeoutMs()),
      next: { revalidate: 3600 },
    });
    const raw = await res.json().catch(() => null);
    const json = parseApiJsonBody(raw) as {
      response?: ApiLeagueSeasonRow[] | Record<string, unknown>;
    } | null;

    if (!res.ok) return resolveFixtureSeasonForDate(tehranDateKey);

    const rows = Array.isArray(json?.response)
      ? json.response
      : json?.response && typeof json.response === "object"
        ? (Object.values(json.response) as ApiLeagueSeasonRow[])
        : [];

    const seasons = rows[0]?.seasons ?? [];
    const current =
      seasons.find((s) => s.current === true)?.year ??
      seasons[seasons.length - 1]?.year ??
      null;

    if (typeof current === "number" && Number.isFinite(current) && current >= 2000) {
      leagueCurrentSeasonCache.set(leagueId, {
        season: Math.floor(current),
        fetchedAt: Date.now(),
      });
      return Math.floor(current);
    }
  } catch (error) {
    console.warn(
      `[Bordin] current season lookup failed for league=${leagueId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  return resolveFixtureSeasonForDate(tehranDateKey);
}

function filterMatchesToTehranDay(matches: FixtureMatch[], tehranDateKey: string) {
  const dayStart = fromZonedTime(`${tehranDateKey}T00:00:00`, TEHRAN_TZ);
  const dayEnd = fromZonedTime(`${tehranDateKey}T23:59:59`, TEHRAN_TZ);
  return matches
    .filter((match) => {
      const kickoff = new Date(match.utcDate).getTime();
      return kickoff >= dayStart.getTime() && kickoff <= dayEnd.getTime();
    })
    .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
}

function mergeFixtureMatches(...groups: FixtureMatch[][]) {
  const seen = new Set<number>();
  const merged: FixtureMatch[] = [];
  for (const group of groups) {
    for (const match of group) {
      if (seen.has(match.id)) continue;
      seen.add(match.id);
      merged.push(match);
    }
  }
  return merged.sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );
}

export async function fetchMatchesByLeagueSeason(
  leagueId: number,
  season: number,
  options?: { noCache?: boolean; skipLocalization?: boolean; forceRefresh?: boolean },
) {
  const cacheKey = `${leagueId}:${season}:loc=${options?.skipLocalization ? "0" : "1"}`;
  const ttl = seasonCacheTtlMs();
  const cached = seasonFixtureCache.get(cacheKey);
  if (cached && !options?.forceRefresh && Date.now() - cached.fetchedAt < ttl) {
    return cached.matches;
  }

  // VictoryAPI fixtures docs: leagueId + season (not "league").
  const matches = await fetchFixturesFromApi(
    { leagueId: String(leagueId), season: String(season) },
    options,
  );
  seasonFixtureCache.set(cacheKey, { fetchedAt: Date.now(), matches });
  return matches;
}

async function fetchMatchesForTehranDateFromLeagues(
  tehranDateKey: string,
  options?: { noCache?: boolean; skipLocalization?: boolean },
) {
  const leagues = getConfiguredFixtureLeagueIds();
  if (leagues.length === 0) return [];

  const seasonMatches: FixtureMatch[] = [];
  const seen = new Set<number>();
  let consecutiveUpstreamFailures = 0;

  for (const leagueId of leagues) {
    try {
      // Default: heuristic season (Aug+ = calendar year, else previous year).
      // Set FIXTURE_API_SEASON_LOOKUP=true to query /leagues?current=true per league
      // when VictoryAPI is healthy (needed for calendar-year leagues like Brazil).
      const lookup =
        process.env.FIXTURE_API_SEASON_LOOKUP?.trim().toLowerCase() === "true" ||
        process.env.FIXTURE_API_SEASON_LOOKUP?.trim() === "1";
      const season = lookup
        ? await resolveSeasonForLeague(leagueId, tehranDateKey)
        : resolveFixtureSeasonForDate(tehranDateKey);

      const rows = await fetchMatchesByLeagueSeason(leagueId, season, options);
      consecutiveUpstreamFailures = 0;
      for (const match of rows) {
        if (seen.has(match.id)) continue;
        seen.add(match.id);
        seasonMatches.push(match);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Bordin] league+season fetch failed for league=${leagueId}:`,
        message,
      );

      if (message === "fixture_api_daily_budget_exhausted") break;

      const upstreamDown =
        /something wrong with the server|fetch failed|timeout|ECONN|ENOTFOUND|rate limit/i.test(
          message,
        );
      if (upstreamDown) {
        consecutiveUpstreamFailures += 1;
        // One upstream outage is enough — fall through to date merge immediately.
        if (consecutiveUpstreamFailures >= 1) {
          console.warn(
            `[Bordin] VictoryAPI unstable — skipping remaining league fetches for ${tehranDateKey}`,
          );
          break;
        }
      } else {
        consecutiveUpstreamFailures = 0;
      }
    }
  }

  return filterMatchesToTehranDay(seasonMatches, tehranDateKey);
}

function shouldUseDateFixtureFallback() {
  const raw = process.env.FIXTURE_API_DATE_FALLBACK?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  return true;
}

export async function fetchMatchesForTehranDate(
  tehranDateKey: string,
  options?: { noCache?: boolean; skipLocalization?: boolean },
) {
  // Date path first (1 request) so a VictoryAPI league outage cannot block the day.
  // League+season then merges extras (VictoryAPI recommendation for ongoing comps).
  let fromDate: FixtureMatch[] = [];
  if (shouldUseDateFixtureFallback()) {
    try {
      fromDate = filterMatchesToTehranDay(
        await fetchMatchesByDate(tehranDateKey, options),
        tehranDateKey,
      );
    } catch (error) {
      console.warn(
        `[Bordin] date fixture fetch failed for ${tehranDateKey}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  let fromLeagues: FixtureMatch[] = [];
  try {
    fromLeagues = await fetchMatchesForTehranDateFromLeagues(tehranDateKey, options);
  } catch (error) {
    console.warn(
      `[Bordin] league+season discovery failed for ${tehranDateKey}:`,
      error instanceof Error ? error.message : error,
    );
  }

  const merged = mergeFixtureMatches(fromLeagues, fromDate);
  if (merged.length === 0 && fromDate.length === 0 && fromLeagues.length === 0) {
    // Re-throw only when both paths produced nothing and date was required.
    if (!shouldUseDateFixtureFallback()) return fromLeagues;
  }
  return merged;
}

export function mapFixtureStatus(
  status: string,
): "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED" | "POSTPONED" {
  if (["FINISHED", "AWARDED", "FT", "AET", "PEN", "AWD", "WO"].includes(status)) {
    return "FINISHED";
  }
  if (["IN_PLAY", "PAUSED", "LIVE", "1H", "2H", "HT", "ET", "BT", "P"].includes(status)) {
    return "LIVE";
  }
  if (["CANCELLED", "SUSPENDED", "CANC", "ABD"].includes(status)) return "CANCELLED";
  if (["POSTPONED", "DELAYED", "PST", "SUSP", "INT", "TBD"].includes(status)) {
    return "POSTPONED";
  }
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
    if (hasScorePair(regularTime)) {
      return { homeScore: regularTime!.home, awayScore: regularTime!.away };
    }
    return { homeScore: null, awayScore: null };
  }

  if (hasScorePair(regularTime)) {
    return { homeScore: regularTime!.home, awayScore: regularTime!.away };
  }

  return { homeScore: null, awayScore: null };
}
