import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
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

function liara(command) {
  const result = spawnSync(`liara shell --app bordin --command ${JSON.stringify(command)}`, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: "true", TERM: "dumb" },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) {
    console.error("Liara failed:", command.slice(0, 100));
    process.exit(result.status ?? 1);
  }
}

const scriptPath = path.join(process.cwd(), "prisma", "fix-france-spain-score-prod.mjs");
const b64 = readFileSync(scriptPath).toString("base64");
const chunkSize = 500;
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) chunks.push(b64.slice(i, i + chunkSize));

console.error(`Uploading ${chunks.length} chunks to Liara...`);
liara('node -e "try{require(\'fs\').unlinkSync(\'/tmp/fs.b64\')}catch(e){}"');
for (let i = 0; i < chunks.length; i += 1) {
  console.error(`chunk ${i + 1}/${chunks.length}`);
  liara(`node -e "require('fs').appendFileSync('/tmp/fs.b64','${chunks[i]}')"`);
}
console.error("Decoding...");
liara(
  'node -e "require(\'fs\').writeFileSync(\'/tmp/fix-france-spain-score.mjs\',Buffer.from(require(\'fs\').readFileSync(\'/tmp/fs.b64\',\'utf8\'),\'base64\'))"',
);
console.error("Running fix...");
liara("node /tmp/fix-france-spain-score.mjs");
liara('node -e "try{require(\'fs\').unlinkSync(\'/tmp/fs.b64\');require(\'fs\').unlinkSync(\'/tmp/fix-france-spain-score.mjs\')}catch(e){}"');

const token = parseEnvFile(".env.staging").KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
if (!token) {
  console.error("KANDAKATOR_SYNC_PUSH_TOKEN missing");
  process.exit(1);
}

console.error("\nSettle...");
const settle = spawnSync(
  "curl.exe",
  [
    "-sS",
    "-X",
    "POST",
    "https://bordin.ir/api/internal/kandakator/settle",
    "-H",
    `Authorization: Bearer ${token}`,
  ],
  { encoding: "utf8" },
);
process.stdout.write(settle.stdout ?? "");

console.error("\nHealth...");
const health = spawnSync(
  "curl.exe",
  ["-sS", "https://bordin.ir/api/internal/kandakator/health", "-H", `Authorization: Bearer ${token}`],
  { encoding: "utf8" },
);
try {
  const json = JSON.parse(health.stdout ?? "{}");
  console.error("staleMatchCount:", json.staleMatchCount, "unsettled:", json.unsettledPredictionCount);
} catch {
  process.stdout.write(health.stdout ?? "");
}

process.exit(0);
