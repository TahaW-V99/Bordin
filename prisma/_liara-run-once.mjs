import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const b64 = readFileSync(
  "c:/Users/98902/OneDrive/Desktop/BordinApp/prisma/query-france-spain-prod.mjs",
).toString("base64");
console.error("b64 len", b64.length);
const remote = `printf '%s' '${b64}' | base64 -d > /tmp/q.mjs && node /tmp/q.mjs && rm -f /tmp/q.mjs`;
console.error("remote len", remote.length);
const r = spawnSync(
  "C:/Users/98902/AppData/Roaming/npm/liara.cmd",
  ["shell", "--app", "bordin", "--command", remote],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, windowsHide: true },
);
console.error("status", r.status, "error", r.error);
process.stdout.write(r.stdout ?? "");
process.stderr.write(r.stderr ?? "");
process.exit(r.status ?? 1);