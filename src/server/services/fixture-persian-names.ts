import { prisma } from "@/shared/lib/prisma";
import {
  buildFixtureExternalId,
  fetchMatchesForTehranDate,
  type FixtureMatch,
} from "@/server/services/fixture-api";
import {
  isFullyPersianName,
  translateLeagueNameToFa,
  translateTeamNameToFa,
} from "@/shared/lib/football-names-fa";

const LEAGUE_ID_FA: Record<number, string> = {
  2: "لیگ قهرمانان",
  3: "لیگ اروپا",
  39: "لیگ برتر انگلیس",
  61: "لیگ ۱ فرانسه",
  71: "لیگ برتر برزیل",
  72: "لیگ دسته دوم برزیل",
  78: "بوندسلیگا",
  88: "اردیویسه",
  94: "لیگ برتر پرتغال",
  135: "سری آ",
  140: "لالیگا",
  290: "لیگ برتر ایران",
};

/** شناسه تیم — منبع: ویکی‌پedia فارسی / ورزش۳ */
const TEAM_ID_FA: Record<number, string> = {
  118: "باهیا",
  119: "اینترناسیونال",
  120: "بوتافوگو",
  121: "پالمیراس",
  126: "سائوپائولو",
  127: "فلامینگو",
  128: "سانتوس",
  129: "سیارا",
  130: "گریمیو",
  131: "کورینتیانس",
  133: "واسکو د گاما",
  134: "اتلتیکو پارانائنزه",
  135: "کروزیرو",
  151: "گویاس",
  152: "ژوونتوده",
  154: "فلومیننزه",
  794: "ردبول براگانتینو",
  1062: "اتلتیکو مینیرو",
  1193: "میراسول",
  7848: "فورتالزا",
};

const API_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FETCH_CONCURRENCY = 8;

type ApiCacheEntry = { fa: string; fetchedAt: number };

const teamApiCache = new Map<number, ApiCacheEntry>();
const leagueApiCache = new Map<number, ApiCacheEntry>();
const backgroundRefreshInFlight = new Set<string>();

type ApiListResponse<T> = {
  response?: T[];
};

type ApiTeamRow = {
  team?: { id?: number; name?: string; persianname?: string | null };
};

type ApiLeagueRow = {
  league?: { id?: number; name?: string; persianname?: string | null };
};

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
  return (process.env.FIXTURE_API_BASE_URL?.trim() || "https://api.v1.victoryapi.ir").replace(
    /\/$/,
    "",
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickApiPersianName(persian: string | null | undefined) {
  const fa = persian?.trim();
  if (fa && isFullyPersianName(fa)) return fa;
  return null;
}

function readApiTeamCache(teamId: number) {
  const cached = teamApiCache.get(teamId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > API_CACHE_TTL_MS) {
    teamApiCache.delete(teamId);
    return null;
  }
  return cached.fa;
}

function readApiLeagueCache(leagueId: number) {
  const cached = leagueApiCache.get(leagueId);
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > API_CACHE_TTL_MS) {
    leagueApiCache.delete(leagueId);
    return null;
  }
  return cached.fa;
}

async function fetchFixtureApiJson<T>(path: string, params: Record<string, string>) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const url = new URL(`${getApiBase()}/${path.replace(/^\//, "")}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: { "x-vapi-key": apiKey },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as ApiListResponse<T> | null;
      if (!res.ok) {
        if (res.status === 429 && attempt === 0) {
          await sleep(2_000);
          continue;
        }
        return null;
      }
      return json;
    } catch {
      if (attempt === 0) await sleep(500);
    }
  }
  return null;
}

async function fetchTeamPersianFromApi(teamId: number, englishName: string) {
  const cached = readApiTeamCache(teamId);
  if (cached) return cached;

  const json = await fetchFixtureApiJson<ApiTeamRow>("teams", { id: String(teamId) });
  const fa =
    pickApiPersianName(json?.response?.[0]?.team?.persianname) ??
    (TEAM_ID_FA[teamId] ?? translateTeamNameToFa(englishName));

  if (isFullyPersianName(fa)) {
    teamApiCache.set(teamId, { fa, fetchedAt: Date.now() });
  }
  return fa;
}

async function fetchLeaguePersianFromApi(leagueId: number, englishName: string) {
  const cached = readApiLeagueCache(leagueId);
  if (cached) return cached;

  const json = await fetchFixtureApiJson<ApiLeagueRow>("leagues", { id: String(leagueId) });
  const fa =
    pickApiPersianName(json?.response?.[0]?.league?.persianname) ??
    (LEAGUE_ID_FA[leagueId] ?? translateLeagueNameToFa(englishName, leagueId) ?? englishName);

  if (isFullyPersianName(fa)) {
    leagueApiCache.set(leagueId, { fa, fetchedAt: Date.now() });
  }
  return fa;
}

async function runWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(FETCH_CONCURRENCY, queue.length || 1) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

async function warmPersianNamesFromVictoryApi(matches: FixtureMatch[]) {
  if (!getApiKey() || matches.length === 0) return;

  const teamIds = new Map<number, string>();
  const leagueIds = new Map<number, string>();

  for (const match of matches) {
    teamIds.set(match.homeTeam.id, match.homeTeam.name);
    teamIds.set(match.awayTeam.id, match.awayTeam.name);
    if (match.competition?.id) {
      leagueIds.set(match.competition.id, match.competition.name);
    }
  }

  const teamsToFetch = [...teamIds.entries()].filter(([id]) => !readApiTeamCache(id));
  const leaguesToFetch = [...leagueIds.entries()].filter(([id]) => !readApiLeagueCache(id));

  await runWithConcurrency(teamsToFetch, async ([teamId, englishName]) => {
    await fetchTeamPersianFromApi(teamId, englishName);
  });

  await runWithConcurrency(leaguesToFetch, async ([leagueId, englishName]) => {
    await fetchLeaguePersianFromApi(leagueId, englishName);
  });
}

/** نام انگلیسی، نیمه‌فارسی (غلط)، یا ترجمه ناقص */
export function needsPersianNameRefresh(name: string | null | undefined) {
  if (!name?.trim()) return false;
  return !isFullyPersianName(name);
}

/** @deprecated */
export function looksLikeEnglishFootballName(name: string | null | undefined) {
  return needsPersianNameRefresh(name);
}

function resolveLeagueName(leagueId: number | undefined, englishName: string | null) {
  if (leagueId) {
    const fromApi = readApiLeagueCache(leagueId);
    if (fromApi) return fromApi;
    if (LEAGUE_ID_FA[leagueId]) return LEAGUE_ID_FA[leagueId];
  }
  return translateLeagueNameToFa(englishName, leagueId) ?? englishName;
}

function resolveTeamName(teamId: number, englishName: string) {
  const fromApi = readApiTeamCache(teamId);
  if (fromApi) return fromApi;
  if (TEAM_ID_FA[teamId]) return TEAM_ID_FA[teamId];
  return translateTeamNameToFa(englishName);
}

export function localizeFixtureMatchNames(match: FixtureMatch): FixtureMatch {
  return {
    ...match,
    homeTeam: {
      ...match.homeTeam,
      name: resolveTeamName(match.homeTeam.id, match.homeTeam.name),
    },
    awayTeam: {
      ...match.awayTeam,
      name: resolveTeamName(match.awayTeam.id, match.awayTeam.name),
    },
    competition: match.competition
      ? {
          ...match.competition,
          name:
            resolveLeagueName(match.competition.id, match.competition.name) ??
            match.competition.name,
        }
      : undefined,
  };
}

export function localizeFixtureMatches(matches: FixtureMatch[]) {
  return matches.map(localizeFixtureMatchNames);
}

type StoredMatchRow = {
  id: string;
  externalId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string | null;
};

function storedMatchesNeedPersianRefresh(matches: StoredMatchRow[]) {
  return matches.some(
    (row) =>
      needsPersianNameRefresh(row.homeTeamName) ||
      needsPersianNameRefresh(row.awayTeamName) ||
      needsPersianNameRefresh(row.leagueName),
  );
}

async function persistLocalizedMatchesForDate(localized: FixtureMatch[]) {
  if (localized.length === 0) return;

  const byExternalId = new Map(
    localized.map((match) => [buildFixtureExternalId(match.id), match]),
  );

  const externalIds = [...byExternalId.keys()];
  const rows = await prisma.footballMatch.findMany({
    where: { externalId: { in: externalIds } },
    select: { id: true, externalId: true },
  });

  await Promise.all(
    rows.map(async (row) => {
      if (!row.externalId) return;
      const match = byExternalId.get(row.externalId);
      if (!match) return;

      await prisma.footballMatch.update({
        where: { id: row.id },
        data: {
          homeTeamName: match.homeTeam.name,
          awayTeamName: match.awayTeam.name,
          leagueName: match.competition?.name ?? null,
        },
      });
    }),
  );
}

export async function backgroundRefreshPersianNamesForDate(dateKey: string) {
  if (backgroundRefreshInFlight.has(dateKey)) return;
  backgroundRefreshInFlight.add(dateKey);

  try {
    const raw = await fetchMatchesForTehranDate(dateKey, { noCache: true, skipLocalization: true });
    await warmPersianNamesFromVictoryApi(raw);
    const localized = localizeFixtureMatches(raw);
    await persistLocalizedMatchesForDate(localized);
  } catch (error) {
    console.warn(
      `[Bordin:persian-names] background refresh failed for ${dateKey}:`,
      error instanceof Error ? error.message : error,
    );
  } finally {
    backgroundRefreshInFlight.delete(dateKey);
  }
}

export function scheduleBackgroundPersianRefreshForStoredMatches(
  dateKey: string,
  matches: StoredMatchRow[],
) {
  if (!storedMatchesNeedPersianRefresh(matches)) return;
  void backgroundRefreshPersianNamesForDate(dateKey);
}

export async function applyPersianNamesToFixtureMatches(matches: FixtureMatch[]) {
  return localizeFixtureMatches(matches);
}

export async function refreshPersianNamesForStoredMatches(matches: StoredMatchRow[]) {
  await Promise.all(
    matches.map(async (row) => {
      if (
        !needsPersianNameRefresh(row.homeTeamName) &&
        !needsPersianNameRefresh(row.awayTeamName) &&
        !needsPersianNameRefresh(row.leagueName)
      ) {
        return;
      }

      await prisma.footballMatch.update({
        where: { id: row.id },
        data: {
          homeTeamName: translateTeamNameToFa(row.homeTeamName),
          awayTeamName: translateTeamNameToFa(row.awayTeamName),
          leagueName: translateLeagueNameToFa(row.leagueName),
        },
      });
    }),
  );
}

export function resetFixturePersianNameCacheForTests() {
  teamApiCache.clear();
  leagueApiCache.clear();
  backgroundRefreshInFlight.clear();
}
