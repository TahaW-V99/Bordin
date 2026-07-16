import { spawnSync } from "node:child_process";
const bash = "C:/Program Files/Git/bin/bash.exe";
function toCC(s){return "String.fromCharCode("+[...s].map(c=>c.charCodeAt(0)).join(",")+")";}
function q(label, sql){
  const remote = "node --input-type=module --eval import('mariadb').then(m=>m.default.createConnection(process.env.DATABASE_URL.replace("+toCC("mysql://")+","+toCC("mariadb://")+")).then(c=>c.query("+toCC(sql)+").then(r=>console.log(JSON.stringify(r)))))";
  const wrapped = "C:/Users/98902/AppData/Roaming/npm/liara.cmd shell --app bordin --command "+JSON.stringify(remote);
  const r = spawnSync(bash,["-lc",wrapped],{encoding:"utf8",maxBuffer:20*1024*1024,timeout:90000});
  console.log("### "+label+" ###");
  console.log((r.stdout||"").trim());
  if(r.stderr) console.error((r.stderr||"").replace(/Biid[^\s'"]+/g,"[redacted]"));
}
q("daily","SELECT dk.id,dk.date,dk.title,dk.isPublished,dk.entryFeeCoins,dk.updatedAt FROM daily_kandakators dk WHERE dk.date=DATE('2026-07-14')");
q("matches","SELECT fm.id,fm.homeTeamName,fm.awayTeamName,fm.status,fm.homeScore,fm.awayScore,fm.kickoffAt,fm.externalId,km.sortOrder FROM daily_kandakators dk INNER JOIN kandakator_matches km ON km.kandakatorId=dk.id INNER JOIN football_matches fm ON fm.id=km.matchId WHERE dk.date=DATE('2026-07-14') ORDER BY km.sortOrder,fm.kickoffAt");
q("sync","SELECT id,dateKey,activeDateKey,status,source,attemptCount,maxAttempts,lastError,lastFetchedAt,lastWrittenAt,lastVerifiedAt,createdAt,updatedAt FROM kandakator_sync_jobs WHERE dateKey='2026-07-14' OR activeDateKey='2026-07-14' ORDER BY updatedAt DESC LIMIT 20");