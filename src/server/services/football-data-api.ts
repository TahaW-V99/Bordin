/**
 * football-data.org v4 — https://www.football-data.org/
 * Auth header: X-Auth-Token
 * Docs: https://docs.football-data.org/general/v4/match.html
 */

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TEHRAN_TZ } from "@/shared/lib/dates";

const API_BASE = "https://api.football-data.org/v4";

export type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string; shortName?: string };
  awayTeam: { id: number; name: string; shortName?: string };
  competition?: { id: number; name: string; code?: string };
  score?: {
    fullTime?: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
  };
};

type FootballDataMatchesResponse = {
  matches?: FootballDataMatch[];
  resultSet?: { count?: number };
  message?: string;
};

function getApiKey() {
  return (
    process.env.FOOTBALL_DATA_API_KEY?.trim() ??
    process.env.API_FOOTBALL_KEY?.trim() ??
    ""
  );
}

export function isFootballDataConfigured() {
  return Boolean(getApiKey());
}

function getFetchTimeoutMs(options?: { noCache?: boolean }) {
  const fromEnv = process.env.FOOTBALL_DATA_FETCH_TIMEOUT_MS?.trim();
  if (fromEnv) return Math.max(1000, Number(fromEnv) || 8000);
  return options?.noCache ? 15_000 : 8_000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRateLimitWaitMs(message: string) {
  const match = message.match(/wait\s+(\d+)\s+seconds?/i);
  if (match) return (Number(match[1]) + 1) * 1000;
  return 15_000;
}

async function fetchMatchesFromApi(
  url: URL,
  options?: { noCache?: boolean },
): Promise<FootballDataMatch[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("FOOTBALL_DATA_API_KEY در env تنظیم نشده است");
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "X-Auth-Token": apiKey,
        },
        signal: AbortSignal.timeout(getFetchTimeoutMs(options)),
        ...(options?.noCache
          ? { cache: "no-store" as RequestCache }
          : { next: { revalidate: 300 } }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        const message = body?.message ?? `football-data.org خطا: ${res.status}`;
        if (res.status === 429 || /request limit/i.test(message)) {
          await sleep(parseRateLimitWaitMs(message));
          continue;
        }
        throw new Error(message);
      }

      const json = (await res.json()) as FootballDataMatchesResponse;
      return json.matches ?? [];
    } catch (error) {
      if (error instanceof Error && /fetch failed/i.test(error.message)) {
        throw new Error(
          "اتصال به سرویس فوتبال برقرار نشد. کلید API یا دسترسی اینترنت سرور را بررسی کنید.",
        );
      }
      const isLast = attempt >= 3;
      if (isLast) throw error;
      await sleep(2_000 * (attempt + 1));
    }
  }

  throw new Error("football-data.org: rate limit exceeded after retries");
}

export async function fetchMatchesByDate(date: string, options?: { noCache?: boolean }) {
  const url = new URL(`${API_BASE}/matches`);
  url.searchParams.set("date", date);
  return fetchMatchesFromApi(url, options);
}

export async function fetchMatchesInRange(
  dateFrom: string,
  dateTo: string,
  options?: { noCache?: boolean },
) {
  const url = new URL(`${API_BASE}/matches`);
  url.searchParams.set("dateFrom", dateFrom);
  url.searchParams.set("dateTo", dateTo);
  return fetchMatchesFromApi(url, options);
}

/** football-data.org filters by UTC calendar date — overlap both UTC days for a Tehran day. */
export async function fetchMatchesForTehranDate(
  tehranDateKey: string,
  options?: { noCache?: boolean },
) {
  const dayStart = fromZonedTime(`${tehranDateKey}T00:00:00`, TEHRAN_TZ);
  const dayEnd = fromZonedTime(`${tehranDateKey}T23:59:59`, TEHRAN_TZ);
  const utcDateKeys = new Set([
    formatInTimeZone(dayStart, "UTC", "yyyy-MM-dd"),
    formatInTimeZone(dayEnd, "UTC", "yyyy-MM-dd"),
  ]);

  const byId = new Map<number, FootballDataMatch>();
  let utcIndex = 0;
  for (const utcDate of utcDateKeys) {
    if (utcIndex > 0) await sleep(7_000);
    const matches = await fetchMatchesByDate(utcDate, options);
    utcIndex += 1;
    for (const match of matches) {
      const kickoff = new Date(match.utcDate).getTime();
      if (kickoff >= dayStart.getTime() && kickoff <= dayEnd.getTime()) {
        byId.set(match.id, match);
      }
    }
  }

  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );
}

export function mapFootballDataStatus(
  status: string,
): "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED" | "POSTPONED" {
  if (status === "FINISHED" || status === "AWARDED") return "FINISHED";
  if (status === "IN_PLAY" || status === "PAUSED" || status === "LIVE") return "LIVE";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "POSTPONED" || status === "SUSPENDED") return "POSTPONED";
  return "SCHEDULED";
}

function hasScorePair(pair?: { home: number | null; away: number | null } | null) {
  return pair?.home != null && pair?.away != null;
}

/** Scores safe for settlement / final display — only fullTime when the match is finished. */
export function readMatchScore(match: FootballDataMatch) {
  const fullTime = match.score?.fullTime;
  const regularTime = match.score?.regularTime;
  const isFinished = match.status === "FINISHED" || match.status === "AWARDED";

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
