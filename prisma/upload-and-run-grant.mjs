import { spawnSync } from "node:child_process";
import fs from "node:fs";

const scriptFile = new URL("./grant-mohammad1-now.mjs", import.meta.url);
const encoded = fs.readFileSync(scriptFile).toString("base64");
console.log(`uploading grant script (${encoded.length} base64 chars)...`);

const remote = `printf '%s' '${encoded}' | base64 -d > /tmp/g.mjs && node /tmp/g.mjs`;

const result = spawnSync("liara", ["shell", "--app", "bordin", "--command", remote], {
  encoding: "utf8",
  shell: true,
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error) {
  console.error("spawn error:", result.error);
}

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
