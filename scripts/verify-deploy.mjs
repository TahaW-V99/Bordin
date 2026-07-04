import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const LOG = "debug-e9ba03.log";
const ENDPOINT = "http://127.0.0.1:7691/ingest/b6f32e15-6761-4ce2-baa4-8776ab48b46d";

function log(hypothesisId, message, data) {
  const entry = {
    sessionId: "e9ba03",
    hypothesisId,
    location: "scripts/verify-deploy.mjs",
    message,
    data,
    timestamp: Date.now(),
    runId: "pre-deploy",
  };
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e9ba03" },
    body: JSON.stringify(entry),
  }).catch(() => {});
  appendFileSync(LOG, JSON.stringify(entry) + "\n");
}

const lockExists = existsSync("package-lock.json");
const npmrc = existsSync(".npmrc") ? readFileSync(".npmrc", "utf8") : "";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

log("D", "lockfile presence", {
  lockExists,
  lockSize: lockExists ? readFileSync("package-lock.json").length : 0,
});
log("A", "postinstall script check", {
  hasPostinstall: Boolean(pkg.scripts?.postinstall),
  hasInstallScriptInLock: lockExists
    ? readFileSync("package-lock.json", "utf8").includes('"hasInstallScript": true')
    : false,
});
log("B", "npmrc optional omit", { npmrc: npmrc.trim() });

try {
  execSync("npm ci", { stdio: "pipe", env: { ...process.env, CI: "true" } });
  log("A", "npm ci succeeded locally", { ok: true });
  console.log("OK: npm ci passed — safe to run liara deploy");
} catch (e) {
  log("A", "npm ci failed locally", {
    ok: false,
    stderr: String(e.stderr || e.message).slice(0, 500),
  });
  console.error("FAIL: npm ci failed — fix before deploy");
  console.error(String(e.stderr || e.message));
  process.exit(1);
}
