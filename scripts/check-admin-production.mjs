#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const phones = process.argv.slice(2);
if (phones.length === 0) {
  console.error("Usage: node scripts/check-admin-production.mjs <phone> [phone...]");
  process.exit(1);
}

const phoneList = phones.map((p) => JSON.stringify(p)).join(",");
const nodeScript = [
  "(async()=>{",
  "const {PrismaClient}=require('@prisma/client');",
  "const p=new PrismaClient();",
  `for(const phone of [${phoneList}]){`,
  "const u=await p.user.findUnique({where:{phone},select:{phone:true,role:true,username:true}});",
  "console.log(JSON.stringify(u??{phone,status:'NOT_FOUND'}));",
  "}",
  "await p.$disconnect();",
  "})().catch(e=>{console.error(e);process.exit(1);});",
].join("");

const remoteCommand = `node -e ${JSON.stringify(nodeScript)}`;
const result = spawnSync(`liara shell --app bordin --command "${remoteCommand.replace(/"/g, '\\"')}"`, {
  encoding: "utf8",
  shell: true,
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 0);
