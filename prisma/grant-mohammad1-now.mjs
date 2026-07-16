import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const PHONE = "09213801463";
const SELLABLE = 1200;
const POINTS = 900;
const GRANT_REF = "admin-grant-2026-07-14-mohammad1";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
const parsed = new URL(databaseUrl);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  }),
});

const user = await prisma.user.findUnique({
  where: { phone: PHONE },
  include: { profile: true, wallet: true },
});
if (!user) throw new Error("user not found");

const before = {
  sellable: user.wallet?.predictionRewardCoins ?? 0,
  totalXp: user.profile?.totalXp ?? 0,
};

const existing = await prisma.xpTransaction.findFirst({
  where: { userId: user.id, referenceId: GRANT_REF },
});
if (existing) {
  console.log(JSON.stringify({ ok: true, skipped: true, reason: "already granted", before, after: before }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$transaction(async (tx) => {
  const wallet = await tx.coinWallet.findUnique({ where: { userId: user.id } });
  const profile = await tx.userProfile.findUnique({ where: { userId: user.id } });
  const nextSellable = wallet.predictionRewardCoins + SELLABLE;
  const nextXp = (profile?.totalXp ?? 0) + POINTS;
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => nextXp >= entry.xpThreshold) ?? levels.at(-1);

  await tx.coinWallet.update({
    where: { userId: user.id },
    data: { predictionRewardCoins: nextSellable },
  });
  await tx.userProfile.update({
    where: { userId: user.id },
    data: { totalXp: nextXp, currentLevelId: level?.id ?? null },
  });
  await tx.xpTransaction.create({
    data: {
      userId: user.id,
      amount: POINTS,
      type: "ADMIN_ADJUSTMENT",
      referenceId: GRANT_REF,
      description: "admin grant",
    },
  });
});

const updated = await prisma.user.findUnique({
  where: { id: user.id },
  include: { profile: true, wallet: true },
});

console.log(
  JSON.stringify(
    {
      ok: true,
      displayName: updated?.profile?.displayName,
      phone: updated?.phone,
      granted: { sellableCoins: SELLABLE, points: POINTS },
      before,
      after: {
        sellable: updated?.wallet?.predictionRewardCoins,
        totalXp: updated?.profile?.totalXp,
      },
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
