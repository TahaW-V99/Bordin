import { spawnSync } from "node:child_process";
import fs from "node:fs";

const grantPath = new URL("../prisma/grant-mohammad1-min.mjs", import.meta.url);
const grantSource = fs.readFileSync(grantPath, "utf8");
const grantB64 = Buffer.from(grantSource, "utf8").toString("base64");

const inline = [
  "const fs=require('fs');",
  "const {execSync}=require('child_process');",
  `fs.writeFileSync('/app/prisma/g.mjs',Buffer.from('${grantB64}','base64'));`,
  "execSync('node /app/prisma/g.mjs',{stdio:'inherit'});",
].join("");

const command = `node -e "${inline.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const result = spawnSync("liara", ["shell", "--app", "bordin", `--command=${command}`], {
  encoding: "utf8",
  shell: false,
  maxBuffer: 10 * 1024 * 1024,
});

if (result.error) console.error(result.error);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
