import { spawnSync } from "node:child_process";
const bash = "C:/Program Files/Git/bin/bash.exe";
function toCC(s){return "String.fromCharCode("+[...s].map(c=>c.charCodeAt(0)).join(",")+")";}
function connect(){
  return "import('mariadb').then(m=>m.default.createConnection(process.env.DATABASE_URL.replace("+toCC("mysql://")+","+toCC("mariadb://")+"))";
}
function run(label, sql){
  const remote = "node --input-type=module --eval "+connect()+".then(c=>c.query("+toCC(sql)+").then(r=>console.log(JSON.stringify(r)))))";
  console.error(label, "len", remote.length);
  const wrapped = "C:/Users/98902/AppData/Roaming/npm/liara.cmd shell --app bordin --command "+JSON.stringify(remote);
  const r = spawnSync(bash,["-lc",wrapped],{encoding:"utf8",maxBuffer:20*1024*1024});
  console.log("=== "+label+" ===");
  const out=(r.stdout||"")+(r.stderr||"");
  console.log(out.replace(/Biid[^\s'"]+/g,"[redacted]").replace(/mysql:\/\/root:[^@]+@/g,"mariadb://root:[redacted]@"));
}
const queries={
  dailyKandakator:"SELECT dk.id,dk.date,dk.title,dk.isPublished,dk.entryFeeCoins,dk.updatedAt,(SELECT COUNT(*) FROM kandakator_matches km WHERE km.kandakatorId=dk.id) matchCount FROM daily_kandakators dk WHERE dk.date=DATE('2026-07-14')",
  allMatches:"SELECT fm.id,fm.homeTeamName,fm.awayTeamName,fm.status,fm.homeScore,fm.awayScore,fm.kickoffAt,fm.externalId,km.sortOrder FROM daily_kandakators dk INNER JOIN kandakator_matches km ON km.kandakatorId=dk.id INNER JOIN football_matches fm ON fm.id=km.matchId WHERE dk.date=DATE('2026-07-14') ORDER BY km.sortOrder,fm.kickoffAt",
  syncJobs:"SELECT id,dateKey,activeDateKey,status,source,attemptCount,maxAttempts,lastError,lastFetchedAt,lastWrittenAt,lastVerifiedAt,createdAt,updatedAt FROM kandakator_sync_jobs WHERE dateKey='2026-07-14' OR activeDateKey='2026-07-14' ORDER BY updatedAt DESC LIMIT 20",
  franceSpain:"SELECT fm.id,fm.homeTeamName,fm.awayTeamName,fm.status,fm.homeScore,fm.awayScore,fm.kickoffAt,fm.externalId,fm.scoresUpdatedAt,dk.date kandakatorDate,dk.id kandakatorId FROM football_matches fm INNER JOIN kandakator_matches km ON km.matchId=fm.id INNER JOIN daily_kandakators dk ON dk.id=km.kandakatorId WHERE dk.date BETWEEN DATE('2026-07-13') AND DATE('2026-07-15') AND (fm.homeTeamName LIKE CONCAT('%',UNHEX('D981D8A7D8A7D986D8B3'),'%') OR fm.awayTeamName LIKE CONCAT('%',UNHEX('D981D8A7D8A7D986D8B3'),'%') OR fm.homeTeamName LIKE CONCAT('%',UNHEX('D8A7D8B3D9BED8A7D986'),'%') OR fm.awayTeamName LIKE CONCAT('%',UNHEX('D8A7D8B3D9BED8A7D986'),'%')) ORDER BY fm.kickoffAt",
};
for (const [k,v] of Object.entries(queries)) run(k,v);