import { spawnSync } from "node:child_process";

const inline = [
  "const m=require('mariadb');",
  "(async()=>{",
  "const u=new URL(process.env.DATABASE_URL);",
  "const c=await m.createConnection({host:u.hostname,port:+(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.replace(/^\\//,'')});",
  "const rows=await c.query(\"SELECT fm.id,fm.homeTeamName,fm.awayTeamName,fm.status,fm.homeScore,fm.awayScore FROM football_matches fm INNER JOIN kandakator_matches km ON km.matchId=fm.id INNER JOIN daily_kandakators dk ON dk.id=km.kandakatorId WHERE dk.date='2026-07-14' ORDER BY km.sortOrder\");",
  "console.log(JSON.stringify({event:'verify',rows},null,2));",
  "await c.end();",
  "})().catch(e=>{console.error(e);process.exit(1);});",
].join("");

const command = `node -e ${JSON.stringify(inline)}`;
const result = spawnSync(`liara shell --app bordin --command ${JSON.stringify(command)}`, {
  shell: true,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
process.exit(result.status ?? 1);
