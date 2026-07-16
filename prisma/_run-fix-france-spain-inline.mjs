import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const liaraCmd = [
  "C:/Users/98902/AppData/Roaming/npm/liara.cmd",
  "C:/Users/98902/AppData/Roaming/npm/liara",
  "liara",
].find((p) => p === "liara" || existsSync(p));

if (!liaraCmd) {
  console.error("liara CLI not found");
  process.exit(1);
}

const oneLine = [
  "(async()=>{",
  'const m=require("mariadb");',
  "const u=new URL(process.env.DATABASE_URL);",
  "const c=await m.createConnection({host:u.hostname,port:+(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)});",
  'const r=await c.query("UPDATE football_matches fm INNER JOIN kandakator_matches km ON km.matchId=fm.id INNER JOIN daily_kandakators dk ON dk.id=km.kandakatorId SET fm.homeScore=CASE WHEN LOWER(fm.homeTeamName) LIKE \'%france%\' THEN 0 ELSE 2 END, fm.awayScore=CASE WHEN LOWER(fm.homeTeamName) LIKE \'%france%\' THEN 2 ELSE 0 END, fm.status=\'FINISHED\', fm.scoresUpdatedAt=UTC_TIMESTAMP(3) WHERE dk.date=\'2026-07-14\' AND dk.isPublished=1 AND (LOWER(fm.homeTeamName) LIKE \'%france%\' OR LOWER(fm.awayTeamName) LIKE \'%france%\') AND (LOWER(fm.homeTeamName) LIKE \'%spain%\' OR LOWER(fm.awayTeamName) LIKE \'%spain%\')");',
  'const rows=await c.query("SELECT fm.id,fm.homeTeamName,fm.awayTeamName,fm.status,fm.homeScore,fm.awayScore FROM football_matches fm INNER JOIN kandakator_matches km ON km.matchId=fm.id INNER JOIN daily_kandakators dk ON dk.id=km.kandakatorId WHERE dk.date=\'2026-07-14\'");',
  "console.log(JSON.stringify({event:'done',updated:r.affectedRows,rows},null,2));",
  "await c.end();",
  "})().catch(e=>{console.error(e);process.exit(1);});",
].join("");

const command = `node -e ${JSON.stringify(oneLine)}`;
console.error("Liara command length:", command.length);

const result = spawnSync(liaraCmd, ["shell", "--app", "bordin", "--command", command], {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  shell: true,
  env: { ...process.env, CI: "true", TERM: "dumb" },
});

process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
console.error("status:", result.status, "error:", result.error?.message ?? null);
process.exit(result.status ?? 1);
