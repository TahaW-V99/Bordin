#!/usr/bin/env node
/**
 * One-off production grant for a single user by displayName.
 *   liara shell --app bordin --command "node prisma/grant-user-single.mjs"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const GRANT_REF = "admin-grant-2026-07-14-mohammad1";

const TARGET = {
  displayName: "محمد1",
  sellableCoins: 1200,
  points: 900,
};

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

async function findUserByDisplayName(prisma, displayName) {
  const users = await prisma.user.findMany({
    where: { profile: { displayName: { contains: displayName } } },
    include: { profile: true, wallet: true },
    take: 10,
  });

  if (users.length === 1) return users[0];
  if (users.length > 1) {
    const exact = users.find((u) => u.profile?.displayName === displayName);
    if (exact) return exact;
    throw new Error(`چند کاربر برای «${displayName}» یافت شد`);
  }

  throw new Error(`کاربر «${displayName}» یافت نشد`);
}

async function resolveLevelId(tx, totalXp) {
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => totalXp >= entry.xpThreshold) ?? levels.at(-1);
  return level?.id ?? null;
}

async function main() {
  const prisma = createPrisma();
  const user = await findUserByDisplayName(prisma, TARGET.displayName);

  const before = {
    sellable: user.wallet?.predictionRewardCoins ?? 0,
    totalXp: user.profile?.totalXp ?? 0,
  };

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.coinWallet.findUnique({ where: { userId: user.id } });
    if (!wallet) throw new Error("کیف پول یافت نشد");

    const profile = await tx.userProfile.findUnique({ where: { userId: user.id } });
    const nextSellable = wallet.predictionRewardCoins + TARGET.sellableCoins;
    const nextXp = (profile?.totalXp ?? 0) + TARGET.points;

    await tx.coinWallet.update({
      where: { userId: user.id },
      data: { predictionRewardCoins: nextSellable },
    });

    const levelId = await resolveLevelId(tx, nextXp);
    await tx.userProfile.update({
      where: { userId: user.id },
      data: { totalXp: nextXp, currentLevelId: levelId },
    });

    await tx.xpTransaction.create({
      data: {
        userId: user.id,
        amount: TARGET.points,
        type: "ADMIN_ADJUSTMENT",
        referenceId: GRANT_REF,
        description: "اعطای دستی امتیاز",
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
        granted: {
          sellableCoins: TARGET.sellableCoins,
          points: TARGET.points,
        },
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
