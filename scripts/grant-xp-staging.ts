import { existsSync, readFileSync } from "node:fs";
import { PrismaClient, XpTransactionType } from "@prisma/client";

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

function mergeEnvFiles(paths: string[]) {
  const merged: Record<string, string> = {};
  for (const path of paths) {
    Object.assign(merged, parseEnvFile(path));
  }
  return merged;
}

const isStaging = process.argv.includes("--staging");
const cliArgs = process.argv.slice(2).filter((arg) => arg !== "--staging");
const username = cliArgs[0] ?? "TahaW";
const xpAmount = Number(cliArgs[1] ?? 1000);

if (isStaging) {
  const merged = mergeEnvFiles([".env.staging", ".env.staging.local"]);
  process.env.DEV_MEMORY_DB = "false";
  for (const [key, value] of Object.entries(merged)) {
    process.env[key] = value;
  }
  process.env.DEV_MEMORY_DB = "false";
}

const prisma = new PrismaClient();

async function computeRank(totalXp: number) {
  const higherCount = await prisma.userProfile.count({
    where: { totalXp: { gt: totalXp } },
  });
  return higherCount + 1;
}

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { profile: { displayName: username } }],
    },
    include: { profile: true },
  });

  if (!user?.profile) {
    console.error(`User "${username}" not found on ${isStaging ? "staging" : "local"}.`);
    process.exit(1);
  }

  const beforeXp = user.profile.totalXp;
  const beforeStoredRank = user.profile.globalRank;
  const beforeLiveRank = await computeRank(beforeXp);

  console.log(`User: ${user.username} (${user.id})`);
  console.log(`XP before: ${beforeXp}`);
  console.log(`Stored globalRank: ${beforeStoredRank ?? "null"}`);
  console.log(`Live rank before XP: ${beforeLiveRank}`);

  if (beforeStoredRank === null) {
    const seedRank = beforeLiveRank + 10;
    await prisma.userProfile.update({
      where: { userId: user.id },
      data: { globalRank: seedRank },
    });
    console.log(`Seeded globalRank to ${seedRank} so rank-up notification can fire.`);
  }

  const { addXpWithLevelUp } = await import("@/server/services/wallet-service");
  await addXpWithLevelUp(
    user.id,
    xpAmount,
    XpTransactionType.ADMIN_ADJUSTMENT,
    "تست ارتقای رتبه لیدر برد",
  );

  const after = await prisma.userProfile.findUnique({ where: { userId: user.id } });
  const afterLiveRank = await computeRank(after!.totalXp);

  const notification = await prisma.notification.findFirst({
    where: {
      userId: user.id,
      type: "LEADERBOARD_RANK_UP",
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`XP after: ${after!.totalXp} (+${xpAmount})`);
  console.log(`Stored globalRank after: ${after!.globalRank}`);
  console.log(`Live rank after: ${afterLiveRank}`);
  console.log(
    notification
      ? `LEADERBOARD_RANK_UP notification created: ${notification.id} at ${notification.createdAt.toISOString()}`
      : "No LEADERBOARD_RANK_UP notification created.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
