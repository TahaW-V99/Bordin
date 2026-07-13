#!/usr/bin/env node
/**
 * Fetch production public DATABASE_URL from Liara API and write .env.production.local
 * Usage: node scripts/setup-production-local-env.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DB_NAME = "bordindb";
const API_BASE = "https://api.iran.liara.ir";

function readLiaraToken() {
  const authPath = join(homedir(), ".liara-auth.json");
  if (!existsSync(authPath)) throw new Error("Liara auth not found. Run: liara login");
  const auth = JSON.parse(readFileSync(authPath, "utf8"));
  const account = Object.values(auth.accounts ?? {}).find((a) => a.current) ?? Object.values(auth.accounts ?? {})[0];
  const token = account?.api_token?.trim();
  if (!token) throw new Error("Liara API token not found");
  return token;
}

function parseEnvFile(path) {
  const env = {};
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

async function apiFetch(token, path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Liara API ${path} failed: ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const token = readLiaraToken();
  const list = await apiFetch(token, "/v1/databases");
  const databases = list.databases ?? list ?? [];
  const entry = databases.find((db) => db.hostname === DB_NAME || db.name === DB_NAME || db.dbName === DB_NAME);
  if (!entry?.id && !entry?._id) {
    throw new Error(`Database ${DB_NAME} not found in Liara API response`);
  }

  const id = entry.id ?? entry._id;
  let details = await apiFetch(token, `/v1/databases/${id}`);
  let db = details.database ?? details;

  const network = db.network ?? {};
  const host =
    db.node?.host ??
    db.host ??
    db.publicHost ??
    network.publicHost ??
    network.host ??
    "logan.liara.cloud";
  const port = db.port ?? db.publicPort ?? network.port;
  const username = db.username ?? "root";
  const password = db.root_password ?? db.password;
  const database = db.dbName ?? "naughty_shannon";

  if (!port || !password) {
    console.error("[setup] API fields:", JSON.stringify({
      publicNetwork: db.publicNetwork,
      hostname: db.hostname,
      port: db.port,
      network: db.network,
      hasRootPassword: Boolean(db.root_password),
    }));
    throw new Error(
      `Incomplete DB details from Liara API. publicNetwork=${db.publicNetwork}.`,
    );
  }

  const publicUrl = `mysql://${username}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  const fixtureKey = parseEnvFile(".env").FIXTURE_API_KEY ?? parseEnvFile(".env.staging").FIXTURE_API_KEY ?? "";

  const content = `# Auto-generated for local production tools (recover, grant-admin)
# Public MySQL — Liara bordindb

DATABASE_URL="${publicUrl}"
DEV_MEMORY_DB=false
NEXT_PUBLIC_APP_URL=https://bordin.ir
FIXTURE_API_KEY=${fixtureKey}
`;

  writeFileSync(".env.production.local", content, "utf8");
  console.log(
    `[setup] Wrote .env.production.local (${host}:${port}/${database}, publicNetwork=${db.publicNetwork}, network=${JSON.stringify(db.network ?? null)})`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
