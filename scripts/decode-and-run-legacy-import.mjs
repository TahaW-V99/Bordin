#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const APP = "bordin";

function liara(command) {
  const result =
    process.platform === "win32"
      ? spawnSync(`liara shell --app ${APP} --command "${command}"`, {
          stdio: "inherit",
          shell: true,
        })
      : spawnSync("liara", ["shell", "--app", APP, "--command", command], { stdio: "inherit" });
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

const decoder =
  "require('fs').writeFileSync('prisma/legacy-user-import.mjs',Buffer.from(require('fs').readFileSync('/tmp/legacy-import.hex','utf8'),'hex'));";
const decoderHex = Buffer.from(decoder, "utf8").toString("hex");

liara(`node -e "require('fs').writeFileSync('/tmp/decode.js',Buffer.from('${decoderHex}','hex'))"`);
liara("node /tmp/decode.js");
liara("node prisma/legacy-user-import.mjs");
