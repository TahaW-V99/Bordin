import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  formatCountdown,
  formatTehranTime,
  getPredictionDeadlineInstant,
  getRemainingMsUntilPredictionDeadline,
  parseInstant,
} from "../src/shared/lib/dates";

function parseEnvFile(path: string) {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const isStaging = process.argv.includes("--staging");
if (isStaging) {
  const merged = { ...parseEnvFile(".env.staging"), ...parseEnvFile(".env.staging.local") };
  process.env.DEV_MEMORY_DB = "false";
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
}

function verifyScenario(label: string, kickoffIso: string, nowIso: string, cutoff = 5) {
  const realNow = Date.now;
  Date.now = () => parseInstant(nowIso);

  const kickoffMs = parseInstant(kickoffIso);
  const toKickoffMs = kickoffMs - parseInstant(nowIso);
  const toDeadlineMs = getRemainingMsUntilPredictionDeadline(kickoffIso, cutoff);
  const display = formatTehranTime(kickoffIso);

  console.log(`\n=== ${label} ===`);
  console.log(`kickoff ISO: ${kickoffIso}`);
  console.log(`display Tehran: ${display}`);
  console.log(`now ISO: ${nowIso}`);
  console.log(`to kickoff: ${formatCountdown(toKickoffMs)}`);
  console.log(`to deadline (-${cutoff}m): ${formatCountdown(toDeadlineMs)}`);
  console.log(
    `deadline instant ok: ${new Date(getPredictionDeadlineInstant(kickoffIso, cutoff)).toISOString()}`,
  );

  Date.now = realNow;
}

async function main() {
  verifyScenario(
    "Czech Republic @ 19:30 Tehran, now 14:30 Tehran",
    "2026-06-18T16:00:00.000Z",
    "2026-06-18T11:00:00.000Z",
  );

  verifyScenario(
    "bare Tehran kickoff string (legacy rows)",
    "2026-06-18T19:30:00",
    "2026-06-18T11:00:00.000Z",
  );

  // Belgium vs Egypt style: 22:30 Tehran on 2026-06-15 ≈ 19:00 UTC
  verifyScenario(
    "Belgium example @ 12:29 Tehran",
    "2026-06-15T19:00:00.000Z",
    "2026-06-15T08:59:00.000Z",
  );

  verifyScenario(
    "Belgium example @ 15:31 Tehran (user expected ~6h59 to kickoff)",
    "2026-06-15T19:00:00.000Z",
    "2026-06-15T12:01:00.000Z",
  );

  verifyScenario(
    "UTC ISO without Z suffix (API / JSON artifact)",
    "2026-06-15T19:00:00.000",
    "2026-06-15T12:01:00.000Z",
  );

  verifyScenario(
    "MySQL DATETIME string (UTC naive)",
    "2026-06-22 17:00:00",
    "2026-06-22T12:00:00.000Z",
  );

  const realNow = Date.now;
  Date.now = () => parseInstant("2026-06-15T12:01:00.000Z");
  const withNull = getRemainingMsUntilPredictionDeadline("2026-06-15T19:00:00.000Z", null);
  const withFive = getRemainingMsUntilPredictionDeadline("2026-06-15T19:00:00.000Z", 5);
  console.log(`\nnull vs 5 cutoff diff minutes: ${Math.round((withNull - withFive) / 60000)}`);
  Date.now = realNow;

  if (!isStaging) {
    console.log("\n(staging DB check skipped — pass --staging)");
    return;
  }

  const prisma = new PrismaClient();
  const matches = await prisma.footballMatch.findMany({
    where: {
      OR: [
        { homeTeamName: { contains: "Belgium" } },
        { awayTeamName: { contains: "Belgium" } },
        { homeTeamName: { contains: "Egypt" } },
        { awayTeamName: { contains: "Egypt" } },
        { homeTeamName: { contains: "بلژیک" } },
        { awayTeamName: { contains: "بلژیک" } },
      ],
      kickoffAt: { gte: new Date("2026-06-14T00:00:00.000Z") },
    },
    orderBy: { kickoffAt: "asc" },
    take: 5,
  });

  console.log("\n=== Staging DB matches ===");
  for (const m of matches) {
    const iso = m.kickoffAt.toISOString();
    const ms = getRemainingMsUntilPredictionDeadline(iso, 5);
    console.log(
      `${m.homeTeamName} vs ${m.awayTeamName} | kickoff=${iso} | tehran=${formatTehranTime(iso)} | countdown=${formatCountdown(ms)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
