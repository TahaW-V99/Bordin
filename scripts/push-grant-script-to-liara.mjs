#!/usr/bin/env node
/**
 * Upload prisma/apply-production-user-grants.mjs to Liara and run it.
 * Avoids node -e / rm -f flags that Liara CLI mis-parses.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.join(process.cwd(), "prisma", "apply-production-user-grants.mjs");
const b64 = Buffer.from(readFileSync(scriptPath, "utf8"), "utf8").toString("base64");
const chunkSize = 3500;
const chunks = [];

for (let i = 0; i < b64.length; i += chunkSize) {
  chunks.push(b64.slice(i, i + chunkSize));
}

function liara(command) {
  const result = spawnSync(`liara shell --app bordin --command "${command.replace(/"/g, '\\"')}"`, {
    shell: true,
    encoding: "utf8",
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if ((result.status ?? 1) !== 0) {
    console.error(`Liara command failed (${result.status})`);
    process.exit(result.status ?? 1);
  }
}

liara("printf '' > /tmp/grant.b64");

for (let i = 0; i < chunks.length; i += 1) {
  console.log(`Uploading chunk ${i + 1}/${chunks.length}...`);
  liara(`printf '%s' '${chunks[i]}' >> /tmp/grant.b64`);
}

console.log("Decoding script and running grants...");
liara("base64 --decode /tmp/grant.b64 > prisma/apply-production-user-grants.mjs");
liara("node prisma/apply-production-user-grants.mjs");
