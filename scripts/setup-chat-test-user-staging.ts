/**
 * One-off staging test setup for chat testing on bordintest.ir only.
 * Usage: dotenv -e .env.staging.local -e .env.staging -- tsx scripts/setup-chat-test-user-staging.ts
 */
import { existsSync, readFileSync } from "node:fs";
import {
  ChatMessageType,
  ChatRoomSlug,
  CompetitionType,
  MatchStatus,
  PrismaClient,
} from "@prisma/client";
import {
  formatSystemLevelMessage,
  formatSystemMedalMessage,
  formatSystemPerfectPredictionMessage,
} from "@/shared/lib/chat-logic";

const PHONE = "09010558858";
const MEDAL_SLUG = "sheykarchee-gold";
const CAPTAIN_LEVEL_NAME = "کاپتان بُردین";
const CAPTAIN_XP = 88550;

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

const merged = {
  ...parseEnvFile(".env.staging"),
  ...parseEnvFile(".env.staging.local"),
};
for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}
// Always use real staging DB for this script (local .env may set DEV_MEMORY_DB=true).
process.env.DEV_MEMORY_DB = "false";
process.env.NODE_ENV = "production";

function assertStagingOnly() {
  const dbUrl = (process.env.DATABASE_URL ?? "").toLowerCase();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").toLowerCase();
  const bordinEnv = (process.env.BORDIN_ENV ?? "").toLowerCase();

  const looksLikeStaging =
    bordinEnv === "staging" ||
    dbUrl.includes("bordindbtest") ||
    dbUrl.includes("xenodochial") ||
    appUrl.includes("bordintest");

  if (!looksLikeStaging) {
    throw new Error(
      "این اسکریپت فقط روی staging (bordintest.ir) اجرا می‌شود. DATABASE_URL یا BORDIN_ENV staging نیست.",
    );
  }

  if (dbUrl.includes("bordin:") && !dbUrl.includes("bordindbtest")) {
    throw new Error("DATABASE_URL شبیه production است — اجرا متوقف شد.");
  }
}

const prisma = new PrismaClient();

async function grantMedal(userId: string): Promise<string> {
  const medal = await prisma.medal.findUnique({ where: { slug: MEDAL_SLUG } });
  if (!medal) throw new Error(`مدال ${MEDAL_SLUG} یافت نشد.`);

  const existing = await prisma.userMedal.findFirst({
    where: { userId, medalId: medal.id },
  });
  if (existing) {
    console.log(`✓ مدال ${MEDAL_SLUG} از قبل وجود دارد.`);
    return medal.titleFa;
  }

  await prisma.userMedal.create({
    data: {
      userId,
      medalId: medal.id,
      earnedReason: "تست چت — staging",
    },
  });
  console.log(`✓ مدال ${MEDAL_SLUG} اعطا شد.`);
  return medal.titleFa;
}

async function setCaptainLevel(userId: string) {
  const level = await prisma.level.findFirst({
    where: { nameFa: CAPTAIN_LEVEL_NAME },
  });
  if (!level) throw new Error(`سطح ${CAPTAIN_LEVEL_NAME} یافت نشد.`);

  const before = await prisma.userProfile.findUnique({ where: { userId } });
  await prisma.userProfile.update({
    where: { userId },
    data: {
      totalXp: Math.max(before?.totalXp ?? 0, CAPTAIN_XP),
      currentLevelId: level.id,
    },
  });

  console.log(`✓ سطح به ${CAPTAIN_LEVEL_NAME} (XP ≥ ${CAPTAIN_XP}) تنظیم شد.`);
}

async function seedPerfectPrediction(userId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 2);

  const existing = await prisma.prediction.findFirst({
    where: {
      userId,
      accuracyPercent: 100,
      scoredAt: { not: null },
      submittedAt: { gte: since },
    },
  });
  if (existing) {
    console.log(`✓ پیش‌بینی ۱۰۰٪ اخیر از قبل وجود دارد (${existing.id}).`);
    return;
  }

  const kickoffAt = new Date();
  kickoffAt.setDate(kickoffAt.getDate() - 1);

  const match = await prisma.footballMatch.create({
    data: {
      homeTeamName: "تیم تست بُردین",
      awayTeamName: "حریف تست",
      leagueName: "لیگ تست چت",
      kickoffAt,
      homeScore: 2,
      awayScore: 1,
      status: MatchStatus.FINISHED,
      scoresUpdatedAt: new Date(),
      externalId: `chat-test-${Date.now()}`,
    },
  });

  const now = new Date();
  await prisma.prediction.create({
    data: {
      userId,
      matchId: match.id,
      competitionType: CompetitionType.DAILY,
      competitionRefId: null,
      homePrediction: 2,
      awayPrediction: 1,
      entryFeeCoins: 0,
      accuracyPercent: 100,
      coinsEarned: 1200,
      xpEarned: 900,
      scoredAt: now,
      submittedAt: now,
    },
  });

  await prisma.userProfile.update({
    where: { userId },
    data: {
      totalPredictions: { increment: 1 },
      perfectPredictions: { increment: 1 },
    },
  });

  console.log(`✓ پیش‌بینی ۱۰۰٪ برای مسابقه ${match.homeTeamName} vs ${match.awayTeamName} ثبت شد.`);
}

async function publishChatEvents(userId: string, medalTitleFa: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { displayName: true },
  });
  const displayName = profile?.displayName?.trim() || "کاربر بُردین";

  const bodies = [
    formatSystemMedalMessage(displayName, medalTitleFa),
    formatSystemLevelMessage(displayName, CAPTAIN_LEVEL_NAME),
    formatSystemPerfectPredictionMessage(displayName),
  ];

  for (const body of bodies) {
    await prisma.chatMessage.create({
      data: {
        roomSlug: ChatRoomSlug.PUBLIC,
        type: ChatMessageType.SYSTEM,
        body,
        userId: null,
        teamId: null,
      },
    });
    console.log(`✓ پیام چت: ${body}`);
  }
}

async function main() {
  assertStagingOnly();

  const user = await prisma.user.findUnique({
    where: { phone: PHONE },
    include: { profile: { include: { currentLevel: true } } },
  });

  if (!user) {
    throw new Error(`کاربر ${PHONE} روی staging یافت نشد. ابتدا در bordintest.ir لاگین کنید.`);
  }

  console.log(`Staging setup for ${PHONE} (${user.username ?? user.id})`);
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ":***@")}`);
  console.log(`App: ${process.env.NEXT_PUBLIC_APP_URL ?? "?"}`);
  console.log(`Level before: ${user.profile?.currentLevel?.nameFa ?? "—"}`);

  const medal = await prisma.medal.findUnique({ where: { slug: MEDAL_SLUG } });
  if (!medal) throw new Error(`مدال ${MEDAL_SLUG} یافت نشد.`);

  const medalTitleFa = await grantMedal(user.id);
  await setCaptainLevel(user.id);
  await seedPerfectPrediction(user.id);
  await publishChatEvents(user.id, medalTitleFa ?? medal.titleFa);

  const after = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    include: { currentLevel: true },
  });
  console.log(`Level after: ${after?.currentLevel?.nameFa ?? "—"} (XP: ${after?.totalXp})`);
  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
