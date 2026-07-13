/**
 * Simulates browser flow against running dev server (localhost:3000).
 * Run: npm run dev  (separate terminal)
 *      npx tsx scripts/verify-browser-predictions-http.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
config({ path: ".env.staging" });

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PHONE = "09124443322";
const PUSH_TOKEN = process.env.KANDAKATOR_SYNC_PUSH_TOKEN ?? "";

function parseCookies(setCookie: string | null, existing = ""): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [k, ...v] = part.split("=");
    if (k) jar.set(k, v.join("="));
  }
  if (setCookie) {
    const first = setCookie.split(";")[0];
    const [k, ...v] = first.split("=");
    if (k) jar.set(k, v.join("="));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(
  path: string,
  options: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; json: unknown; cookie: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  const cookie = parseCookies(setCookie, options.cookie);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, cookie };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

type Km = {
  matchId: string;
  predictionCutoffMinutes: number;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    kickoffAt: string;
    homeScore: number | null;
    awayScore: number | null;
  };
};

type Kandakator = { id: string; matches: Km[] };

async function main() {
  const { tehranDateKey } = await import("../src/server/memory/kandakator-seed.ts");

  let cookie = "";

  const send = await api("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE }),
  });
  assert(send.status === 200, "send-otp");

  const verify = await api("/api/auth/verify-otp", {
    method: "POST",
    cookie: send.cookie,
    body: JSON.stringify({ phone: PHONE, code: "123456" }),
  });
  assert(verify.status === 200, "verify-otp");
  cookie = verify.cookie;

  const nameRes = await api("/api/settings/display-name", {
    method: "PATCH",
    cookie,
    body: JSON.stringify({ displayName: "کاربر تست" }),
  });
  if (nameRes.status !== 200) console.error("display name error:", nameRes.json);
  assert(nameRes.status === 200, "set display name");

  const weekRes = await api("/api/kandakator/week", { cookie });
  const weekDays = (weekRes.json as { days?: Array<{ date: string }> }).days ?? [];

  function findOpenMatch(k: Kandakator) {
    return k.matches.find((km) => {
      const cutoffMin = km.predictionCutoffMinutes ?? 5;
      const kickoff = new Date(km.match.kickoffAt).getTime();
      const cutoff = kickoff - cutoffMin * 60 * 1000;
      return Date.now() < cutoff;
    });
  }

  let kandakator: Kandakator | undefined;
  let km: Km | undefined;

  for (const day of weekDays) {
    const dayRes = await api(`/api/kandakator?date=${day.date}`, { cookie });
    kandakator = (dayRes.json as { kandakator?: Kandakator }).kandakator;
    km = kandakator ? findOpenMatch(kandakator) : undefined;
    if (km) break;
  }

  assert(!!kandakator && !!km, "open match for prediction");

  const pred = await api("/api/predictions/daily", {
    method: "POST",
    cookie,
    body: JSON.stringify({
      matchId: km!.matchId,
      kandakatorId: kandakator!.id,
      homePrediction: 2,
      awayPrediction: 1,
    }),
  });
  if (pred.status !== 200) console.error("prediction error:", pred.json);
  assert(pred.status === 200, "submit prediction");

  const dateKey = tehranDateKey(new Date(km!.match.kickoffAt));
  assert(!!PUSH_TOKEN, "KANDAKATOR_SYNC_PUSH_TOKEN configured");

  const pushRes = await fetch(`${BASE}/api/internal/kandakator/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PUSH_TOKEN}`,
    },
    body: JSON.stringify({
      date: dateKey,
      matches: [
        {
          id: Number.parseInt(km!.matchId.split("-").pop() ?? "", 10) || 999001,
          utcDate: km!.match.kickoffAt,
          status: "FINISHED",
          homeTeam: { id: 1, name: km!.match.homeTeamName },
          awayTeam: { id: 2, name: km!.match.awayTeamName },
          score: { fullTime: { home: 3, away: 1 } },
        },
      ],
    }),
  });
  const pushBody = await pushRes.json().catch(() => ({}));
  if (!pushRes.ok) console.error("push error:", pushBody);
  assert(pushRes.ok, "internal push sets official score");

  const pending = await api("/api/profile/predictions?filter=pending", { cookie });
  assert(pending.status === 200, "GET pending");
  const pendingList = (pending.json as { results: Array<{ id: string }> }).results ?? [];
  const predId = (pred.json as { prediction?: { id: string } }).prediction?.id;
  assert(!pendingList.some((r) => r.id === predId), "pending excludes settled prediction");

  const settled = await api("/api/profile/predictions?filter=settled", { cookie });
  assert(settled.status === 200, "GET settled");
  const settledList = (settled.json as { results: Array<{ id: string; match: { homeScore: number | null } }> }).results ?? [];
  assert(
    settledList.some((r) => r.id === predId && r.match.homeScore === 3),
    "settled includes prediction with official score on first request",
  );

  console.log("\nBrowser HTTP flow verified against dev server.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
