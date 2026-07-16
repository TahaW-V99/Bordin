import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.join(process.cwd(), "prisma", "fix-france-spain-score-prod.mjs");
const b64 = readFileSync(scriptPath).toString("base64");
const chunkSize = 2000;
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) chunks.push(b64.slice(i, i + chunkSize));

function liara(command) {
  const result = spawnSync(`liara shell --app bordin --command ${JSON.stringify(command)}`, {
    shell: true,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) {
    console.error("Liara failed:", command.slice(0, 120));
    process.exit(result.status ?? 1);
  }
}

liara("rm -f /tmp/fs-fix.b64 /tmp/fix-france-spain-score.mjs");
for (let i = 0; i < chunks.length; i += 1) {
  console.error(`Uploading chunk ${i + 1}/${chunks.length}...`);
  liara(`printf '%s' '${chunks[i]}' >> /tmp/fs-fix.b64`);
}
console.error("Decoding...");
liara("base64 -d /tmp/fs-fix.b64 > /tmp/fix-france-spain-score.mjs");
console.error("Running fix...");
liara("node /tmp/fix-france-spain-score.mjs");
liara("rm -f /tmp/fs-fix.b64 /tmp/fix-france-spain-score.mjs");
