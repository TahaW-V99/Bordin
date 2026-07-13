import {
  NotificationCategory,
  NotificationType,
  TeamCompetitionFeeCoverReason,
  TeamCompetitionStage,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { createNotification } from "@/server/services/notification-service";
import {
  getUserCoinBalance,
  tryDeductTeamCompetitionEntryFee,
} from "@/server/services/team-competition-wallet";
import {
  TEAM_COMP_NOTIFICATION_COPY,
  teamCompetitionKnockoutTabLink,
  teamCompetitionRankingTabLink,
} from "@/shared/constants/team-competition-user";
import {
  assertTeamCompetitionRegistrationAllowed,
  findTeamsWithMemberCompetitionConflict,
  getOwnerRegistrationBlock,
  OWNER_ALREADY_IN_THIS_COMP_FA,
  ownerAlreadyInOtherCompFa,
  TEAM_MEMBER_ALREADY_IN_COMP_FA,
} from "@/server/services/team-competition-registration-rules";
import { KNOCKOUT_ROUND_LABELS_FA } from "@/shared/constants/team-competitions";
import { resolveTeamLogoUrl } from "@/shared/constants/teams";
import { resolveTeamCompetitionBannerUrl } from "@/shared/lib/team-competition-banner";
import { aggregateRankingScoresForCompetition } from "@/server/services/team-competition-aggregation";

export type TeamCompetitionUserFilter = "upcoming" | "active" | "finished";

function displayName(user: {
  username: string | null;
  profile: { displayName: string | null } | null;
}) {
  return user.profile?.displayName ?? user.username ?? "کاربر";
}

function resolveCurrentStageEndsAt(comp: {
  stage: TeamCompetitionStage;
  rankingEndsAt: Date;
  knockoutRounds: Array<{ startsAt: Date | null; endsAt: Date | null }>;
}) {
  if (comp.stage === TeamCompetitionStage.RANKING) {
    return comp.rankingEndsAt;
  }

  if (comp.stage !== TeamCompetitionStage.KNOCKOUT) {
    return null;
  }

  const now = new Date();
  const rounds = comp.knockoutRounds;
  if (!rounds.length) return null;

  const activeRound =
    rounds.find((round) => {
      if (round.startsAt && now < round.startsAt) return false;
      if (round.endsAt && now <= round.endsAt) return true;
      return false;
    }) ??
    rounds.find((round) => round.endsAt && now <= round.endsAt) ??
    rounds[rounds.length - 1];

  return activeRound?.endsAt ?? null;
}

async function serializeCompetitionListItem(
  comp: Awaited<ReturnType<typeof prisma.teamCompetition.findFirst>> & {
    _count: { entries: number };
    medalRewards: Array<{ placement: string; medal: { titleFa: string; slug: string } }>;
  },
  userId: string,
  joined: boolean,
) {
  if (!comp) return null;
  const entryCount = comp._count.entries;
  return {
    id: comp.id,
    titleFa: comp.titleFa,
    description: comp.description,
    bannerUrl: resolveTeamCompetitionBannerUrl(comp.bannerUrl),
    teamCapacity: comp.teamCapacity,
    registrationDeadline: comp.registrationDeadline.toISOString(),
    registrationFeePerMember: comp.registrationFeePerMember,
    winnerCoinReward: comp.winnerCoinReward,
    runnerUpCoinReward: comp.runnerUpCoinReward,
    stage: comp.stage,
    rankingEndsAt: comp.rankingEndsAt.toISOString(),
    knockoutEndsAt: comp.knockoutEndsAt?.toISOString() ?? null,
    createdAt: comp.createdAt.toISOString(),
    entryCount,
    joined,
    status:
      comp.stage === "FINISHED"
        ? "finished"
        : comp.stage === "REGISTRATION"
          ? "upcoming"
          : "active",
    medals: comp.medalRewards.map((m) => ({
      placement: m.placement,
      titleFa: m.medal.titleFa,
      slug: m.medal.slug,
    })),
  };
}

export async function listTeamCompetitionsForUser(userId: string, filter: TeamCompetitionUserFilter) {
  if (await shouldUseMemoryDb()) {
    const { listTeamCompetitions } = await import("@/server/services/competition-service");
    const mapped =
      filter === "active"
        ? "active"
        : filter === "upcoming"
          ? "upcoming"
          : "finished";
    const items = await listTeamCompetitions(userId, mapped);
    return items.map((raw) => {
      const c = raw as Record<string, unknown>;
      return {
        id: String(c.id),
        titleFa: String(c.titleFa ?? ""),
        description: (c.description as string | null | undefined) ?? null,
        bannerUrl: resolveTeamCompetitionBannerUrl(c.bannerUrl as string | null | undefined),
        teamCapacity: Number(c.teamCapacity ?? 16),
        registrationDeadline: new Date(c.registrationDeadline as string | Date).toISOString(),
        registrationFeePerMember: Number(c.registrationFeePerMember ?? 0),
        winnerCoinReward: Number(c.winnerCoinReward ?? 0),
        runnerUpCoinReward: Number(c.runnerUpCoinReward ?? 0),
        stage: String(c.stage ?? "REGISTRATION"),
        rankingEndsAt: c.rankingEndsAt
          ? new Date(c.rankingEndsAt as string | Date).toISOString()
          : null,
        knockoutEndsAt: c.knockoutEndsAt
          ? new Date(c.knockoutEndsAt as string | Date).toISOString()
          : null,
        createdAt: c.createdAt
          ? new Date(c.createdAt as string | Date).toISOString()
          : new Date().toISOString(),
        entryCount: Number(c.entryCount ?? 0),
        joined: Boolean(c.joined),
        status: String(c.status ?? "upcoming"),
        medals: Array.isArray(c.medals) ? c.medals : [],
      };
    });
  }

  const userTeamIds = (
    await prisma.teamMember.findMany({ where: { userId }, select: { teamId: true } })
  ).map((m) => m.teamId);

  const joinedCompIds = new Set(
    (
      await prisma.teamCompetitionEntry.findMany({
        where: { teamId: { in: userTeamIds } },
        select: { teamCompetitionId: true },
      })
    ).map((e) => e.teamCompetitionId),
  );

  const stageFilter =
    filter === "upcoming"
      ? { stage: "REGISTRATION" as const }
      : filter === "active"
        ? { stage: { in: ["RANKING", "KNOCKOUT"] as ("RANKING" | "KNOCKOUT")[] } }
        : { stage: "FINISHED" as const };

  const comps = await prisma.teamCompetition.findMany({
    where: { isPublished: true, ...stageFilter },
    orderBy: { registrationDeadline: "asc" },
    include: {
      _count: { select: { entries: true } },
      medalRewards: { include: { medal: true } },
    },
  });

  const filtered = comps;

  return Promise.all(
    filtered.map((c) => serializeCompetitionListItem(c, userId, joinedCompIds.has(c.id))),
  );
}

export async function getTeamCompetitionDetailForUser(competitionId: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    const { getTeamCompetition } = await import("@/server/services/competition-service");
    return getTeamCompetition(competitionId, userId);
  }

  const comp = await prisma.teamCompetition.findUnique({
    where: { id: competitionId, isPublished: true },
    include: {
      medalRewards: { include: { medal: true } },
      knockoutRounds: { orderBy: { sortOrder: "asc" } },
      stageMatches: {
        orderBy: { sortOrder: "asc" },
        include: { match: true, knockoutRound: true },
      },
      _count: { select: { entries: true } },
    },
  });
  if (!comp) return null;

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: { include: { user: { include: { profile: true } } } },
          competitionEntries: { where: { teamCompetitionId: competitionId } },
        },
      },
    },
  });

  const registeredEntry = await prisma.teamCompetitionEntry.findFirst({
    where: {
      teamCompetitionId: competitionId,
      teamId: { in: memberships.map((m) => m.teamId) },
    },
    include: { team: true },
  });

  const ownerBlock = await getOwnerRegistrationBlock(userId, competitionId);
  const ownedTeamIds = memberships.filter((m) => m.role === "OWNER").map((m) => m.team.id);
  const memberConflictTeamIds = await findTeamsWithMemberCompetitionConflict(
    competitionId,
    ownedTeamIds,
  );

  const ownedTeams = memberships
    .filter((m) => m.role === "OWNER")
    .map((m) => {
      const isRegistered = m.team.competitionEntries.length > 0;
      let canRegister = !isRegistered && !m.team.isSuspended;
      let registrationBlockReason: string | null = null;

      if (
        ownerBlock.registeredTeamIdInThisComp &&
        ownerBlock.registeredTeamIdInThisComp !== m.team.id
      ) {
        canRegister = false;
        registrationBlockReason = OWNER_ALREADY_IN_THIS_COMP_FA;
      } else if (memberConflictTeamIds.has(m.team.id)) {
        canRegister = false;
        registrationBlockReason = TEAM_MEMBER_ALREADY_IN_COMP_FA;
      }

      return {
        id: m.team.id,
        name: m.team.name,
        logoUrl: resolveTeamLogoUrl(m.team),
        memberCount: m.team.members.length,
        isRegistered,
        isSuspended: m.team.isSuspended,
        canRegister,
        registrationBlockReason,
      };
    });

  const memberTeams = memberships
    .filter((m) => m.role !== "OWNER")
    .map((m) => ({
      id: m.team.id,
      name: m.team.name,
      logoUrl: resolveTeamLogoUrl(m.team),
      memberCount: m.team.members.length,
      isRegistered: m.team.competitionEntries.length > 0,
      ownerName: displayName(
        m.team.members.find((tm) => tm.role === "OWNER")?.user ?? {
          username: null,
          profile: null,
        },
      ),
    }));

  const currentStageEndsAt = resolveCurrentStageEndsAt(comp);

  return {
    id: comp.id,
    titleFa: comp.titleFa,
    description: comp.description,
    bannerUrl: resolveTeamCompetitionBannerUrl(comp.bannerUrl),
    teamCapacity: comp.teamCapacity,
    minTeamSize: comp.minTeamSize,
    maxTeamSize: comp.maxTeamSize,
    registrationDeadline: comp.registrationDeadline.toISOString(),
    registrationFeePerMember: comp.registrationFeePerMember,
    rankingStartsAt: comp.rankingStartsAt.toISOString(),
    rankingEndsAt: comp.rankingEndsAt.toISOString(),
    rankingPredictionFeePerMember: comp.rankingPredictionFeePerMember,
    knockoutStartsAt: comp.knockoutStartsAt?.toISOString() ?? null,
    knockoutEndsAt: comp.knockoutEndsAt?.toISOString() ?? null,
    currentStageEndsAt: currentStageEndsAt?.toISOString() ?? null,
    winnerCoinReward: comp.winnerCoinReward,
    runnerUpCoinReward: comp.runnerUpCoinReward,
    stage: comp.stage,
    entryCount: comp._count.entries,
    createdAt: comp.createdAt.toISOString(),
    medals: comp.medalRewards.map((m) => ({
      placement: m.placement,
      titleFa: m.medal.titleFa,
      slug: m.medal.slug,
    })),
    knockoutRounds: comp.knockoutRounds.map((r) => ({
      roundType: r.roundType,
      labelFa: KNOCKOUT_ROUND_LABELS_FA[r.roundType],
      startsAt: r.startsAt?.toISOString() ?? null,
      endsAt: r.endsAt?.toISOString() ?? null,
      predictionFeePerMember: r.predictionFeePerMember,
    })),
    registeredTeam: registeredEntry
      ? {
          id: registeredEntry.team.id,
          name: registeredEntry.team.name,
          logoUrl: resolveTeamLogoUrl(registeredEntry.team),
          rankingScore: registeredEntry.rankingScore,
          isEliminated: registeredEntry.isEliminated,
        }
      : null,
    ownedTeams,
    memberTeams,
    ownerRegistrationBlock: ownerBlock,
    isRegistered: Boolean(registeredEntry),
    userTab: registeredEntry ? "ranking" : "info",
  };
}

export async function previewTeamCompetitionRegistration(
  userId: string,
  competitionId: string,
  teamId: string,
) {
  const comp = await prisma.teamCompetition.findUnique({ where: { id: competitionId } });
  if (!comp || !comp.isPublished) throw new Error("رقابت تیمی یافت نشد");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { include: { user: { include: { profile: true } } } } },
  });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک تیم می‌تواند ثبت‌نام کند");
  if (team.isSuspended) throw new Error("تیم تعلیق شده است");

  await assertTeamCompetitionRegistrationAllowed(userId, competitionId, teamId);

  const fee = comp.registrationFeePerMember;
  const members = await Promise.all(
    team.members.map(async (m) => ({
      userId: m.userId,
      name: displayName(m.user),
      balance: await getUserCoinBalance(m.userId),
      canPay: (await getUserCoinBalance(m.userId)) >= fee,
    })),
  );

  const shortfallMembers = members.filter((m) => !m.canPay);
  const owner = members.find((m) => m.userId === userId)!;

  return {
    feePerMember: fee,
    members,
    shortfallMembers,
    ownerCanPayOwn: owner.canPay,
    ownerBalance: owner.balance,
    needsOwnerCover: shortfallMembers.length > 0,
    totalOwnerCoverNeeded: shortfallMembers.reduce((sum, m) => sum + (fee - m.balance), 0) + (owner.canPay ? 0 : fee - owner.balance),
  };
}

export async function registerTeamInCompetition(
  userId: string,
  competitionId: string,
  teamId: string,
  options: { ownerCoversShortfall?: boolean; notifyMembers?: boolean } = {},
) {
  const comp = await prisma.teamCompetition.findUnique({ where: { id: competitionId } });
  if (!comp || !comp.isPublished) throw new Error("رقابت تیمی یافت نشد");
  if (comp.stage !== "REGISTRATION") throw new Error("مهلت ثبت‌نام این رقابت به پایان رسیده");
  if (new Date() > comp.registrationDeadline) throw new Error("ددلاین ثبت‌نام گذشته است");

  const entryCount = await prisma.teamCompetitionEntry.count({
    where: { teamCompetitionId: competitionId },
  });
  if (entryCount >= comp.teamCapacity) throw new Error("ظرفیت رقابت تکمیل است");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: { include: { user: { include: { profile: true } } } } },
  });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک تیم می‌تواند ثبت‌نام کند");
  if (team.isSuspended) throw new Error("تیم تعلیق شده و مجاز به شرکت در رقابت نیست");
  if (team.members.length < comp.minTeamSize) {
    throw new Error(`حداقل ${comp.minTeamSize} عضو برای ثبت‌نام لازم است`);
  }
  if (team.members.length > comp.maxTeamSize) {
    throw new Error(`حداکثر ${comp.maxTeamSize} عضو مجاز است`);
  }

  await assertTeamCompetitionRegistrationAllowed(userId, competitionId, teamId);

  const existing = await prisma.teamCompetitionEntry.findUnique({
    where: { teamCompetitionId_teamId: { teamCompetitionId: competitionId, teamId } },
  });
  if (existing) throw new Error("تیم قبلاً ثبت‌نام کرده");

  const fee = comp.registrationFeePerMember;
  const preview = await previewTeamCompetitionRegistration(userId, competitionId, teamId);

  if (!preview.ownerCanPayOwn) {
    throw new Error("موجودی سکه شما برای ثبت‌نام کافی نیست");
  }

  if (preview.needsOwnerCover && !options.ownerCoversShortfall) {
    if (options.notifyMembers) {
      for (const member of preview.shortfallMembers) {
        if (member.userId === userId) continue;
        const copy = TEAM_COMP_NOTIFICATION_COPY.notifyMembersToBuyCoins(team.name);
        await createNotification({
          userId: member.userId,
          type: NotificationType.COMPETITION,
          category: NotificationCategory.MESSAGE,
          titleFa: copy.titleFa,
          bodyFa: copy.bodyFa,
          link: "/store",
        });
      }
      return { notified: true, registered: false };
    }
    return {
      needsOwnerCover: true,
      shortfallMembers: preview.shortfallMembers,
      registered: false,
    };
  }

  const description = `ثبت‌نام تیم ${team.name} در ${comp.titleFa}`;
  const coveredRecords: Array<{
    coveredUserId: string;
    coveredByUserId: string;
    amount: number;
  }> = [];

  for (const member of team.members) {
    const balance = await getUserCoinBalance(member.userId);
    if (balance >= fee) {
      const result = await tryDeductTeamCompetitionEntryFee(member.userId, fee, description);
      if (!result.ok) throw new Error(`موجودی سکه ${displayName(member.user)} کافی نیست`);
      continue;
    }

    if (!options.ownerCoversShortfall) {
      throw new Error("برخی اعضا سکه کافی ندارند");
    }

    const shortfall = fee - balance;
    if (balance > 0) {
      await tryDeductTeamCompetitionEntryFee(member.userId, balance, description);
    }
    const ownerResult = await tryDeductTeamCompetitionEntryFee(userId, shortfall, `${description} (متقبل‌شده)`);
    if (!ownerResult.ok) throw new Error("موجودی سکه مالک برای متقبل شدن هزینه کافی نیست");
    coveredRecords.push({
      coveredUserId: member.userId,
      coveredByUserId: userId,
      amount: shortfall,
    });
  }

  const entry = await prisma.$transaction(async (tx) => {
    const created = await tx.teamCompetitionEntry.create({
      data: { teamCompetitionId: competitionId, teamId },
    });
    if (coveredRecords.length > 0) {
      await tx.teamCompetitionFeeCover.createMany({
        data: coveredRecords.map((r) => ({
          teamCompetitionId: competitionId,
          teamId,
          coveredUserId: r.coveredUserId,
          coveredByUserId: r.coveredByUserId,
          amount: r.amount,
          reason: TeamCompetitionFeeCoverReason.REGISTRATION,
        })),
      });
    }
    await tx.userProfile.updateMany({
      where: { userId: { in: team.members.map((m) => m.userId) } },
      data: { teamCompetitionsEntered: { increment: 1 } },
    });
    return created;
  });

  const ownerName = displayName(
    team.members.find((m) => m.userId === userId)!.user,
  );
  const rankingLink = teamCompetitionRankingTabLink(competitionId);

  const ownerCopy = TEAM_COMP_NOTIFICATION_COPY.registrationSuccessOwner(team.name, comp.titleFa);
  await createNotification({
    userId,
    type: NotificationType.COMPETITION,
    category: NotificationCategory.MESSAGE,
    titleFa: ownerCopy.titleFa,
    bodyFa: ownerCopy.bodyFa,
    link: rankingLink,
    secondaryLink: rankingLink,
    secondaryLinkLabelFa: "نشونم بده",
  });

  for (const member of team.members) {
    if (member.userId === userId) continue;
    const wasCovered = coveredRecords.some((r) => r.coveredUserId === member.userId);
    const copy = wasCovered
      ? TEAM_COMP_NOTIFICATION_COPY.ownerCoveredMember(team.name)
      : TEAM_COMP_NOTIFICATION_COPY.registrationSuccessMember(team.name, ownerName, comp.titleFa);
    await createNotification({
      userId: member.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: copy.titleFa,
      bodyFa: copy.bodyFa,
      link: rankingLink,
      secondaryLink: rankingLink,
      secondaryLinkLabelFa: "نشونم بده",
    });
  }

  return { registered: true, entryId: entry.id, rankingLink };
}

export async function notifyOwnerToRegister(
  userId: string,
  competitionId: string,
  teamId: string,
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: { include: { user: { include: { profile: true } } } },
    },
  });
  if (!team) throw new Error("تیم یافت نشد");
  const membership = team.members.find((m) => m.userId === userId);
  if (!membership || membership.role === "OWNER") {
    throw new Error("فقط اعضای تیم می‌توانند به مالک اطلاع دهند");
  }

  const memberName = displayName(membership.user);
  const copy = TEAM_COMP_NOTIFICATION_COPY.memberAskOwnerRegister(memberName, team.name);
  await createNotification({
    userId: team.ownerId,
    type: NotificationType.COMPETITION,
    category: NotificationCategory.MESSAGE,
    titleFa: copy.titleFa,
    bodyFa: copy.bodyFa,
    link: teamCompetitionUpcomingListLink(),
    secondaryLink: `/competitions/teams/${competitionId}/register`,
    secondaryLinkLabelFa: "نشونم بده",
  });

  return { success: true };
}

function teamCompetitionUpcomingListLink() {
  return "/competitions?tab=teams&filter=upcoming";
}

export async function getTeamCompetitionLeaderboard(competitionId: string, userId?: string) {
  const comp = await prisma.teamCompetition.findUnique({
    where: { id: competitionId },
    include: {
      entries: { include: { team: true } },
    },
  });
  if (!comp) throw new Error("رقابت یافت نشد");

  if (comp.stage !== "REGISTRATION") {
    await aggregateRankingScoresForCompetition(competitionId);
    const refreshed = await prisma.teamCompetition.findUnique({
      where: { id: competitionId },
      include: { entries: { include: { team: true } } },
    });
    if (refreshed) {
      comp.entries = refreshed.entries;
    }
  }

  const sortAlpha = comp.stage === "REGISTRATION";
  const rows = [...comp.entries].sort((a, b) => {
    if (sortAlpha) return a.team.name.localeCompare(b.team.name, "fa");
    return b.rankingScore - a.rankingScore || a.team.name.localeCompare(b.team.name, "fa");
  });

  let myTeamId: string | null = null;
  if (userId) {
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId,
        team: { competitionEntries: { some: { teamCompetitionId: competitionId } } },
      },
    });
    myTeamId = membership?.teamId ?? null;
  }

  return {
    stage: comp.stage,
    registrationDeadline: comp.registrationDeadline.toISOString(),
    rankingEndsAt: comp.rankingEndsAt.toISOString(),
    rows: rows.map((entry, index) => ({
      rank: sortAlpha ? index + 1 : index + 1,
      teamId: entry.teamId,
      teamName: entry.team.name,
      logoUrl: resolveTeamLogoUrl(entry.team),
      rankingScore: sortAlpha ? null : entry.rankingScore,
      isEliminated: entry.isEliminated,
      isMine: entry.teamId === myTeamId,
    })),
    myTeamId,
  };
}

export async function getTeamCompetitionBracket(competitionId: string) {
  const comp = await prisma.teamCompetition.findUnique({
    where: { id: competitionId },
    include: {
      entries: { include: { team: true }, orderBy: { seedRank: "asc" } },
      knockoutRounds: { orderBy: { sortOrder: "asc" } },
      knockoutFixtures: {
        include: {
          entryA: { include: { team: true } },
          entryB: { include: { team: true } },
          winnerEntry: { include: { team: true } },
          knockoutRound: true,
        },
        orderBy: [{ knockoutRound: { sortOrder: "asc" } }, { waveIndex: "asc" }, { fixtureIndex: "asc" }],
      },
    },
  });
  if (!comp) throw new Error("رقابت یافت نشد");

  const teams = comp.entries.map((e) => ({
    id: e.teamId,
    entryId: e.id,
    name: e.team.name,
    logoUrl: resolveTeamLogoUrl(e.team),
    score: comp.stage === "REGISTRATION" ? 0 : e.knockoutRoundScore || e.rankingScore,
    rankingScore: e.rankingScore,
    isEliminated: e.isEliminated,
    seedRank: e.seedRank,
    bracketSide: e.bracketSide,
    bracketGroupIndex: e.bracketGroupIndex,
  }));

  if (comp.bracketGeneratedAt && comp.knockoutFixtures.length > 0) {
    const fixtures = comp.knockoutFixtures.map((f) => ({
      id: f.id,
      roundType: f.knockoutRound.roundType,
      waveIndex: f.waveIndex,
      bracketSide: f.bracketSide,
      entryAScore: f.entryAScore,
      entryBScore: f.entryBScore,
      resolved: Boolean(f.resolvedAt),
      winnerTeamId: f.winnerEntry?.teamId ?? null,
      left: f.entryA
        ? {
            id: f.entryA.teamId,
            name: f.entryA.team.name,
            logoUrl: resolveTeamLogoUrl(f.entryA.team),
            score: f.entryAScore,
            isEliminated: f.entryA.isEliminated,
          }
        : null,
      right: f.entryB
        ? {
            id: f.entryB.teamId,
            name: f.entryB.team.name,
            logoUrl: resolveTeamLogoUrl(f.entryB.team),
            score: f.entryBScore,
            isEliminated: f.entryB.isEliminated,
          }
        : null,
    }));

    return {
      teamCapacity: comp.teamCapacity,
      stage: comp.stage,
      winnerEntryId: comp.winnerEntryId,
      runnerUpEntryId: comp.runnerUpEntryId,
      fixtures,
      teams,
      pairs: fixtures.map((f) => ({ left: f.left, right: f.right })),
    };
  }

  const pairs: Array<{ left: (typeof teams)[0] | null; right: (typeof teams)[0] | null }> = [];
  const sorted = [...teams].sort((a, b) => b.rankingScore - a.rankingScore || a.name.localeCompare(b.name, "fa"));
  for (let i = 0; i < Math.floor(sorted.length / 2); i++) {
    pairs.push({
      left: sorted[i] ?? null,
      right: sorted[sorted.length - 1 - i] ?? null,
    });
  }

  return {
    teamCapacity: comp.teamCapacity,
    stage: comp.stage,
    winnerEntryId: comp.winnerEntryId,
    runnerUpEntryId: comp.runnerUpEntryId,
    pairs,
    teams,
    fixtures: [],
  };
}

export async function notifyKnockoutElimination(teamCompetitionId: string, teamId: string) {
  const [comp, members] = await Promise.all([
    prisma.teamCompetition.findUnique({
      where: { id: teamCompetitionId },
      select: { titleFa: true },
    }),
    prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    }),
  ]);
  if (!comp) return;

  const link = teamCompetitionKnockoutTabLink(teamCompetitionId);
  const copy = TEAM_COMP_NOTIFICATION_COPY.knockoutEliminated(comp.titleFa);

  for (const member of members) {
    await createNotification({
      userId: member.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: copy.titleFa,
      bodyFa: copy.bodyFa,
      link,
      secondaryLink: link,
      secondaryLinkLabelFa: "نشونم بده",
    });
  }
}
