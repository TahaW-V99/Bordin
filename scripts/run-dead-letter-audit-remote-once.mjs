import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const scriptFile = path.join(process.cwd(), "prisma", "dead-letter-audit-sql.mjs");
const encoded = fs.readFileSync(scriptFile).toString("base64");
console.log(`Uploading dead-letter audit (${encoded.length} base64 chars)...`);

const remote = `printf '%s' '${encoded}' | base64 -d > /tmp/dead-letter-audit.mjs && node /tmp/dead-letter-audit.mjs && rm -f /tmp/dead-letter-audit.mjs`;

const escaped = remote.replace(/"/g, '\\"');
const result = spawnSync(`npx liara shell --app bordin --command "${escaped}"`, {
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
