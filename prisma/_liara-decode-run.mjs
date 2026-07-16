import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const bashPath = ["C:/Program Files/Git/bin/bash.exe","C:/Program Files (x86)/Git/bin/bash.exe"].find(existsSync);
function liara(command) {
  const wrapped = "C:/Users/98902/AppData/Roaming/npm/liara.cmd shell --app bordin --command " + JSON.stringify(command);
  const result = spawnSync(bashPath, ["-lc", wrapped], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  return result.status ?? 1;
}
const s = liara("node -e \"require('fs').writeFileSync('/tmp/query-france-spain-prod.mjs',Buffer.from(require('fs').readFileSync('/tmp/fs.hex','utf8'),'hex'))\"");
if (s) process.exit(s);
process.exit(liara("node /tmp/query-france-spain-prod.mjs"));