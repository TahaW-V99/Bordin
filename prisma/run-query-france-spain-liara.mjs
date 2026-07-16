import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const bashPath = [
  "C:/Program Files/Git/bin/bash.exe",
  "C:/Program Files (x86)/Git/bin/bash.exe",
].find((p) => existsSync(p));

const scriptPath = path.join(process.cwd(), "prisma", "query-france-spain-prod.mjs");
const hex = Buffer.from(readFileSync(scriptPath, "utf8"), "utf8").toString("hex");
const chunkSize = 3000;
const chunks = [];
for (let i = 0; i < hex.length; i += chunkSize) chunks.push(hex.slice(i, i + chunkSize));

function liara(command) {
  const wrapped =
    "C:/Users/98902/AppData/Roaming/npm/liara.cmd shell --app bordin --command " +
    JSON.stringify(command);
  const result = spawnSync(bashPath, ["-lc", wrapped], {
    encoding: "utf8",
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) {
    console.error("Liara failed:", command.slice(0, 80), result.stderr);
    process.exit(result.status ?? 1);
  }
}

liara("rm -f /tmp/fs.hex /tmp/query-france-spain-prod.mjs");
for (let i = 0; i < chunks.length; i += 1) {
  console.error(`Uploading chunk ${i + 1}/${chunks.length}...`);
  liara(`printf %s '${chunks[i]}' >> /tmp/fs.hex`);
}
console.error("Decoding with node...");
liara(
  "node -e \"const fs=require('fs');fs.writeFileSync('/tmp/query-france-spain-prod.mjs',Buffer.from(fs.readFileSync('/tmp/fs.hex','utf8'),'hex'));\"",
);
console.error("Running query...");
liara("node /tmp/query-france-spain-prod.mjs");
liara("rm -f /tmp/fs.hex /tmp/query-france-spain-prod.mjs");