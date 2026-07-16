#!/usr/bin/env node
/**
 * Read-only dead-letter audit on Liara production.
 * Invokes Liara through Git Bash so remote shell redirects work on Windows.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const bashCandidates = [
  "C:/Program Files/Git/bin/bash.exe",
  "C:/Program Files (x86)/Git/bin/bash.exe",
];

const bashPath = bashCandidates.find((candidate) => existsSync(candidate));
if (!bashPath) {
  console.error("Git Bash is required on Windows to run the Liara audit upload.");
  process.exit(1);
}

const scriptPath = path.join(process.cwd(), "prisma", "dead-letter-audit-sql.mjs");
const hex = Buffer.from(readFileSync(scriptPath, "utf8"), "utf8").toString("hex");
const chunkSize = 3500;
const chunks = [];

for (let i = 0; i < hex.length; i += chunkSize) {
  chunks.push(hex.slice(i, i + chunkSize));
}

function liara(command) {
  const wrapped = `npx liara shell --app bordin --command ${JSON.stringify(command)}`;
  const result = spawnSync(bashPath, ["-lc", wrapped], {
    encoding: "utf8",
    cwd: process.cwd(),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) {
    console.error(`Liara command failed (${result.status})`);
    process.exit(result.status ?? 1);
  }
}

liara("rm -f /tmp/dl-audit.hex /tmp/dead-letter-audit.mjs && touch /tmp/dl-audit.hex");

for (let i = 0; i < chunks.length; i += 1) {
  console.log(`Uploading chunk ${i + 1}/${chunks.length}...`);
  liara(`printf '%s' '${chunks[i]}' >> /tmp/dl-audit.hex`);
}

console.log("Decoding script and running dead-letter audit...");
liara(
  "node -e \"const fs=require('fs'); fs.writeFileSync('/tmp/dead-letter-audit.mjs', Buffer.from(fs.readFileSync('/tmp/dl-audit.hex','utf8'),'hex'));\"",
);
liara("node /tmp/dead-letter-audit.mjs");
liara("rm -f /tmp/dl-audit.hex /tmp/dead-letter-audit.mjs");
