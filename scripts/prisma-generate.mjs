#!/usr/bin/env node
/**
 * Safe prisma generate on Windows — stops Next dev if it locks query_engine-windows.dll.node.
 */
import { spawnSync, execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectMarker = root.replace(/\\/g, "\\\\");

function listBordinDevPids() {
  if (process.platform !== "win32") return [];

  try {
    const raw = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name = \'node.exe\'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"',
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
    const parsed = JSON.parse(raw || "[]");
    const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
    const marker = root.toLowerCase();

    return rows
      .filter((row) => {
        const cmd = String(row.CommandLine ?? "").toLowerCase();
        if (!cmd.includes(marker)) return false;
        return (
          cmd.includes("next") ||
          cmd.includes("npm-cli.js") && cmd.includes("run dev") ||
          cmd.includes("postcss.js")
        );
      })
      .map((row) => Number(row.ProcessId))
      .filter((pid) => Number.isFinite(pid) && pid > 0);
  } catch {
    return [];
  }
}

function stopDevServers() {
  const pids = listBordinDevPids();
  if (pids.length === 0) return false;

  console.log("⏹  سرور dev در حال اجراست و فایل Prisma را قفل کرده — در حال توقف...");
  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
      } catch {
        // ignore
      }
    }
  }

  spawnSync("powershell", ["-Command", "Start-Sleep -Seconds 2"], { stdio: "ignore" });
  return true;
}

function runGenerate() {
  const prismaDir = path.join(root, "node_modules", ".prisma");
  if (existsSync(prismaDir)) {
    try {
      rmSync(prismaDir, { recursive: true, force: true });
    } catch {
      // continue — generate may still work
    }
  }

  const result = spawnSync("npx", ["prisma", "generate"], {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  return result.status ?? 1;
}

stopDevServers();
const code = runGenerate();

if (code !== 0) {
  console.error(
    "\n❌ prisma generate ناموفق بود.\n" +
      "   اگر هنوز خطای EPERM می‌بینید:\n" +
      "   1) OneDrive را موقتاً pause کنید (پروژه روی Desktop/OneDrive است)\n" +
      "   2) آنتی‌ویروس را برای پوشه پروژه استثنا کنید\n" +
      "   3) دوباره: npm run db:generate\n",
  );
}

process.exit(code);
