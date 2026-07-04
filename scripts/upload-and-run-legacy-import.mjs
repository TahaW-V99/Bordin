#!/usr/bin/env node
/**
 * Upload prisma/legacy-user-import.mjs to Liara production (hex chunks), then run it.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APP = "bordin";
const REMOTE_HEX = "/tmp/legacy-import.hex";
const REMOTE_SCRIPT = "prisma/legacy-user-import.mjs";
const CHUNK_SIZE = 3000;

function runLiara(command) {
  const result =
    process.platform === "win32"
      ? spawnSync(`liara shell --app ${APP} --command "${command.replace(/"/g, '\\"')}"`, {
          stdio: "inherit",
          shell: true,
        })
      : spawnSync("liara", ["shell", "--app", APP, "--command", command], {
          stdio: "inherit",
        });
  if ((result.status ?? 1) !== 0) {
    throw new Error("Liara command failed");
  }
}

const scriptPath = resolve(process.cwd(), "prisma/legacy-user-import.mjs");
const hex = Buffer.from(readFileSync(scriptPath, "utf8"), "utf8").toString("hex");
const chunks = [];

for (let i = 0; i < hex.length; i += CHUNK_SIZE) {
  chunks.push(hex.slice(i, i + CHUNK_SIZE));
}

console.log(`Uploading ${chunks.length} hex chunks to bordin.ir production...\n`);

runLiara(`rm -f ${REMOTE_HEX}`);

for (let i = 0; i < chunks.length; i += 1) {
  const chunk = chunks[i];
  console.log(`Chunk ${i + 1}/${chunks.length}`);
  runLiara(
    `node -e "require('fs').appendFileSync('${REMOTE_HEX}','${chunk}')"`,
  );
}

runLiara(
  "node -e \"require('fs').writeFileSync('prisma/legacy-user-import.mjs',Buffer.from(require('fs').readFileSync('/tmp/legacy-import.hex','utf8'),'hex'))\"",
);
runLiara(`node ${REMOTE_SCRIPT}`);

console.log("\nDone.");
