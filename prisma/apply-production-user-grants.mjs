#!/usr/bin/env node
/**
 * Production grants on bordin.ir (run inside Liara shell).
 *   npm run grant:production:users
 *   liara shell --app bordin --command "node prisma/apply-production-user-grants.mjs"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const GRANT_REF = "admin-grant-2026-07-04";
const MEDAL_REF_PREFIX = "admin-grant";

const CUP_TITLE_TO_SLUG = {
  مهاجم: "cup-normal-60",
  گلزن: "cup-normal-70",
  ستاره: "cup-normal-80",
  آذرخش: "cup-normal-90",
  فاتح: "cup-normal-100",
  سایه: "cup-legend-50",
  کمین: "cup-legend-60",
  طوفان: "cup-legend-70",
  شکار: "cup-legend-80",
  تاج: "cup-legend-90",
  اسطوره: "cup-legend-100",
};

const USER_TARGETS = [
  {
    displayName: "HosseinZ",
    medalTitles: ["طوفان", "اسطوره"],
  },
  {
    displayName: "محمد1",
    sellableCoins: 200,
    systemCoins: 1200,
    points: 2500,
    inviteCount: 1,
    predictionCount: 4,
    medalTitles: ["آذرخش"],
  },
];

const TEAM_TARGETS = [
  {
    teamName: "آبی اناری ها",
    sellableCoins: 1000,
    systemCoins: 630,
    points: 600,
  },
  {
    teamName: "شیاطین سرخ",
    sellableCoins: 1500,
    systemCoins: 660,
    points: 750,
  },
];

function medalSlugsFromTitles(titles) {
  return titles.map((title) => CUP_TITLE_TO_SLUG[title.trim()]).filter(Boolean);
}

function inviteStubPhone(key, index) {
  return `grant-inv-${key}-${index}`;
}

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

async function findTeamByName(prisma, teamName) {
  const teams = await prisma.team.findMany({
    where: { name: { contains: teamName } },
    include: {
      members: {
        include: {
          user: { include: { profile: true, wallet: true } },
        },
      },
    },
    take: 5,
  });

  if (teams.length === 1) return teams[0];
  if (teams.length > 1) {
    const exact = teams.find((t) => t.name === teamName);
    if (exact) return exact;
    throw new Error(`چند تیم برای «${teamName}» یافت شد`);
  }

  throw new Error(`تیم «${teamName}» یافت نشد`);
}

async function applyMedals(tx, userId, key, slugs) {
  for (const slug of slugs) {
    const medal = await tx.medal.findUnique({ where: { slug } });
    if (!medal) throw new Error(`مدال ${slug} یافت نشد`);

    const referenceId = `${MEDAL_REF_PREFIX}:${slug}`;
    const existing = await tx.userMedal.findFirst({
      where: { userId, medalId: medal.id, referenceId },
    });
    if (existing) continue;

    await tx.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
        referenceId,
        earnedReason: `اعطای دستی (${GRANT_REF})`,
      },
    });
  }
}

async function applyInvites(tx, inviterId, key, targetCount) {
  const existingCount = await tx.inviteLog.count({ where: { inviterId } });
  if (existingCount >= targetCount) return;

  for (let index = existingCount; index < targetCount; index += 1) {
    const stubPhone = inviteStubPhone(key, index);
    let stubUser = await tx.user.findUnique({ where: { phone: stubPhone } });
    if (!stubUser) {
      stubUser = await tx.user.create({
        data: {
          phone: stubPhone,
          username: `grant_inv_${key}_${index}`,
          isActive: false,
          profile: { create: { displayName: stubPhone } },
          wallet: { create: {} },
        },
      });
    }

    const existingLog = await tx.inviteLog.findUnique({ where: { inviteeId: stubUser.id } });
    if (existingLog) continue;

    await tx.inviteLog.create({
      data: { inviterId, inviteeId: stubUser.id, coinsAwarded: 0, xpAwarded: 0 },
    });
  }
}

async function resolveLevelId(tx, totalXp) {
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => totalXp >= entry.xpThreshold) ?? levels.at(-1);
  return level?.id ?? null;
}

async function addWalletAndXp(tx, userId, key, { sellableCoins = 0, systemCoins = 0, points = 0 }) {
  const wallet = await tx.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const profile = await tx.userProfile.findUnique({ where: { userId } });
  const nextSellable = wallet.predictionRewardCoins + sellableCoins;
  const nextSystem = wallet.systemRewardCoins + systemCoins;
  const nextXp = (profile?.totalXp ?? 0) + points;

  await tx.coinWallet.update({
    where: { userId },
    data: {
      predictionRewardCoins: nextSellable,
      systemRewardCoins: nextSystem,
    },
  });

  const levelId = await resolveLevelId(tx, nextXp);
  await tx.userProfile.update({
    where: { userId },
    data: {
      totalXp: nextXp,
      currentLevelId: levelId,
    },
  });

  if (points !== 0) {
    await tx.xpTransaction.create({
      data: {
        userId,
        amount: points,
        type: "ADMIN_ADJUSTMENT",
        referenceId: `${GRANT_REF}:${key}`,
        description: "اعطای دستی امتیاز",
      },
    });
  }
}

async function applyUserGrant(prisma, target) {
  const user = await findUserByDisplayName(prisma, target.displayName);
  const key = target.displayName.replace(/\s+/g, "_");
  const medalSlugs = medalSlugsFromTitles(target.medalTitles ?? []);

  await prisma.$transaction(async (tx) => {
    if (medalSlugs.length > 0) {
      await applyMedals(tx, user.id, key, medalSlugs);
    }

    if (target.sellableCoins || target.systemCoins || target.points) {
      await addWalletAndXp(tx, user.id, key, {
        sellableCoins: target.sellableCoins ?? 0,
        systemCoins: target.systemCoins ?? 0,
        points: target.points ?? 0,
      });
    }

    if (target.predictionCount != null) {
      const profile = await tx.userProfile.findUnique({ where: { userId: user.id } });
      const next = Math.max(profile?.totalPredictions ?? 0, target.predictionCount);
      await tx.userProfile.update({
        where: { userId: user.id },
        data: { totalPredictions: next },
      });
    }

    if (target.inviteCount != null) {
      await applyInvites(tx, user.id, key, target.inviteCount);
    }
  });

  return summarizeUser(prisma, user.id);
}

async function applyTeamGrant(prisma, target) {
  const team = await findTeamByName(prisma, target.teamName);
  const results = [];

  for (const member of team.members) {
    const user = member.user;
    const key = `${target.teamName}_${user.id}`.replace(/\s+/g, "_");

    await prisma.$transaction(async (tx) => {
      await addWalletAndXp(tx, user.id, key, {
        sellableCoins: target.sellableCoins,
        systemCoins: target.systemCoins,
        points: target.points,
      });
    });

    results.push(await summarizeUser(prisma, user.id));
  }

  return { teamName: team.name, memberCount: results.length, members: results };
}

async function summarizeUser(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, wallet: true },
  });
  const inviteCount = await prisma.inviteLog.count({ where: { inviterId: userId } });
  const medals = await prisma.userMedal.findMany({
    where: { userId },
    include: { medal: true },
  });

  return {
    phone: user?.phone,
    displayName: user?.profile?.displayName,
    wallet: {
      sellable: user?.wallet?.predictionRewardCoins,
      system: user?.wallet?.systemRewardCoins,
      purchased: user?.wallet?.purchasedCoins,
    },
    totalXp: user?.profile?.totalXp,
    totalPredictions: user?.profile?.totalPredictions,
    inviteCount,
    medals: medals.map((m) => m.medal.titleFa),
  };
}

function parseSingleGrantArgs() {
  const args = process.argv.slice(2);
  const singleIndex = args.indexOf("--single");
  if (singleIndex === -1) return null;

  const displayName = args[singleIndex + 1];
  if (!displayName) throw new Error("Usage: --single <displayName> [--sellable N] [--points N]");

  const readNumberFlag = (flag) => {
    const index = args.indexOf(flag);
    if (index === -1) return 0;
    const value = Number(args[index + 1]);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`Invalid value for ${flag}`);
    }
    return value;
  };

  return {
    displayName,
    sellableCoins: readNumberFlag("--sellable"),
    systemCoins: readNumberFlag("--system"),
    points: readNumberFlag("--points"),
  };
}

async function main() {
  const prisma = createPrisma();
  const singleArgs = parseSingleGrantArgs();
  const results = [];

  if (singleArgs) {
    console.log(`Applying single grant for ${singleArgs.displayName}...`);
    try {
      const result = await applyUserGrant(prisma, singleArgs);
      results.push({ ok: true, type: "user", ...result });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, type: "user", displayName: singleArgs.displayName, error: message });
      console.error(`FAILED ${singleArgs.displayName}: ${message}`);
    }
    await prisma.$disconnect();
    if (results.some((r) => !r.ok)) process.exitCode = 1;
    return;
  }

  for (const target of USER_TARGETS) {
    console.log(`Applying user grants for ${target.displayName}...`);
    try {
      const result = await applyUserGrant(prisma, target);
      results.push({ ok: true, type: "user", ...result });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, type: "user", displayName: target.displayName, error: message });
      console.error(`FAILED ${target.displayName}: ${message}`);
    }
  }

  for (const target of TEAM_TARGETS) {
    console.log(`Applying team grants for ${target.teamName}...`);
    try {
      const result = await applyTeamGrant(prisma, target);
      results.push({ ok: true, type: "team", ...result });
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, type: "team", teamName: target.teamName, error: message });
      console.error(`FAILED ${target.teamName}: ${message}`);
    }
  }

  await prisma.$disconnect();

  if (results.some((r) => !r.ok)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
