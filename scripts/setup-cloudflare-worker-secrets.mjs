/**
 * تنظیم secrets ورکر کلادفلر از .env.staging
 * استفاده: npm run cf:worker:setup-secrets
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const root = resolve(__dirname, "..");
const env = {
  ...parseEnvFile(resolve(root, ".env.staging")),
  ...parseEnvFile(resolve(root, ".env.staging.local")),
};

const secrets = [
  { name: "FOOTBALL_DATA_API_KEY", value: env.FOOTBALL_DATA_API_KEY },
  { name: "KANDAKATOR_SYNC_PUSH_TOKEN", value: env.KANDAKATOR_SYNC_PUSH_TOKEN },
  {
    name: "BORDIN_PUSH_URLS",
    value:
      env.BORDIN_PUSH_URLS ??
      [env.BORDIN_STAGING_URL, env.BORDIN_PRODUCTION_URL ?? "https://bordin.ir"]
        .filter(Boolean)
        .join(","),
  },
  {
    name: "CRON_SECRET",
    value: env.KANDAKATOR_SYNC_PUSH_TOKEN,
  },
];

const workerDir = resolve(root, "workers/kandakator-sync");
const missing = secrets.filter((s) => !s.value?.trim() && s.name !== "CRON_SECRET");
if (missing.length) {
  console.error("این مقادیر در .env.staging نیست:");
  for (const m of missing) console.error(`  - ${m.name}`);
  process.exit(1);
}

console.log("→ تنظیم secrets ورکر کلادفلر...\n");
console.log("(اگر ورکر هنوز deploy نشده، اول: npm run cf:worker:deploy)\n");

for (const { name, value } of secrets) {
  if (!value?.trim()) continue;
  const result = spawnSync("npx", ["wrangler", "secret", "put", name], {
    cwd: workerDir,
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    shell: true,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  if (result.status !== 0) {
    if (/verify your email/i.test(output)) {
      console.error("\nایمیل حساب کلادفلر تأیید نشده است.");
      console.error("→ وارد dash.cloudflare.com شوید و ایمیل را verify کنید.");
      console.error("→ بعد: npm run cf:worker:deploy && npm run cf:worker:setup-secrets");
      process.exit(1);
    }
    if (/Not logged in|authentication/i.test(output)) {
      console.error("\nوارد کلادفلر نشده‌اید. اول: npm run cf:worker:login");
      process.exit(1);
    }
    console.error(`\nخطا در ${name}:`);
    console.error(output.trim());
    process.exit(result.status ?? 1);
  }
  console.log(`  ✓ ${name}`);
}

console.log("\nتمام. ورکر آماده است.");
