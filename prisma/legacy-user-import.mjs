#!/usr/bin/env node
/**
 * Self-contained legacy user import for Liara production (bordin.ir).
 * Remote: liara shell --app bordin --command "node scripts/migrate-legacy-users-remote.mjs"
 * Local production URL: node scripts/migrate-legacy-users-remote.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const LEGACY_IMPORT_REF = "legacy-user-import";
const LEGACY_MEDAL_REF_PREFIX = "legacy-import";
const STATUS = { PENDING: "PENDING", APPLIED: "APPLIED", FAILED: "FAILED" };

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

const TOURNAMENT_TITLE_TO_SLUG = {
  فاتح: "tournament-fateh",
  پیروز: "tournament-pirooz",
  پیشرو: "tournament-pishro",
};

const MISSION_PROGRESS_RULES = [
  { label: "وفادار", source: "total_predictions", thresholds: [110, 210, 320, 500] },
  { label: "شکارچی", source: "perfect_predictions", thresholds: [18, 25, 35, 55] },
];

const NONE_VALUES = new Set(["ندارد", "نداره", "خالی", ""]);

const DEFAULT_LEGACY_USERS = [
  {
    phone: "9374425794",
    sellableCoins: 1000,
    systemCoins: 10000,
    purchasedCoins: 0,
    points: 39700,
    cupMedals: "طوفان - اسطوره",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 94,
    perfectPredictionCount: 6,
  },
  {
    phone: "9376910074",
    sellableCoins: 1000,
    systemCoins: 10000,
    purchasedCoins: 0,
    points: 42434,
    cupMedals: "تاج - طوفان",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 9,
    predictionCount: 86,
    perfectPredictionCount: 9,
  },
  {
    phone: "9377320190",
    sellableCoins: 1000,
    systemCoins: 12000,
    purchasedCoins: 0,
    points: 41157,
    cupMedals: "اسطوره - تاج",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 95,
    perfectPredictionCount: 11,
  },
  {
    phone: "9220731845",
    sellableCoins: 1000,
    systemCoins: 13000,
    purchasedCoins: 0,
    points: 36770,
    cupMedals: "تاج",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 72,
    perfectPredictionCount: 7,
  },
  {
    phone: "9964353870",
    sellableCoins: 1000,
    systemCoins: 8000,
    purchasedCoins: 0,
    points: 36560,
    cupMedals: "اسطوره",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 87,
    perfectPredictionCount: 8,
  },
  {
    phone: "9993133545",
    sellableCoins: 1000,
    systemCoins: 20000,
    purchasedCoins: 0,
    points: 48882,
    cupMedals: "اسطوره - تاج",
    tournamentMedals: "پیروز",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 98,
    perfectPredictionCount: 8,
  },
  {
    phone: "9376896003",
    sellableCoins: 1000,
    systemCoins: 24000,
    purchasedCoins: 0,
    points: 60885,
    cupMedals: "اسطوره - تاج",
    tournamentMedals: "پیشرو",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 108,
    perfectPredictionCount: 17,
  },
  {
    phone: "9036118026",
    sellableCoins: 1000,
    systemCoins: 18000,
    purchasedCoins: 0,
    points: 43746,
    cupMedals: "اسطوره",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 99,
    perfectPredictionCount: 11,
  },
  {
    phone: "9182102583",
    sellableCoins: 1000,
    systemCoins: 22000,
    purchasedCoins: 0,
    points: 157078,
    cupMedals: "طوفان- شکار",
    tournamentMedals: "فاتح",
    honorMedals: "ندارد",
    inviteCount: 10,
    predictionCount: 250,
    perfectPredictionCount: 22,
  },
  {
    phone: "9013290280",
    sellableCoins: 1000,
    systemCoins: 8000,
    purchasedCoins: 0,
    points: 45000,
    cupMedals: "تاج",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 1,
    predictionCount: 93,
    perfectPredictionCount: 11,
  },
  {
    phone: "9104668058",
    sellableCoins: 1000,
    systemCoins: 8000,
    purchasedCoins: 0,
    points: 45000,
    cupMedals: "ندارد",
    tournamentMedals: "ندارد",
    honorMedals: "ندارد",
    inviteCount: 0,
    predictionCount: 63,
    perfectPredictionCount: 6,
  },
];

function parseEnvFile(path) {
  const env = {};
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

for (const path of [".env", ".env.production.local"]) {
  for (const [key, value] of Object.entries(parseEnvFile(path))) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function assertProductionOnly() {
  const dbUrl = (process.env.DATABASE_URL ?? "").toLowerCase();
  if (dbUrl.includes("bordindbtest") || dbUrl.includes("xenodochial")) {
    throw new Error("این اسکریپت فقط برای production (bordin.ir) است.");
  }
}

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
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

function isLegacyNoneValue(value) {
  return NONE_VALUES.has(String(value ?? "").trim());
}

function splitLegacyMedalLabels(value) {
  if (isLegacyNoneValue(value)) return [];
  return String(value)
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isLegacyNoneValue(part));
}

function resolveTitleToSlug(label, map) {
  if (map[label]) return map[label];
  const normalized = label.replace(/\s+/g, " ").trim();
  return map[normalized] ?? null;
}

function parseCupMedalSlugs(value) {
  const labels = splitLegacyMedalLabels(value);
  if (labels.length === 0 && !isLegacyNoneValue(value)) {
    const single = resolveTitleToSlug(String(value).trim(), CUP_TITLE_TO_SLUG);
    return single ? [single] : [];
  }
  return [
    ...new Set(
      labels.map((label) => resolveTitleToSlug(label, CUP_TITLE_TO_SLUG)).filter(Boolean),
    ),
  ];
}

function parseTournamentMedalSlugs(value) {
  const labels = splitLegacyMedalLabels(value);
  if (labels.length === 0 && !isLegacyNoneValue(value)) {
    const single = resolveTitleToSlug(String(value).trim(), TOURNAMENT_TITLE_TO_SLUG);
    return single ? [single] : [];
  }
  return [
    ...new Set(
      labels.map((label) => resolveTitleToSlug(label, TOURNAMENT_TITLE_TO_SLUG)).filter(Boolean),
    ),
  ];
}

function resolveMinimumMissionProgress(honorMedals) {
  if (isLegacyNoneValue(honorMedals)) {
    return { totalPredictions: 0, perfectPredictions: 0 };
  }
  const labels = splitLegacyMedalLabels(honorMedals);
  const searchLabels = labels.length > 0 ? labels : [String(honorMedals).trim()];
  let totalPredictions = 0;
  let perfectPredictions = 0;
  for (const label of searchLabels) {
    for (const rule of MISSION_PROGRESS_RULES) {
      if (!label.includes(rule.label)) continue;
      const maxThreshold = rule.thresholds[rule.thresholds.length - 1];
      if (rule.source === "total_predictions") {
        totalPredictions = Math.max(totalPredictions, maxThreshold);
      } else {
        perfectPredictions = Math.max(perfectPredictions, maxThreshold);
      }
    }
  }
  return { totalPredictions, perfectPredictions };
}

function legacyPhoneToLookupPhones(legacyPhone) {
  const trimmed = legacyPhone.trim();
  const phones = new Set([trimmed]);
  if (/^9\d{9}$/.test(trimmed)) phones.add(`0${trimmed}`);
  if (/^09\d{9}$/.test(trimmed)) phones.add(trimmed.slice(1));
  return [...phones];
}

function legacyInviteStubPhone(legacyPhone, index) {
  return `legacy-inv-${legacyPhone}-${index}`;
}

function assertNonNegativeInt(value, field) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`مقدار نامعتبر برای ${field}`);
  }
}

function validateLegacyRow(row) {
  if (!row.phone?.trim()) throw new Error("شماره موبایل خالی است");
  assertNonNegativeInt(row.sellableCoins, "sellableCoins");
  assertNonNegativeInt(row.systemCoins, "systemCoins");
  assertNonNegativeInt(row.purchasedCoins, "purchasedCoins");
  assertNonNegativeInt(row.points, "points");
  assertNonNegativeInt(row.inviteCount, "inviteCount");
  assertNonNegativeInt(row.predictionCount, "predictionCount");
  assertNonNegativeInt(row.perfectPredictionCount, "perfectPredictionCount");
}

async function resolveLevelIdForXp(tx, totalXp) {
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => totalXp >= entry.xpThreshold) ?? levels.at(-1);
  return level?.id ?? null;
}

async function applyWalletFromLegacy(tx, userId, row) {
  const wallet = await tx.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول کاربر یافت نشد");

  const updated = await tx.coinWallet.update({
    where: { userId },
    data: {
      predictionRewardCoins: row.sellableCoins,
      systemRewardCoins: row.systemCoins,
      purchasedCoins: row.purchasedCoins,
    },
  });

  const balance =
    updated.predictionRewardCoins + updated.systemRewardCoins + updated.purchasedCoins;

  const deltas = [
    { coinType: "PREDICTION_REWARD", amount: row.sellableCoins - wallet.predictionRewardCoins, desc: "انتقال سکه قابل فروش از سیستم قدیمی" },
    { coinType: "SYSTEM_REWARD", amount: row.systemCoins - wallet.systemRewardCoins, desc: "انتقال سکه سیستمی از سیستم قدیمی" },
    { coinType: "PURCHASED", amount: row.purchasedCoins - wallet.purchasedCoins, desc: "انتقال سکه خریداری‌شده از سیستم قدیمی" },
  ];

  for (const delta of deltas) {
    if (delta.amount === 0) continue;
    await tx.coinTransaction.create({
      data: {
        walletId: updated.id,
        coinType: delta.coinType,
        amount: delta.amount,
        balanceAfter: balance,
        type: "ADMIN_ADJUSTMENT",
        referenceId: `${LEGACY_IMPORT_REF}:${row.phone}`,
        description: delta.desc,
      },
    });
  }
}

async function applyProfileFromLegacy(tx, userId, row) {
  const honorMinimums = resolveMinimumMissionProgress(row.honorMedals);
  const totalPredictions = Math.max(row.predictionCount, honorMinimums.totalPredictions);
  const perfectPredictions = Math.max(row.perfectPredictionCount, honorMinimums.perfectPredictions);
  const profile = await tx.userProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("پروفایل کاربر یافت نشد");

  const levelId = await resolveLevelIdForXp(tx, row.points);
  const xpDelta = row.points - profile.totalXp;

  await tx.userProfile.update({
    where: { userId },
    data: {
      totalXp: row.points,
      currentLevelId: levelId,
      totalPredictions,
      perfectPredictions,
    },
  });

  if (xpDelta !== 0) {
    await tx.xpTransaction.create({
      data: {
        userId,
        amount: xpDelta,
        type: "ADMIN_ADJUSTMENT",
        referenceId: `${LEGACY_IMPORT_REF}:${row.phone}`,
        description: "انتقال امتیاز از سیستم قدیمی",
      },
    });
  }
}

async function applyMedalSlugs(tx, userId, legacyPhone, slugs) {
  for (const slug of slugs) {
    const medal = await tx.medal.findUnique({ where: { slug } });
    if (!medal) throw new Error(`مدال ${slug} در پایگاه داده یافت نشد`);

    const referenceId = `${LEGACY_MEDAL_REF_PREFIX}:${slug}`;
    const existing = await tx.userMedal.findFirst({
      where: { userId, medalId: medal.id, referenceId },
    });
    if (existing) continue;

    await tx.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
        referenceId,
        earnedReason: `انتقال مدال از سیستم قدیمی (${legacyPhone})`,
      },
    });
  }
}

async function applyInviteCountFromLegacy(tx, inviterId, legacyPhone, targetCount) {
  const existingCount = await tx.inviteLog.count({ where: { inviterId } });
  if (existingCount >= targetCount) return;

  for (let index = existingCount; index < targetCount; index += 1) {
    const stubPhone = legacyInviteStubPhone(legacyPhone, index);
    let stubUser = await tx.user.findUnique({ where: { phone: stubPhone } });
    if (!stubUser) {
      stubUser = await tx.user.create({
        data: {
          phone: stubPhone,
          username: `legacy_inv_${legacyPhone}_${index}`,
          isActive: false,
          profile: { create: { displayName: stubPhone } },
          wallet: { create: {} },
        },
      });
    }

    const existingLog = await tx.inviteLog.findUnique({ where: { inviteeId: stubUser.id } });
    if (existingLog) continue;

    await tx.inviteLog.create({
      data: {
        inviterId,
        inviteeId: stubUser.id,
        coinsAwarded: 0,
        xpAwarded: 0,
      },
    });
  }
}

async function applyLegacyUserRowInTransaction(tx, userId, row) {
  validateLegacyRow(row);
  await applyWalletFromLegacy(tx, userId, row);
  await applyProfileFromLegacy(tx, userId, row);
  const cupSlugs = parseCupMedalSlugs(row.cupMedals);
  const tournamentSlugs = parseTournamentMedalSlugs(row.tournamentMedals);
  await applyMedalSlugs(tx, userId, row.phone, [...cupSlugs, ...tournamentSlugs]);
  await applyInviteCountFromLegacy(tx, userId, row.phone, row.inviteCount);
}

async function findUserByLegacyPhone(tx, legacyPhone) {
  return tx.user.findFirst({
    where: { phone: { in: legacyPhoneToLookupPhones(legacyPhone) } },
    select: { id: true, phone: true },
  });
}

async function assertLegacyImportTableExists(prisma) {
  try {
    await prisma.$queryRaw`SELECT 1 FROM legacy_user_imports LIMIT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("legacy_user_imports") || message.includes("does not exist")) {
      throw new Error(
        "جدول legacy_user_imports وجود ندارد. ابتدا npm run db:push را اجرا کنید.",
      );
    }
    throw error;
  }
}

async function runLegacyUserImport(prisma, rows, importBatchId = `legacy-${Date.now()}`) {
  const report = {
    importBatchId,
    totalRows: rows.length,
    migratedExistingUsers: [],
    pendingUsersCreated: [],
    pendingUsersUpdated: [],
    failedRows: [],
    duplicateRowsSkipped: [],
    alreadyAppliedSkipped: [],
  };

  const seenPhones = new Set();

  for (const rawRow of rows) {
    const row = { ...rawRow, phone: String(rawRow.phone).trim() };

    if (seenPhones.has(row.phone)) {
      report.duplicateRowsSkipped.push(row.phone);
      continue;
    }
    seenPhones.add(row.phone);

    try {
      validateLegacyRow(row);

      const existingImport = await prisma.legacyUserImport.findUnique({
        where: { phone: row.phone },
      });

      if (existingImport?.status === STATUS.APPLIED) {
        report.alreadyAppliedSkipped.push(row.phone);
        continue;
      }

      const user = await findUserByLegacyPhone(prisma, row.phone);

      if (user) {
        await prisma.$transaction(async (tx) => {
          await applyLegacyUserRowInTransaction(tx, user.id, row);
          await tx.legacyUserImport.upsert({
            where: { phone: row.phone },
            create: {
              phone: row.phone,
              status: STATUS.APPLIED,
              payload: row,
              appliedUserId: user.id,
              appliedAt: new Date(),
              importBatchId,
            },
            update: {
              status: STATUS.APPLIED,
              payload: row,
              appliedUserId: user.id,
              appliedAt: new Date(),
              importBatchId,
              errorMessage: null,
            },
          });
        });
        report.migratedExistingUsers.push(row.phone);
        continue;
      }

      if (existingImport) {
        await prisma.legacyUserImport.update({
          where: { phone: row.phone },
          data: {
            status: STATUS.PENDING,
            payload: row,
            importBatchId,
            errorMessage: null,
          },
        });
        report.pendingUsersUpdated.push(row.phone);
      } else {
        await prisma.legacyUserImport.create({
          data: {
            phone: row.phone,
            status: STATUS.PENDING,
            payload: row,
            importBatchId,
          },
        });
        report.pendingUsersCreated.push(row.phone);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "خطای نامشخص";
      report.failedRows.push({ phone: row.phone, error: message });
      try {
        await prisma.legacyUserImport.upsert({
          where: { phone: row.phone },
          create: {
            phone: row.phone,
            status: STATUS.FAILED,
            payload: row,
            importBatchId,
            errorMessage: message,
          },
          update: {
            status: STATUS.FAILED,
            errorMessage: message,
            importBatchId,
          },
        });
      } catch {
        // table may still be missing
      }
    }
  }

  return report;
}

function loadRows() {
  const customPath = process.argv[2];
  if (customPath && existsSync(resolve(process.cwd(), customPath))) {
    return JSON.parse(readFileSync(resolve(process.cwd(), customPath), "utf8"));
  }
  const defaultPath = resolve(process.cwd(), "scripts/data/legacy-users.json");
  if (existsSync(defaultPath)) {
    return JSON.parse(readFileSync(defaultPath, "utf8"));
  }
  return DEFAULT_LEGACY_USERS;
}

async function main() {
  assertProductionOnly();
  const prisma = createPrisma();
  await assertLegacyImportTableExists(prisma);

  const rows = loadRows();
  const report = await runLegacyUserImport(prisma, rows);

  console.log(JSON.stringify(report, null, 2));
  console.log("\n--- Legacy User Import Summary (bordin.ir) ---");
  console.log(`Batch: ${report.importBatchId}`);
  console.log(`Total rows: ${report.totalRows}`);
  console.log(`Migrated existing users: ${report.migratedExistingUsers.length}`);
  console.log(`Pending users created: ${report.pendingUsersCreated.length}`);
  console.log(`Pending users updated: ${report.pendingUsersUpdated.length}`);
  console.log(`Already applied (skipped): ${report.alreadyAppliedSkipped.length}`);
  console.log(`Duplicate rows skipped: ${report.duplicateRowsSkipped.length}`);
  console.log(`Failed rows: ${report.failedRows.length}`);

  if (report.migratedExistingUsers.length > 0) {
    console.log("\nMigrated phones:", report.migratedExistingUsers.join(", "));
  }
  if (report.pendingUsersCreated.length > 0) {
    console.log("\nPending created phones:", report.pendingUsersCreated.join(", "));
  }
  if (report.pendingUsersUpdated.length > 0) {
    console.log("\nPending updated phones:", report.pendingUsersUpdated.join(", "));
  }
  if (report.failedRows.length > 0) {
    console.log("\nFailures:");
    for (const failure of report.failedRows) {
      console.log(`  ${failure.phone}: ${failure.error}`);
    }
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
