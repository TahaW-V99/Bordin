import { spawnSync } from "node:child_process";

const oneLine = [
  "(async()=>{",
  'const m=require("mariadb");',
  "const u=new URL(process.env.DATABASE_URL);",
  "const c=await m.createConnection({host:u.hostname,port:+(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password),database:u.pathname.slice(1)});",
  'const rows=await c.query("SELECT fm.id,fm.homeTeamName,fm.awayTeamName,fm.status,fm.homeScore,fm.awayScore FROM football_matches fm INNER JOIN kandakator_matches km ON km.matchId=fm.id INNER JOIN daily_kandakators dk ON dk.id=km.kandakatorId WHERE dk.date=\'2026-07-14\'");',
  "console.log(JSON.stringify({event:'verify',rows},null,2));",
  "await c.end();",
  "})().catch(e=>{console.error(e);process.exit(1);});",
].join("");

const nodeCmd = `node -e ${JSON.stringify(oneLine)}`;
spawnSync(`liara shell --app bordin --command ${JSON.stringify(nodeCmd)}`, {
  shell: true,
  stdio: "inherit",
  env: { ...process.env, CI: "true", TERM: "dumb" },
});
