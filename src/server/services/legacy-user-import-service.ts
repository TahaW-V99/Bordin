import {
  CoinTransactionType,
  CoinType,
  LegacyUserImportStatus,
  Prisma,
  XpTransactionType,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  legacyInviteStubPhone,
  legacyPhoneToLookupPhones,
  parseCupMedalSlugs,
  parseTournamentMedalSlugs,
  resolveMinimumMissionProgress,
} from "@/shared/lib/legacy-user-import-parsers";
import type { LegacyUserImportReport, LegacyUserRow } from "@/shared/types/legacy-user-import";

const LEGACY_IMPORT_REF = "legacy-user-import";
const LEGACY_MEDAL_REF_PREFIX = "legacy-import";

type Tx = Prisma.TransactionClient;

function assertNonNegativeInt(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new Error(`مقدار نامعتبر برای ${field}`);
  }
}

function validateLegacyRow(row: LegacyUserRow) {
  if (!row.phone?.trim()) throw new Error("شماره موبایل خالی است");
  assertNonNegativeInt(row.sellableCoins, "sellableCoins");
  assertNonNegativeInt(row.systemCoins, "systemCoins");
  assertNonNegativeInt(row.purchasedCoins, "purchasedCoins");
  assertNonNegativeInt(row.points, "points");
  assertNonNegativeInt(row.inviteCount, "inviteCount");
  assertNonNegativeInt(row.predictionCount, "predictionCount");
  assertNonNegativeInt(row.perfectPredictionCount, "perfectPredictionCount");
}

async function resolveLevelIdForXp(tx: Tx, totalXp: number) {
  const levels = await tx.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((entry) => totalXp >= entry.xpThreshold) ?? levels.at(-1);
  return level?.id ?? null;
}

async function applyWalletFromLegacy(tx: Tx, userId: string, row: LegacyUserRow) {
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

  const adjustments: Array<{
    coinType: CoinType;
    amount: number;
    description: string;
  }> = [];

  const predDelta = row.sellableCoins - wallet.predictionRewardCoins;
  const sysDelta = row.systemCoins - wallet.systemRewardCoins;
  const purchDelta = row.purchasedCoins - wallet.purchasedCoins;

  if (predDelta !== 0) {
    adjustments.push({
      coinType: CoinType.PREDICTION_REWARD,
      amount: predDelta,
      description: "انتقال سکه قابل فروش از سیستم قدیمی",
    });
  }
  if (sysDelta !== 0) {
    adjustments.push({
      coinType: CoinType.SYSTEM_REWARD,
      amount: sysDelta,
      description: "انتقال سکه سیستمی از سیستم قدیمی",
    });
  }
  if (purchDelta !== 0) {
    adjustments.push({
      coinType: CoinType.PURCHASED,
      amount: purchDelta,
      description: "انتقال سکه خریداری‌شده از سیستم قدیمی",
    });
  }

  for (const adjustment of adjustments) {
    await tx.coinTransaction.create({
      data: {
        walletId: updated.id,
        coinType: adjustment.coinType,
        amount: adjustment.amount,
        balanceAfter: balance,
        type: CoinTransactionType.ADMIN_ADJUSTMENT,
        referenceId: `${LEGACY_IMPORT_REF}:${row.phone}`,
        description: adjustment.description,
      },
    });
  }
}

async function applyProfileFromLegacy(tx: Tx, userId: string, row: LegacyUserRow) {
  const honorMinimums = resolveMinimumMissionProgress(row.honorMedals);
  const totalPredictions = Math.max(row.predictionCount, honorMinimums.totalPredictions);
  const perfectPredictions = Math.max(
    row.perfectPredictionCount,
    honorMinimums.perfectPredictions,
  );

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
        type: XpTransactionType.ADMIN_ADJUSTMENT,
        referenceId: `${LEGACY_IMPORT_REF}:${row.phone}`,
        description: "انتقال امتیاز از سیستم قدیمی",
      },
    });
  }
}

async function applyMedalSlugs(
  tx: Tx,
  userId: string,
  legacyPhone: string,
  slugs: string[],
) {
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

async function applyInviteCountFromLegacy(
  tx: Tx,
  inviterId: string,
  legacyPhone: string,
  targetCount: number,
) {
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
          profile: {
            create: {
              displayName: stubPhone,
            },
          },
          wallet: {
            create: {},
          },
        },
      });
    }

    const existingLog = await tx.inviteLog.findUnique({
      where: { inviteeId: stubUser.id },
    });
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

export async function applyLegacyUserRowInTransaction(
  tx: Tx,
  userId: string,
  row: LegacyUserRow,
) {
  validateLegacyRow(row);

  await applyWalletFromLegacy(tx, userId, row);
  await applyProfileFromLegacy(tx, userId, row);

  const cupSlugs = parseCupMedalSlugs(row.cupMedals);
  const tournamentSlugs = parseTournamentMedalSlugs(row.tournamentMedals);
  await applyMedalSlugs(tx, userId, row.phone, [...cupSlugs, ...tournamentSlugs]);
  await applyInviteCountFromLegacy(tx, userId, row.phone, row.inviteCount);
}

async function findUserByLegacyPhone(tx: Tx, legacyPhone: string) {
  const phones = legacyPhoneToLookupPhones(legacyPhone);
  return tx.user.findFirst({
    where: { phone: { in: phones } },
    select: { id: true, phone: true },
  });
}

export async function applyLegacyUserRowToExistingUser(userId: string, row: LegacyUserRow) {
  await prisma.$transaction(async (tx) => {
    await applyLegacyUserRowInTransaction(tx, userId, row);
  });

  const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
  await refreshUserGlobalRank(userId);
}

export async function applyPendingLegacyImportForPhone(userId: string, appPhone: string) {
  if (await shouldUseMemoryDb()) return { applied: false as const };

  const legacyPhone = appPhone.trim().startsWith("09")
    ? appPhone.trim().slice(1)
    : appPhone.trim();

  const pending = await prisma.legacyUserImport.findFirst({
    where: { phone: legacyPhone, status: LegacyUserImportStatus.PENDING },
  });
  if (!pending) return { applied: false as const };

  const row = pending.payload as LegacyUserRow;

  try {
    await prisma.$transaction(async (tx) => {
      const locked = await tx.legacyUserImport.findFirst({
        where: { id: pending.id, status: LegacyUserImportStatus.PENDING },
      });
      if (!locked) return;

      await applyLegacyUserRowInTransaction(tx, userId, row);
      await tx.legacyUserImport.update({
        where: { id: pending.id },
        data: {
          status: LegacyUserImportStatus.APPLIED,
          appliedUserId: userId,
          appliedAt: new Date(),
          errorMessage: null,
        },
      });
    });

    const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
    await refreshUserGlobalRank(userId);

    return { applied: true as const, phone: legacyPhone };
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطای نامشخص";
    await prisma.legacyUserImport.update({
      where: { id: pending.id },
      data: {
        status: LegacyUserImportStatus.FAILED,
        errorMessage: message,
      },
    });
    throw error;
  }
}

export async function runLegacyUserImport(
  rows: LegacyUserRow[],
  importBatchId = `legacy-${Date.now()}`,
): Promise<LegacyUserImportReport> {
  const report: LegacyUserImportReport = {
    importBatchId,
    totalRows: rows.length,
    migratedExistingUsers: [],
    pendingUsersCreated: [],
    pendingUsersUpdated: [],
    failedRows: [],
    duplicateRowsSkipped: [],
    alreadyAppliedSkipped: [],
  };

  const seenPhones = new Set<string>();

  for (const rawRow of rows) {
    const row: LegacyUserRow = {
      ...rawRow,
      phone: rawRow.phone.trim(),
    };

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

      if (existingImport?.status === LegacyUserImportStatus.APPLIED) {
        report.alreadyAppliedSkipped.push(row.phone);
        continue;
      }

      const user = await findUserByLegacyPhone(prisma, row.phone);

      if (user) {
        await prisma.$transaction(async (tx) => {
          if (existingImport?.status === LegacyUserImportStatus.APPLIED) return;

          await applyLegacyUserRowInTransaction(tx, user.id, row);
          await tx.legacyUserImport.upsert({
            where: { phone: row.phone },
            create: {
              phone: row.phone,
              status: LegacyUserImportStatus.APPLIED,
              payload: row as unknown as Prisma.InputJsonValue,
              appliedUserId: user.id,
              appliedAt: new Date(),
              importBatchId,
            },
            update: {
              status: LegacyUserImportStatus.APPLIED,
              payload: row as unknown as Prisma.InputJsonValue,
              appliedUserId: user.id,
              appliedAt: new Date(),
              importBatchId,
              errorMessage: null,
            },
          });
        });

        const { refreshUserGlobalRank } = await import(
          "@/server/services/leaderboard-rank-service"
        );
        await refreshUserGlobalRank(user.id);
        report.migratedExistingUsers.push(row.phone);
        continue;
      }

      if (existingImport) {
        await prisma.legacyUserImport.update({
          where: { phone: row.phone },
          data: {
            status: LegacyUserImportStatus.PENDING,
            payload: row as unknown as Prisma.InputJsonValue,
            importBatchId,
            errorMessage: null,
          },
        });
        report.pendingUsersUpdated.push(row.phone);
      } else {
        await prisma.legacyUserImport.create({
          data: {
            phone: row.phone,
            status: LegacyUserImportStatus.PENDING,
            payload: row as unknown as Prisma.InputJsonValue,
            importBatchId,
          },
        });
        report.pendingUsersCreated.push(row.phone);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "خطای نامشخص";
      report.failedRows.push({ phone: row.phone, error: message });

      await prisma.legacyUserImport.upsert({
        where: { phone: row.phone },
        create: {
          phone: row.phone,
          status: LegacyUserImportStatus.FAILED,
          payload: row as unknown as Prisma.InputJsonValue,
          importBatchId,
          errorMessage: message,
        },
        update: {
          status: LegacyUserImportStatus.FAILED,
          errorMessage: message,
          importBatchId,
        },
      });
    }
  }

  return report;
}
