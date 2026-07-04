import {
  CoinTransactionType,
  CoinType,
  CompetitionType,
  TeamCompetitionStage,
  TeamCompetitionFeeCoverReason,
  NotificationCategory,
  NotificationType,
  TeamRole,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { leagueNameToCompetitionId } from "@/server/services/admin-football-catalog-service";
import { getUserCoinBalance } from "@/server/services/team-competition-wallet";
import { createNotification } from "@/server/services/notification-service";
import { getPredictionDeadlineInstant, effectivePredictionCutoffMinutes } from "@/shared/lib/dates";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { DisplayNameRequiredError } from "@/server/services/prediction-errors";

async function assertCanPredict(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || userNeedsDisplayName(user.phone, user.profile?.displayName)) {
    throw new DisplayNameRequiredError();
  }
}

export type KnockoutMatchContext = {
  teamCompetitionId: string;
  teamCompetitionTitle: string;
  teamId: string;
  teamName: string;
  ownerId: string;
  predictorUserId: string;
  isPredictor: boolean;
  feePerMember: number;
  memberUserIds: string[];
};

type MemberBalance = {
  userId: string;
  name: string;
  balance: number;
  isOwner: boolean;
};

function isKickoffInWindow(kickoffAt: Date, startsAt: Date, endsAt: Date) {
  const ms = kickoffAt.getTime();
  return ms >= startsAt.getTime() && ms <= endsAt.getTime();
}

function displayName(user: {
  username: string | null;
  profile: { displayName: string | null } | null;
}) {
  return user.profile?.displayName ?? user.username ?? "کاربر";
}

async function findKnockoutMatchContext(
  userId: string,
  matchId: string,
  kandakatorId: string,
): Promise<KnockoutMatchContext | null> {
  if (await shouldUseMemoryDb()) return null;

  const kandakatorMatch = await prisma.kandakatorMatch.findFirst({
    where: { kandakatorId, matchId },
    include: { match: true },
  });
  if (!kandakatorMatch) return null;

  const match = kandakatorMatch.match;
  const footballCompetitionId = leagueNameToCompetitionId(match.leagueName ?? "سایر");

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: true,
          competitionEntries: {
            include: {
              teamCompetition: {
                include: {
                  knockoutRounds: {
                    orderBy: { sortOrder: "asc" },
                    include: { footballCompetitions: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  for (const membership of memberships) {
    for (const entry of membership.team.competitionEntries) {
      const comp = entry.teamCompetition;
      if (comp.stage !== TeamCompetitionStage.KNOCKOUT || entry.isEliminated) continue;

      let inKnockoutWindow = false;
      let feePerMember = comp.rankingPredictionFeePerMember;

      if (comp.usesRuleBasedStages) {
        for (const round of comp.knockoutRounds) {
          if (!round.startsAt || !round.endsAt) continue;
          const roundLeagues = new Set(round.footballCompetitions.map((r) => r.footballCompetitionId));
          if (
            isKickoffInWindow(match.kickoffAt, round.startsAt, round.endsAt) &&
            roundLeagues.has(footballCompetitionId)
          ) {
            inKnockoutWindow = true;
            feePerMember = round.predictionFeePerMember;
            break;
          }
        }
      } else {
        const legacy = await prisma.teamCompetitionStageMatch.findFirst({
          where: { teamCompetitionId: comp.id, matchId, stage: "KNOCKOUT" },
        });
        if (legacy) {
          inKnockoutWindow = true;
          feePerMember = comp.knockoutRounds[0]?.predictionFeePerMember ?? feePerMember;
        }
      }

      if (!inKnockoutWindow) continue;

      const captain = membership.team.members.find((m) => m.role === TeamRole.CAPTAIN);
      const owner = membership.team.members.find((m) => m.role === TeamRole.OWNER);
      const predictor = captain ?? owner;
      if (!predictor) continue;

      return {
        teamCompetitionId: comp.id,
        teamCompetitionTitle: comp.titleFa,
        teamId: membership.team.id,
        teamName: membership.team.name,
        ownerId: membership.team.ownerId,
        predictorUserId: predictor.userId,
        isPredictor: predictor.userId === userId,
        feePerMember,
        memberUserIds: membership.team.members.map((m) => m.userId),
      };
    }
  }

  return null;
}

export async function getKnockoutPredictionUiState(
  userId: string,
  matchId: string,
  kandakatorId: string,
) {
  const ctx = await findKnockoutMatchContext(userId, matchId, kandakatorId);
  if (!ctx) return null;

  const teamHasPrediction = await prisma.prediction.findFirst({
    where: {
      matchId,
      competitionType: CompetitionType.DAILY,
      userId: { in: ctx.memberUserIds },
    },
    select: { homePrediction: true, awayPrediction: true },
  });

  if (teamHasPrediction && !ctx.isPredictor) {
    return {
      role: "member" as const,
      message: "پیش‌بینی ثبت شده توسط کاپیتان",
      canSubmit: false,
    };
  }

  if (ctx.isPredictor && !teamHasPrediction) {
    return {
      role: "captain" as const,
      message: "تیم شما منتظر ثبت پیش‌بینی شما است",
      canSubmit: true,
    };
  }

  if (!ctx.isPredictor && !teamHasPrediction) {
    return {
      role: "member" as const,
      message: "منتظر ثبت پیش‌بینی توسط کاپیتان",
      canSubmit: false,
    };
  }

  return { role: ctx.isPredictor ? ("captain" as const) : ("member" as const), message: null, canSubmit: false };
}

async function loadMemberBalances(teamId: string): Promise<MemberBalance[]> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    include: { user: { include: { profile: true } }, team: { select: { ownerId: true } } },
  });

  const balances: MemberBalance[] = [];
  for (const member of members) {
    balances.push({
      userId: member.userId,
      name: displayName(member.user),
      balance: await getUserCoinBalance(member.userId),
      isOwner: member.team.ownerId === member.userId,
    });
  }
  return balances;
}

function computeCoverPlan(fee: number, members: MemberBalance[]) {
  const shortfallMembers = members.filter((m) => m.balance < fee);
  const solventMembers = members.filter((m) => m.balance >= fee);

  if (shortfallMembers.length === 0) {
    const deductions = new Map(members.map((m) => [m.userId, fee]));
    return {
      needsCover: false,
      shortfallMembers,
      canCover: true,
      deductions,
      coverRecords: [] as CoverRecord[],
    };
  }

  const totalToCover = shortfallMembers.length * fee;
  const availableExtra = solventMembers.reduce((sum, m) => sum + (m.balance - fee), 0);
  const deductions = new Map<string, number>();
  for (const m of members) {
    deductions.set(m.userId, m.balance >= fee ? fee : 0);
  }

  if (solventMembers.length === 0 || availableExtra < totalToCover) {
    return { needsCover: true, shortfallMembers, canCover: false, deductions, coverRecords: [] };
  }

  const extraPerPayer = totalToCover / solventMembers.length;
  const coverRecords: CoverRecord[] = [];
  let remaining = totalToCover;

  for (const payer of solventMembers) {
    const maxExtra = payer.balance - fee;
    const extra = Math.min(extraPerPayer, maxExtra, remaining);
    if (extra <= 0) continue;
    deductions.set(payer.userId, fee + extra);
    remaining -= extra;
    const perShort = extra / shortfallMembers.length;
    for (const short of shortfallMembers) {
      coverRecords.push({
        coveredUserId: short.userId,
        coveredByUserId: payer.userId,
        amount: Math.round(perShort),
      });
    }
  }

  if (remaining > 0) {
    for (const payer of solventMembers) {
      if (remaining <= 0) break;
      const already = deductions.get(payer.userId) ?? fee;
      const maxMore = payer.balance - already;
      const take = Math.min(remaining, maxMore);
      if (take <= 0) continue;
      deductions.set(payer.userId, already + take);
      remaining -= take;
      for (const short of shortfallMembers) {
        coverRecords.push({
          coveredUserId: short.userId,
          coveredByUserId: payer.userId,
          amount: take,
        });
      }
    }
  }

  return {
    needsCover: true,
    shortfallMembers,
    canCover: remaining <= 0,
    deductions,
    coverRecords,
  };
}

type CoverRecord = { coveredUserId: string; coveredByUserId: string; amount: number };

export async function previewKnockoutTeamPrediction(userId: string, matchId: string, kandakatorId: string) {
  const ctx = await findKnockoutMatchContext(userId, matchId, kandakatorId);
  if (!ctx) throw new Error("این مسابقه در مرحله حذفی رقابت تیمی شما نیست");
  if (!ctx.isPredictor) throw new Error("فقط کاپیتان می‌تواند پیش‌بینی تیمی ثبت کند");

  const predictorBalance = await getUserCoinBalance(ctx.predictorUserId);
  if (predictorBalance < ctx.feePerMember) {
    return {
      captainInsufficient: true,
      needsCover: false,
      canCover: false,
      shortfallMembers: [] as Array<{ userId: string; name: string }>,
      feePerMember: ctx.feePerMember,
    };
  }

  const members = await loadMemberBalances(ctx.teamId);
  const plan = computeCoverPlan(ctx.feePerMember, members);

  return {
    captainInsufficient: false,
    needsCover: plan.needsCover,
    canCover: plan.canCover,
    shortfallMembers: plan.shortfallMembers.map((m) => ({ userId: m.userId, name: m.name })),
    feePerMember: ctx.feePerMember,
  };
}

async function createDailyPredictionTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  matchId: string,
  kandakatorId: string,
  homePrediction: number,
  awayPrediction: number,
  deductAmount: number,
  recordedFee?: number,
) {
  const wallet = await tx.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const entryFeeCoins = recordedFee ?? deductAmount;

  let newBalance =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;

  if (deductAmount > 0) {
    let remaining = deductAmount;
    let predDeduct = 0;
    let sysDeduct = 0;
    let purchDeduct = 0;

    const spendFrom = (available: number, type: "pred" | "sys" | "purch") => {
      const take = Math.min(available, remaining);
      remaining -= take;
      if (type === "pred") predDeduct += take;
      if (type === "sys") sysDeduct += take;
      if (type === "purch") purchDeduct += take;
    };

    spendFrom(wallet.purchasedCoins, "purch");
    spendFrom(wallet.systemRewardCoins, "sys");
    spendFrom(wallet.predictionRewardCoins, "pred");
    if (remaining > 0) throw new Error("موجودی سکه کافی نیست");

    const updatedWallet = await tx.coinWallet.update({
      where: { userId },
      data: {
        purchasedCoins: wallet.purchasedCoins - purchDeduct,
        systemRewardCoins: wallet.systemRewardCoins - sysDeduct,
        predictionRewardCoins: wallet.predictionRewardCoins - predDeduct,
      },
    });

    newBalance =
      updatedWallet.predictionRewardCoins +
      updatedWallet.systemRewardCoins +
      updatedWallet.purchasedCoins;

    await tx.coinTransaction.create({
      data: {
        walletId: updatedWallet.id,
        coinType: CoinType.PURCHASED,
        amount: -deductAmount,
        balanceAfter: newBalance,
        type: CoinTransactionType.PREDICTION_ENTRY,
        referenceId: matchId,
        description: "ورودی پیش‌بینی مرحله حذفی رقابت تیمی",
      },
    });
  }

  await tx.prediction.create({
    data: {
      userId,
      matchId,
      competitionType: CompetitionType.DAILY,
      competitionRefId: kandakatorId,
      homePrediction,
      awayPrediction,
      entryFeeCoins,
    },
  });

  await tx.userProfile.update({ where: { userId }, data: { totalPredictions: { increment: 1 } } });
}

export async function submitKnockoutTeamPrediction(
  userId: string,
  matchId: string,
  kandakatorId: string,
  homePrediction: number,
  awayPrediction: number,
  options: { confirmCover?: boolean; cancelCover?: boolean } = {},
) {
  await assertCanPredict(userId);

  const ctx = await findKnockoutMatchContext(userId, matchId, kandakatorId);
  if (!ctx) throw new Error("این مسابقه در مرحله حذفی رقابت تیمی شما نیست");
  if (!ctx.isPredictor) throw new Error("فقط کاپیتان می‌تواند پیش‌بینی تیمی ثبت کند");

  const kandakatorMatch = await prisma.kandakatorMatch.findFirst({
    where: { kandakatorId, matchId },
    include: { match: true },
  });
  if (!kandakatorMatch) throw new Error("مسابقه در کنداکتور یافت نشد");

  const cutoffMs = getPredictionDeadlineInstant(
    kandakatorMatch.match.kickoffAt,
    effectivePredictionCutoffMinutes(kandakatorMatch.predictionCutoffMinutes),
  );
  if (Date.now() >= cutoffMs) throw new Error("مهلت پیش‌بینی به پایان رسیده است");

  const existing = await prisma.prediction.findFirst({
    where: { matchId, competitionType: CompetitionType.DAILY, userId: { in: ctx.memberUserIds } },
  });
  if (existing) throw new Error("پیش‌بینی تیمی برای این مسابقه ثبت شده است");

  const preview = await previewKnockoutTeamPrediction(userId, matchId, kandakatorId);
  if (preview.captainInsufficient) {
    if (ctx.ownerId !== userId) {
      await createNotification({
        userId: ctx.ownerId,
        type: NotificationType.COMPETITION,
        category: NotificationCategory.MESSAGE,
        titleFa: "پیش‌بینی تیمی ثبت نشد",
        bodyFa: `کاپیتان تیم شما(${ctx.teamName}) ‌قصد ثبت پیش‌بینی تیمی رو داشت. اما چون سکه کافی نداشت، پیش‌بینی تیمی شما هنوز ثبت نشده! پیشنهاد میکنیم هرچه سریع تر به این موضوع رسیدگی کنی. چون ممکنه تیمت از رقابت حذف بشه!`,
      });
    }
    throw new Error(
      "سکه کافی ندارید. در صورت عدم ثبت پیش‌بینی، ممکنه تیم شما از رقابت حذف بشه! یا توسط مالک تیم اخراج بشید",
    );
  }

  const members = await loadMemberBalances(ctx.teamId);
  const plan = computeCoverPlan(ctx.feePerMember, members);

  if (plan.needsCover && options.cancelCover) {
    await sendCoverDeclinedNotifications(ctx, plan.shortfallMembers, members);
    throw new Error("پیش‌بینی برای شما و تیمان ثبت نشد");
  }

  if (plan.needsCover && !options.confirmCover) {
    return {
      submitted: false,
      needsCoverConfirmation: true,
      shortfallMembers: plan.shortfallMembers.map((m) => ({ userId: m.userId, name: m.name })),
    };
  }

  if (plan.needsCover && !plan.canCover) {
    throw new Error("هم تیمی شما برای پوشش هزینه، سکه کافی در اختیار نداره");
  }

  await prisma.$transaction(async (tx) => {
    for (const member of members) {
      const amount = plan.deductions.get(member.userId) ?? ctx.feePerMember;
      const wallet = await tx.coinWallet.findUnique({ where: { userId: member.userId } });
      if (
        !wallet ||
        wallet.purchasedCoins + wallet.systemRewardCoins + wallet.predictionRewardCoins < amount
      ) {
        throw new Error("موجودی سکه کافی نیست");
      }
    }

    for (const member of members) {
      const amount = plan.deductions.get(member.userId) ?? ctx.feePerMember;
      await createDailyPredictionTx(
        tx,
        member.userId,
        matchId,
        kandakatorId,
        homePrediction,
        awayPrediction,
        amount,
        ctx.feePerMember,
      );
    }

    if (plan.coverRecords.length > 0) {
      await tx.teamCompetitionFeeCover.createMany({
        data: plan.coverRecords.map((r) => ({
          teamCompetitionId: ctx.teamCompetitionId,
          teamId: ctx.teamId,
          coveredUserId: r.coveredUserId,
          coveredByUserId: r.coveredByUserId,
          amount: r.amount,
          reason: TeamCompetitionFeeCoverReason.PREDICTION,
        })),
      });
    }
  });

  if (plan.needsCover && options.confirmCover) {
    await sendCoverAcceptedNotifications(ctx, plan, members);
  }

  return { submitted: true, needsCoverConfirmation: false };
}

async function sendCoverDeclinedNotifications(
  ctx: KnockoutMatchContext,
  shortfallMembers: MemberBalance[],
  allMembers: MemberBalance[],
) {
  const shortNames = shortfallMembers.map((m) => m.name).join("، ");

  for (const short of shortfallMembers) {
    if (short.isOwner) continue;
    await createNotification({
      userId: short.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: "پیش‌بینی تیمی ثبت نشد",
      bodyFa: `کاپیتان تیم شما(${ctx.teamName}) قصد ثبت پیش‌بینی تیمی رو داشت اما چون شما سکه کافی ندارید، نتونست پیش‌‌بینی رو ثبت کنه! کاپیتان قبول نکرد که کمبود موجودی شما از حساب باقی اعضا کسر بشه! سریع تر سکه تهیه کن چون ممکنه یا توسط مالک از تیم اخراج بشی یا تیمت از رقابت حذف بشه!`,
    });
  }

  const ownerShort = shortfallMembers.find((m) => m.isOwner);
  if (ownerShort) {
    await createNotification({
      userId: ownerShort.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: "پیش‌بینی تیمی ثبت نشد",
      bodyFa: `کاپیتان تیم شما(${ctx.teamName}) قصد ثبت پیش‌بینی تیمی رو داشت اما چون شما سکه کافی ندارید، نتونست پیش‌‌بینی رو ثبت کنه! کاپیتان قبول نکرد که کمبود موجودی شما از حساب باقی اعضا کسر بشه! بهتره هرچه سریع تر سکه تهیه کنی چون ممکنه یا تیمت از رقابت حذف بشه یا اعتماد اعضای تیمت به شما کم بشه و استعفا بدن!`,
    });
  }

  for (const member of allMembers) {
    if (member.userId === ctx.predictorUserId || member.isOwner) continue;
    if (shortfallMembers.some((s) => s.userId === member.userId)) continue;
    await createNotification({
      userId: member.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: "پیش‌بینی تیمی ثبت نشد",
      bodyFa: `کاپیتان تیم شما(${ctx.teamName}) قصد ثبت پیش‌بینی تیمی رو داشت اما چون برخی از اعضای تیم (${shortNames}) سکه کافی نداشتند، نتونست پیش‌‌بینی رو ثبت کنه! کاپیتان قبول نکرد که کمبود موجودی از حساب باقی اعضا کسر بشه! اگر پیش‌بینی تیمی ثبت نشه، ممکنه تیم شما از رقابت حذف بشه!`,
    });
  }

  const ownerSolvent = allMembers.find(
    (m) => m.isOwner && !shortfallMembers.some((s) => s.userId === m.userId),
  );
  if (ownerSolvent) {
    await createNotification({
      userId: ownerSolvent.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: "پیش‌بینی تیمی ثبت نشد",
      bodyFa: `کاپیتان تیم شما(${ctx.teamName}) قصد ثبت پیش‌بینی تیمی رو داشت اما چون برخی از اعضای تیم (${shortNames}) سکه کافی نداشتند، نتونست پیش‌‌بینی رو ثبت کنه! کاپیتان قبول نکرد که کمبود موجودی از حساب باقی اعضا کسر بشه! پیشنهاد میکنیم سریع به این موضوع رسیدگی کنی. چون اگر پیش‌بینی ثبت نشه، تیمت از رقابت تیمی حذف میشه!`,
    });
  }
}

async function sendCoverAcceptedNotifications(
  ctx: KnockoutMatchContext,
  plan: ReturnType<typeof computeCoverPlan>,
  allMembers: MemberBalance[],
) {
  const shortfallIds = new Set(plan.shortfallMembers.map((m) => m.userId));
  const shortNames = plan.shortfallMembers.map((m) => m.name).join("، ");

  for (const payer of allMembers) {
    if (shortfallIds.has(payer.userId)) continue;
    const paidForOthers = plan.coverRecords
      .filter((r) => r.coveredByUserId === payer.userId)
      .reduce((s, r) => s + r.amount, 0);
    if (paidForOthers <= 0) continue;
    await createNotification({
      userId: payer.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: "پوشش هزینه پیش‌بینی",
      bodyFa: `در زمان ثبت پیش‌بینی تیمی توسط کاپیتان برای تیم(${ctx.teamName})، تعداد ${paidForOthers} از حساب شما به دلیل کافی نبود موجود اعضای تیم شما (${shortNames}) کسر شده. کاپیتان در زمان ثبت پیش‌بینی این تصمیم رو گرفت که تیم از رقابت جا نمونه. در صورتی که شما ۴ مرتبه هزینه این اعضا رو در رقابت تیمی فعال متقبل بشید، اگر تیم شما قهرمان یا نایب قهرمان رقابت تیمی بشه، جایزه ای به این اعضا داده نمیشه`,
    });
  }

  for (const short of plan.shortfallMembers) {
    await createNotification({
      userId: short.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: "پوشش هزینه پیش‌بینی",
      bodyFa: `کاپیتان تیم شما (${ctx.teamName}) در زمان ثبت پیش‌بینی تیمی متوجه شد که موجودی سکه شما برای پرداخت هزینه کافی نیست! اما باقی اعضای تیم با سخاوت تمام هزینه شما رو متقبل شدند و پیش‌بینی ثبت شد. اما توجه کن که سخاوت ممکنه ادامه نداشته باشه! شاید توسط مالک تیم اخراج بشی چون الان هزینه اضافی رو دوش تیم گذاشتی. همچنین اگر برای ۴ مسابقه هزینه‌ات رو هم تیمی‌ها متقبل بشن، در صورتی که تیمت قهرمان یا نایب قهرمان رقابت تیمی بشه، به شما جایزه‌ای تعلق نمیگیره!`,
    });
  }
}

export async function blockNonCaptainKnockoutDailySubmit(
  userId: string,
  matchId: string,
  kandakatorId: string,
) {
  const ctx = await findKnockoutMatchContext(userId, matchId, kandakatorId);
  if (!ctx) return null;
  if (!ctx.isPredictor) {
    throw new Error("در مرحله حذفی فقط کاپیتان می‌تواند پیش‌بینی ثبت کند");
  }
  return ctx;
}
