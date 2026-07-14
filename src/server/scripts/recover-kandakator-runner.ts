import { existsSync, readFileSync } from "node:fs";

const INTERNAL_DB_HOSTS = ["bordindb:3306", "bordindbtest:3306"];

export type RecoverKandakatorOptions = {
  target: "staging" | "production";
  onServer?: boolean;
  days?: number;
  baseUrl?: string;
};

function parseEnvFile(path: string) {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function mergeEnvFiles(paths: string[]) {
  const merged: Record<string, string> = {};
  for (const path of paths) {
    Object.assign(merged, parseEnvFile(path));
  }
  return merged;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function loadRecoverKandakatorEnv(options: RecoverKandakatorOptions) {
  const onServer = options.onServer === true;

  if (!onServer) {
    const envFiles =
      options.target === "production"
        ? [".env", ".env.staging", ".env.production.local"]
        : [".env.staging", ".env.staging.local"];

    const merged = mergeEnvFiles(envFiles);
    for (const [key, value] of Object.entries(merged)) {
      if (value) process.env[key] = value;
    }
  }

  process.env.DEV_MEMORY_DB = "false";

  const defaultUrl =
    options.target === "production" ? "https://bordin.ir" : "https://bordintest.ir";
  let baseUrl =
    options.baseUrl ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    defaultUrl;
  if (/localhost|127\.0\.0\.1/i.test(baseUrl)) {
    baseUrl = defaultUrl;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const hasInternalDbUrl = INTERNAL_DB_HOSTS.some((host) => databaseUrl.includes(`@${host}`));
  const canUseLocalDb = onServer || (Boolean(databaseUrl) && !hasInternalDbUrl);
  const allowHttpPush = options.target === "staging" && !canUseLocalDb;

  return {
    baseUrl,
    token: process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim(),
    canUseLocalDb,
    allowHttpPush,
    onServer,
  };
}

async function pushDateViaHttp(
  baseUrl: string,
  token: string,
  dateKey: string,
  matches: unknown[],
) {
  const res = await fetch(`${baseUrl}/api/internal/kandakator/push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Bordin-Sync-Source": "recover-cli",
    },
    body: JSON.stringify({ date: dateKey, matches, publish: true }),
    signal: AbortSignal.timeout(90_000),
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 300) };
  }

  if (!res.ok) {
    throw new Error(`push failed for ${dateKey}: ${res.status} ${JSON.stringify(json)}`);
  }

  return json as { result?: { matchCount?: number } };
}


export async function runRecoverKandakator(options: RecoverKandakatorOptions) {
  const days = options.days ?? 10;
  const { baseUrl, token, canUseLocalDb, allowHttpPush, onServer } =
    loadRecoverKandakatorEnv(options);

  if (!token && allowHttpPush) {
    throw new Error("KANDAKATOR_SYNC_PUSH_TOKEN is not set in env files.");
  }

  if (options.target === "production" && !canUseLocalDb) {
    throw new Error(
      "Production recover needs direct DB access. Run: npm run recover:kandakator:production",
    );
  }

  const { isFixtureApiConfigured, fetchMatchesForTehranDate } = await import(
    "@/server/services/fixture-api"
  );
  const { getRecentTehranDateKeys } = await import("@/server/services/kandakator-display-ingest");
  const { syncDailyKandakatorFromFootballMatches } = await import(
    "@/server/services/kandakator-sync-service"
  );

  if (!isFixtureApiConfigured()) {
    throw new Error("FIXTURE_API_KEY is not set.");
  }

  const dateKeys = getRecentTehranDateKeys(days);
  const mode = canUseLocalDb ? (onServer ? "liara-shell-db" : "local-db") : "http-push";

  console.info(`[recover-kandakator] target=${options.target} baseUrl=${baseUrl}`);
  console.info(`[recover-kandakator] mode=${mode} days=${dateKeys.length}`);

  let totalMatches = 0;
  const results: Array<{ dateKey: string; matchCount: number; method: string }> = [];

  for (const dateKey of dateKeys) {
    process.stdout.write(`[recover-kandakator] ${dateKey} ... `);

    let matchCount = 0;
    let method = "skip";

    try {
      const matches = await fetchMatchesForTehranDate(dateKey, { noCache: true });

      if (canUseLocalDb) {
        const result = await syncDailyKandakatorFromFootballMatches(dateKey, matches, {
          publish: true,
          source: "recover-cli",
        });
        matchCount = result.matchCount;
        method = onServer ? "liara-shell-db" : "local-db";
      } else if (allowHttpPush && matches.length > 0 && token) {
        const pushed = await pushDateViaHttp(baseUrl, token, dateKey, matches);
        matchCount = pushed.result?.matchCount ?? matches.length;
        method = "http-push";
      } else {
        method = matches.length === 0 ? "no-matches" : "skipped";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`\n[recover-kandakator] error on ${dateKey}: ${message}`);
      method = "failed";
    }

    totalMatches += matchCount;
    results.push({ dateKey, matchCount, method });
    console.info(`${matchCount} matches (${method})`);

    await sleep(1_500);
  }

  console.info(`\n[recover-kandakator] done — ${totalMatches} matches across ${results.length} days`);
  for (const row of results) {
    console.info(`  ${row.dateKey}: ${row.matchCount} (${row.method})`);
  }

  const emptyDays = results.filter((r) => r.matchCount === 0);
  if (emptyDays.length > 0) {
    const hint =
      options.target === "production"
        ? "Check FIXTURE_API_KEY or .env.production.local DATABASE_URL"
        : "Check FIXTURE_API_KEY or public DATABASE_URL in .env.staging.local";
    console.warn(`\n[recover-kandakator] ${emptyDays.length} day(s) still empty. ${hint}`);
    process.exitCode = 1;
  }

  return { totalMatches, results };
}
