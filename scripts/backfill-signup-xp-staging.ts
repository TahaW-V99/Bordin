import { existsSync, readFileSync } from "node:fs";
import { CoinTransactionType, XpTransactionType } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const SIGNUP_BONUS_XP = 50;

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

const merged = { ...parseEnvFile(".env.staging"), ...parseEnvFile(".env.staging.local") };
for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const users = await prisma.user.findMany({
    include: {
      profile: true,
      xpTransactions: {
        where: { description: "پاداش ثبت‌نام" },
        take: 1,
      },
    },
  });

  const missing = users.filter(
    (u) => u.profile && u.xpTransactions.length === 0 && u.profile.totalXp === 0,
  );

  console.log(`${dryRun ? "[dry-run] " : ""}Found ${missing.length} users missing signup XP bonus`);

  for (const user of missing) {
    console.log(`  ${user.phone} (${user.id.slice(0, 8)})`);
    if (dryRun) continue;

    const firstLevel = await prisma.level.findFirst({ orderBy: { rank: "asc" } });

    await prisma.$transaction([
      prisma.userProfile.update({
        where: { userId: user.id },
        data: {
          totalXp: SIGNUP_BONUS_XP,
          currentLevelId: firstLevel?.id ?? user.profile!.currentLevelId,
        },
      }),
      prisma.xpTransaction.create({
        data: {
          userId: user.id,
          amount: SIGNUP_BONUS_XP,
          type: XpTransactionType.MISSION,
          description: "پاداش ثبت‌نام",
        },
      }),
    ]);
  }

  if (!dryRun && missing.length > 0) {
    const { refreshUserGlobalRank } = await import("../src/server/services/leaderboard-rank-service");
    for (const user of missing) {
      await refreshUserGlobalRank(user.id);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
