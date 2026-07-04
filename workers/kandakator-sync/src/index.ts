/**
 * Queue-driven kandakator sync worker.
 * Cron/manual requests only enqueue per-date jobs in the app.
 * The app queue processor then asks this worker to fetch a single date synchronously.
 */

import { addDays, startOfWeek } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const TEHRAN_TZ = "Asia/Tehran";
const UTC_SLEEP_MS = 2_000;

type FootballMatch = {
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

type Env = {
  FOOTBALL_DATA_API_KEY: string;
  KANDAKATOR_SYNC_PUSH_TOKEN: string;
  BORDIN_PUSH_URL?: string;
  BORDIN_PUSH_URLS?: string;
  CRON_SECRET?: string;
};

type QueueJobRequest = {
  jobId?: string;
  date: string;
  targetBaseUrl: string;
  source?: string;
};

function resolveAppTargets(env: Env): string[] {
  const raw =
    env.BORDIN_PUSH_URLS?.trim() ||
    env.BORDIN_PUSH_URL?.trim() ||
    "https://bordintest.ir,https://bordin.ir";
  return [...new Set(raw.split(",").map((u) => u.trim().replace(/\/$/, "")).filter(Boolean))];
}

function tehranDateKey(date: Date) {
  return formatInTimeZone(date, TEHRAN_TZ, "yyyy-MM-dd");
}

function getTehranWeekDays() {
  const tehranNow = toZonedTime(new Date(), TEHRAN_TZ);
  const weekStart = startOfWeek(tehranNow, { weekStartsOn: 6 });
  const start = fromZonedTime(weekStart, TEHRAN_TZ);
  return Array.from({ length: 7 }, (_, i) => tehranDateKey(addDays(start, i)));
}

function getDaysToSyncThisRun() {
  const week = getTehranWeekDays();
  const todayKey = tehranDateKey(new Date());
  const todayIdx = Math.max(0, week.indexOf(todayKey));
  const rotateIdx = Math.floor(Date.now() / (20 * 60 * 1000)) % week.length;

  return [...new Set([todayIdx - 1, todayIdx, todayIdx + 1, rotateIdx])]
    .filter((i) => i >= 0 && i < week.length)
    .map((i) => week[i]);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url: string, init: RequestInit, attempts = 5) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`http_${res.status}:${body.slice(0, 180)}`);
      }
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await sleep(1_500 * 2 ** attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchMatchesByUtcDate(apiKey: string, date: string) {
  const url = `https://api.football-data.org/v4/matches?date=${date}`;
  const res = await fetchJsonWithRetry(url, {
    headers: { "X-Auth-Token": apiKey },
  });
  const json = (await res.json()) as { matches?: FootballMatch[] };
  return json.matches ?? [];
}

async function fetchMatchesForTehranDate(apiKey: string, dateKey: string) {
  const dayStart = fromZonedTime(`${dateKey}T00:00:00`, TEHRAN_TZ);
  const dayEnd = fromZonedTime(`${dateKey}T23:59:59`, TEHRAN_TZ);
  const utcDates = [
    ...new Set([
      formatInTimeZone(dayStart, "UTC", "yyyy-MM-dd"),
      formatInTimeZone(dayEnd, "UTC", "yyyy-MM-dd"),
    ]),
  ];

  const byId = new Map<number, FootballMatch>();
  for (let index = 0; index < utcDates.length; index++) {
    if (index > 0) await sleep(UTC_SLEEP_MS);
    const matches = await fetchMatchesByUtcDate(apiKey, utcDates[index]);
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

async function enqueueDatesForTarget(env: Env, baseUrl: string, dates: string[], source: string) {
  const res = await fetchJsonWithRetry(`${baseUrl}/api/internal/kandakator/enqueue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.KANDAKATOR_SYNC_PUSH_TOKEN}`,
      "Content-Type": "application/json",
      "X-Bordin-Sync-Source": source,
    },
    body: JSON.stringify({ dates, source }),
  });

  return res.json();
}

export async function enqueueSyncJobs(env: Env) {
  const token = env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  const targets = resolveAppTargets(env);
  if (!token) throw new Error("KANDAKATOR_SYNC_PUSH_TOKEN تنظیم نشده");
  if (targets.length === 0) throw new Error("BORDIN_PUSH_URLS تنظیم نشده");

  const dates = getDaysToSyncThisRun();
  const result = [];
  for (const baseUrl of targets) {
    await enqueueDatesForTarget(env, baseUrl, dates, "cloudflare-cron");
    result.push({ target: baseUrl, dates });
  }
  return { queued: result };
}

async function runSingleDateFetch(env: Env, input: QueueJobRequest) {
  const apiKey = env.FOOTBALL_DATA_API_KEY?.trim();
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY تنظیم نشده");
  const matches = await fetchMatchesForTehranDate(apiKey, input.date);
  return {
    success: true,
    jobId: input.jobId ?? null,
    date: input.date,
    fetchedCount: matches.length,
    matches,
  };
}

function authorizeManual(request: Request, env: Env) {
  const secret = env.CRON_SECRET?.trim() || env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      enqueueSyncJobs(env)
        .then((result) => console.log("[bordin-sync] queued", JSON.stringify(result)))
        .catch((error) => console.error("[bordin-sync] queue", error)),
    );
  },

  async fetch(request: Request, env: Env) {
    if (!authorizeManual(request, env)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (request.method === "POST") {
      const body = (await request.json()) as QueueJobRequest;
      try {
        const result = await runSingleDateFetch(env, body);
        return Response.json(result);
      } catch (error) {
        return Response.json(
          {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            date: body.date,
            jobId: body.jobId ?? null,
          },
          { status: 500 },
        );
      }
    }

    const queued = await enqueueSyncJobs(env);
    return Response.json(queued);
  },
};
