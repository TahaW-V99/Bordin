import { spawnSync } from "node:child_process";
const bash = "C:/Program Files/Git/bin/bash.exe";
function toCC(s){return "String.fromCharCode("+[...s].map(c=>c.charCodeAt(0)).join(",")+")";}
const sql = "SELECT id,dateKey,activeDateKey,status,source,attemptCount,maxAttempts,lastError,lastFetchedAt,lastWrittenAt,lastVerifiedAt,createdAt,updatedAt FROM kandakator_sync_jobs WHERE dateKey='2026-07-14' OR activeDateKey='2026-07-14' ORDER BY updatedAt DESC LIMIT 20";
const remote = "node --input-type=module --eval import('mariadb').then(m=>m.default.createConnection(process.env.DATABASE_URL.replace("+toCC("mysql://")+","+toCC("mariadb://")+")).then(c=>c.query("+toCC(sql)+").then(r=>console.log(JSON.stringify(r)))))";
const wrapped = "C:/Users/98902/AppData/Roaming/npm/liara.cmd shell --app bordin --command "+JSON.stringify(remote);
const r = spawnSync(bash,["-lc",wrapped],{encoding:"utf8",maxBuffer:20*1024*1024,timeout:90000});
process.stdout.write(r.stdout||"");
process.stderr.write((r.stderr||"").replace(/Biid[^\s'"]+/g,"[redacted]"));