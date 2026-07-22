import {
  AdminConfigKey,
  CoinTransactionType,
  NotificationCategory,
  NotificationType,
  TeamInviteStatus,
  TeamRole,
  TeamStatus,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { createNotification, dismissTeamInviteNotifications } from "@/server/services/notification-service";
import { deductCoins, deductCoinsWithType } from "@/server/services/wallet-service";
import { assertFootballCreditConfirmationSatisfied } from "@/server/services/asset-payment-service";
import {
  MEMBERSHIP_REQUEST_EXTRA_FEE,
  MEMBERSHIP_REQUEST_FREE_WEEKLY,
  TEAM_COMP_NOTIFICATION_COPY,
} from "@/shared/constants/team-competition-user";
import {
  isPaidTeamLogo,
  isSelectableTeamLogo,
  TEAM_EXTRA_INVITE_FEE,
  TEAM_FORMATION_FEE,
  TEAM_FREE_INVITE_LIMIT,
  TEAM_JOIN_FEE,
  TEAM_LEAVE_FEE,
  TEAM_LOGO_COST,
  TEAM_MEDAL_SLUGS,
  TEAM_MEMBER_REINVITE_BAN_DAYS,
  TEAM_MEMBER_REINVITE_BAN_ERROR,
  TEAM_ALREADY_MEMBER_ERROR,
  TEAM_REMOVE_MEMBER_FEE,
  TEAM_RENAME_FEE,
  TeamMembershipConflictError,
  resolveTeamLogoUrl,
  teamLogoUrl,
} from "@/shared/constants/teams";
import { validateTeamName } from "@/shared/lib/team-name";
import { getEligibleGlobalRankForUser } from "@/server/services/leaderboard-service";
import { getTeamLeaderboardRank, getTeamLeaderboardPoints } from "@/server/services/team-leaderboard-service";
import { buildHonorsList, type EarnedMedalInput } from "@/shared/lib/honors";
import type { PublicTeamShowcaseData } from "@/shared/types/public-team-showcase";

export type TeamCapacityConfig = {
  min: number;
  max: number;
  freeInviteLimit: number;
};

export async function getTeamCapacityConfig(): Promise<TeamCapacityConfig> {
  const [minRow, maxRow, inviteRow] = await Promise.all([
    prisma.adminConfig.findUnique({ where: { key: AdminConfigKey.TEAM_MIN_CAPACITY } }),
    prisma.adminConfig.findUnique({ where: { key: AdminConfigKey.TEAM_MAX_CAPACITY } }),
    prisma.adminConfig.findUnique({ where: { key: AdminConfigKey.TEAM_FREE_INVITE_LIMIT } }),
  ]);
  return {
    min: Number(minRow?.value ?? 2),
    max: Number(maxRow?.value ?? 3),
    freeInviteLimit: Number(inviteRow?.value ?? TEAM_FREE_INVITE_LIMIT),
  };
}

async function ensureLogoUnlocked(userId: string, logoKey: number) {
  if (!isSelectableTeamLogo(logoKey)) throw new Error("این لوگو در دسترس نیست");
  if (!isPaidTeamLogo(logoKey)) return;
  const unlocked = await prisma.userUnlockedTeamLogo.findUnique({
    where: { userId_logoKey: { userId, logoKey } },
  });
  if (!unlocked) throw new Error("این لوگو قفل است. ابتدا آن را خریداری کنید");
}

export async function getTeamDraft(userId: string) {
  return prisma.teamCreationDraft.findUnique({ where: { userId } });
}

export async function saveTeamDraft(
  userId: string,
  data: {
    introCompleted?: boolean;
    step?: string;
    name?: string | null;
    capacity?: number | null;
    logoKey?: number | null;
  },
) {
  const config = await getTeamCapacityConfig();
  if (data.name != null) {
    const validation = validateTeamName(data.name);
    if (!validation.ok) throw new Error(validation.error);
    const currentDraft = await prisma.teamCreationDraft.findUnique({ where: { userId } });
    const existing = await prisma.team.findUnique({ where: { name: data.name.trim() } });
    if (existing && existing.id !== currentDraft?.formingTeamId) {
      throw new Error("نام تیم تکراری است");
    }
  }
  if (data.capacity != null) {
    if (data.capacity < config.min || data.capacity > config.max) {
      throw new Error(`ظرفیت تیم باید بین ${config.min} تا ${config.max} نفر باشد`);
    }
  }
  if (data.logoKey != null) {
    await ensureLogoUnlocked(userId, data.logoKey);
  }

  return prisma.teamCreationDraft.upsert({
    where: { userId },
    create: {
      userId,
      introCompleted: data.introCompleted ?? false,
      step: data.step ?? "intro",
      name: data.name ?? undefined,
      capacity: data.capacity ?? undefined,
      logoKey: data.logoKey ?? undefined,
    },
    update: {
      ...(data.introCompleted !== undefined ? { introCompleted: data.introCompleted } : {}),
      ...(data.step !== undefined ? { step: data.step } : {}),
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.logoKey !== undefined ? { logoKey: data.logoKey } : {}),
    },
  });
}

export async function purchaseTeamLogo(userId: string, logoKey: number) {
  if (!isSelectableTeamLogo(logoKey)) throw new Error("این لوگو در دسترس نیست");
  if (!isPaidTeamLogo(logoKey)) throw new Error("این لوگو رایگان است");
  const existing = await prisma.userUnlockedTeamLogo.findUnique({
    where: { userId_logoKey: { userId, logoKey } },
  });
  if (existing) return { alreadyOwned: true };

  await deductCoinsWithType(
    userId,
    TEAM_LOGO_COST,
    CoinTransactionType.TEAM_LOGO_PURCHASE,
    `خرید لوگوی تیم ${logoKey}`,
  );

  await prisma.userUnlockedTeamLogo.create({ data: { userId, logoKey } });
  return { alreadyOwned: false };
}

export async function getUnlockedTeamLogos(userId: string) {
  const rows = await prisma.userUnlockedTeamLogo.findMany({ where: { userId } });
  return rows.map((r) => r.logoKey);
}

export async function payFormationFee(userId: string) {
  const draft = await prisma.teamCreationDraft.findUnique({ where: { userId } });
  if (!draft?.name || !draft.capacity || !draft.logoKey) {
    throw new Error("ابتدا نام، ظرفیت و لوگوی تیم را تکمیل کنید");
  }
  if (draft.formationFeePaid && draft.formingTeamId) {
    return { teamId: draft.formingTeamId, alreadyPaid: true };
  }

  const validation = validateTeamName(draft.name);
  if (!validation.ok) throw new Error(validation.error);

  const duplicate = await prisma.team.findUnique({ where: { name: draft.name.trim() } });
  if (duplicate) throw new Error("نام تیم تکراری است");

  await ensureLogoUnlocked(userId, draft.logoKey);

  await assertFootballCreditConfirmationSatisfied(userId, TEAM_FORMATION_FEE);

  const { consumeEnergy } = await import("@/server/services/energy-service");
  await consumeEnergy(userId, "TEAM_CREATION");

  const team = await prisma.$transaction(async (tx) => {
    await deductCoinsWithType(
      userId,
      TEAM_FORMATION_FEE,
      CoinTransactionType.TEAM_FORMATION_FEE,
      `هزینه تشکیل تیم ${draft.name}`,
    );

    const created = await tx.team.create({
      data: {
        name: draft.name!.trim(),
        logoKey: draft.logoKey!,
        logoUrl: teamLogoUrl(draft.logoKey!),
        capacity: draft.capacity!,
        ownerId: userId,
        status: TeamStatus.FORMING,
        members: { create: { userId, role: TeamRole.OWNER } },
      },
    });

    await tx.teamCreationDraft.update({
      where: { userId },
      data: {
        formationFeePaid: true,
        formingTeamId: created.id,
        step: "members",
      },
    });

    return created;
  });

  return { teamId: team.id, alreadyPaid: false };
}

function isTeamComplete(memberCount: number, capacity: number) {
  return memberCount >= capacity;
}

async function serializeTeamForUser(
  team: {
    id: string;
    name: string;
    logoKey: number | null;
    logoUrl: string | null;
    capacity: number;
    ownerId: string;
    status: TeamStatus;
    createdAt: Date;
    members: Array<{ userId: string }>;
    invites: Array<{ status: TeamInviteStatus }>;
    membershipRequests?: Array<{ id: string }>;
  },
  userId: string,
  membershipRole: TeamRole,
) {
  const isOwner = team.ownerId === userId;
  const acceptedMembers = team.members.length;
  const pendingInvites = team.invites.filter((i) => i.status === TeamInviteStatus.PENDING).length;
  const complete = isTeamComplete(acceptedMembers, team.capacity);
  const needed = Math.max(0, team.capacity - 1);
  const hasAssignedRole =
    membershipRole === TeamRole.OWNER || membershipRole === TeamRole.CAPTAIN;

  const pendingMembershipRequestCount = isOwner
    ? (team.membershipRequests?.length ?? 0)
    : 0;

  return {
    id: team.id,
    name: team.name,
    logoKey: team.logoKey,
    logoUrl: team.logoKey ? teamLogoUrl(team.logoKey) : team.logoUrl,
    capacity: team.capacity,
    createdAt: team.createdAt.toISOString(),
    role: isOwner ? "owner" : "member",
    membershipRole,
    hasAssignedRole,
    roleFa:
      membershipRole === TeamRole.OWNER
        ? "مالک"
        : membershipRole === TeamRole.CAPTAIN
          ? "کاپیتان"
          : "عضو عادی",
    memberCount: acceptedMembers,
    pendingInviteCount: pendingInvites,
    pendingMembershipRequestCount,
    acceptanceStatusFa: `${Math.max(0, acceptedMembers - 1)} از ${needed} عضو پذیرفته`,
    isComplete: complete,
    status: team.status,
  };
}

export async function listMyTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: true,
          invites: true,
          membershipRequests: { where: { status: "PENDING" }, select: { id: true } },
        },
      },
    },
  });

  const teams = await Promise.all(
    memberships.map((m) => serializeTeamForUser(m.team, userId, m.role)),
  );

  return teams.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function getPendingInvitesReceived(userId: string) {
  const invites = await prisma.teamInvite.findMany({
    where: { inviteeId: userId, status: TeamInviteStatus.PENDING },
    include: {
      team: {
        include: {
          members: {
            include: {
              user: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
            },
          },
        },
      },
      inviter: { include: { profile: { select: { displayName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invites.map((inv) => ({
    id: inv.id,
    teamId: inv.teamId,
    teamName: inv.team.name,
    teamLogoUrl: inv.team.logoKey ? teamLogoUrl(inv.team.logoKey) : inv.team.logoUrl,
    ownerName: inv.inviter.profile?.displayName ?? "مالک",
    members: inv.team.members.map((m) => ({
      id: m.id,
      displayName: m.user.profile?.displayName ?? "بازیکن",
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      role: m.role,
    })),
    createdAt: inv.createdAt.toISOString(),
  }));
}

export async function listUsersForTeamInvite(userId: string, search?: string, teamId?: string) {
  let pendingInviteeIds = new Set<string>();
  let memberUserIds = new Set<string>();

  if (teamId) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { invites: true, members: { select: { userId: true } } },
    });
    if (team?.ownerId === userId) {
      pendingInviteeIds = new Set(
        team.invites
          .filter((i) => i.status === TeamInviteStatus.PENDING)
          .map((i) => i.inviteeId),
      );
      memberUserIds = new Set(team.members.map((m) => m.userId));
    }
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      isActive: true,
      ...(search?.trim()
        ? {
            OR: [
              { profile: { displayName: { contains: search.trim() } } },
              { username: { contains: search.trim() } },
              { phone: { contains: search.trim() } },
            ],
          }
        : {}),
    },
    include: {
      profile: { select: { displayName: true, avatarUrl: true, showcaseSlug: true, totalXp: true } },
      userMedals: { include: { medal: { select: { slug: true, titleFa: true } } } },
    },
    take: 50,
    orderBy: { profile: { totalXp: "desc" } },
  });

  return Promise.all(
    users.map(async (u) => {
      const rank = await getEligibleGlobalRankForUser(u.id);
      return {
        id: u.id,
        displayName: u.profile?.displayName ?? u.username ?? "بازیکن",
        avatarUrl: u.profile?.avatarUrl ?? null,
        showcaseSlug: u.profile?.showcaseSlug ?? null,
        totalXp: u.profile?.totalXp ?? 0,
        globalRank: rank,
        medalCount: u.userMedals.length,
        medals: u.userMedals.slice(0, 5).map((m) => ({
          slug: m.medal.slug,
          titleFa: m.medal.titleFa,
        })),
        invitePending: pendingInviteeIds.has(u.id),
        isTeamMember: memberUserIds.has(u.id),
      };
    }),
  );
}

async function countTeamInvitesSent(teamId: string) {
  return prisma.teamInvite.count({ where: { teamId } });
}

async function assertCanInvitePlayer(ownerId: string, inviteeId: string) {
  const since = new Date(Date.now() - TEAM_MEMBER_REINVITE_BAN_DAYS * 24 * 60 * 60 * 1000);
  const recentRemoval = await prisma.teamMemberRemoval.findFirst({
    where: {
      ownerId,
      inviteeId,
      removedAt: { gte: since },
    },
    orderBy: { removedAt: "desc" },
  });
  if (recentRemoval) throw new Error(TEAM_MEMBER_REINVITE_BAN_ERROR);
}

export async function sendTeamInvite(userId: string, teamId: string, inviteeId: string) {
  if (userId === inviteeId) throw new Error("نمی‌توانید خودتان را دعوت کنید");

  await assertCanInvitePlayer(userId, inviteeId);

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک تیم می‌تواند دعوت ارسال کند");
  if (team.members.some((m) => m.userId === inviteeId)) {
    throw new Error(TEAM_ALREADY_MEMBER_ERROR);
  }

  const existingInvite = await prisma.teamInvite.findUnique({
    where: { teamId_inviteeId: { teamId, inviteeId } },
  });
  if (existingInvite?.status === TeamInviteStatus.PENDING) {
    throw new Error("درخواست عضویت قبلاً ارسال شده");
  }

  const config = await getTeamCapacityConfig();
  const isReinvite = !!existingInvite;
  let coinCost = 0;
  if (!isReinvite) {
    const sentCount = await countTeamInvitesSent(teamId);
    if (sentCount >= config.freeInviteLimit) {
      coinCost = TEAM_EXTRA_INVITE_FEE;
    }
  }

  if (coinCost > 0) {
    await assertFootballCreditConfirmationSatisfied(userId, coinCost);
  }

  const { consumeEnergy } = await import("@/server/services/energy-service");
  await consumeEnergy(userId, "TEAM_MEMBER_SELECTION");

  if (coinCost > 0) {
    await deductCoinsWithType(
      userId,
      coinCost,
      CoinTransactionType.TEAM_EXTRA_INVITE_FEE,
      `هزینه دعوت اضافی تیم ${team.name}`,
    );
  }

  const ownerProfile = await prisma.userProfile.findUnique({ where: { userId } });
  const ownerName = ownerProfile?.displayName ?? "مالک";

  const messageTitle = `${ownerName} شما رو به تیم ${team.name} دعوت کرده. درخواستش رو قبول میکنی؟`;

  const invite = existingInvite
    ? await prisma.teamInvite.update({
        where: { id: existingInvite.id },
        data: {
          status: TeamInviteStatus.PENDING,
          inviterId: userId,
          ...(coinCost > 0 ? { coinCostApplied: { increment: coinCost } } : {}),
        },
      })
    : await prisma.teamInvite.create({
        data: {
          teamId,
          inviterId: userId,
          inviteeId,
          coinCostApplied: coinCost,
        },
      });

  await dismissTeamInviteNotifications(inviteeId, invite.id);

  await createNotification({
    userId: inviteeId,
    type: NotificationType.TEAM_INVITE,
    category: NotificationCategory.MESSAGE,
    titleFa: messageTitle,
    bodyFa: messageTitle,
    link: `/profile/teams?inviteId=${invite.id}`,
    secondaryLink: `/profile/teams?inviteId=${invite.id}`,
    secondaryLinkLabelFa: "مشاهده",
  });

  return invite;
}

export async function finalizeTeamCreation(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== userId) throw new Error("دسترسی غیرمجاز");

  await prisma.team.update({
    where: { id: teamId },
    data: { status: TeamStatus.ACTIVE },
  });

  await prisma.teamCreationDraft.deleteMany({ where: { userId } });

  return { success: true };
}

async function getForeignTeamMembership(userId: string, excludeTeamId: string) {
  return prisma.teamMember.findFirst({
    where: {
      userId,
      teamId: { not: excludeTeamId },
      team: { ownerId: { not: userId } },
    },
    include: { team: true },
  });
}

export async function acceptTeamInvite(userId: string, inviteId: string) {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: { team: { include: { members: true } } },
  });
  if (!invite || invite.inviteeId !== userId) throw new Error("دعوت یافت نشد");
  if (invite.status !== TeamInviteStatus.PENDING) throw new Error("این دعوت دیگر معتبر نیست");

  if (invite.team.members.some((m) => m.userId === userId)) {
    throw new Error("شما هم‌اکنون عضو این تیم هستید");
  }

  const foreignMembership = await getForeignTeamMembership(userId, invite.teamId);
  if (foreignMembership) {
    throw new TeamMembershipConflictError(
      foreignMembership.team.id,
      foreignMembership.team.name,
      false,
    );
  }

  if (invite.team.members.length >= invite.team.capacity) {
    throw new Error("ظرفیت تیم تکمیل شده است");
  }

  await prisma.$transaction(async (tx) => {
    await deductCoinsWithType(
      userId,
      TEAM_JOIN_FEE,
      CoinTransactionType.TEAM_JOIN_FEE,
      `عضویت در تیم ${invite.team.name}`,
    );

    await tx.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        role: TeamRole.MEMBER,
      },
    });

    await tx.teamInvite.update({
      where: { id: inviteId },
      data: { status: TeamInviteStatus.ACCEPTED },
    });
  });

  await dismissTeamInviteNotifications(userId, inviteId);
  await notifyTeamOwnerMemberJoined(invite.teamId, userId);

  return { success: true };
}

export async function switchTeamViaInvite(userId: string, inviteId: string) {
  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: { team: { include: { members: true } } },
  });
  if (!invite || invite.inviteeId !== userId) throw new Error("دعوت یافت نشد");
  if (invite.status !== TeamInviteStatus.PENDING) throw new Error("این دعوت دیگر معتبر نیست");

  if (invite.team.members.some((m) => m.userId === userId)) {
    throw new Error("شما هم‌اکنون عضو این تیم هستید");
  }

  const currentMembership = await getForeignTeamMembership(userId, invite.teamId);
  if (!currentMembership) throw new Error("شما در تیم دیگری عضو نیستید");

  if (invite.team.members.length >= invite.team.capacity) {
    throw new Error("ظرفیت تیم تکمیل شده است");
  }

  const leaverProfile = await prisma.userProfile.findUnique({ where: { userId } });
  const leaverName = leaverProfile?.displayName ?? "عضو";
  const leftTeam = currentMembership.team;

  await prisma.$transaction(async (tx) => {
    await deductCoinsWithType(
      userId,
      TEAM_LEAVE_FEE,
      CoinTransactionType.TEAM_LEAVE_FEE,
      `ترک تیم ${leftTeam.name} و عضویت در ${invite.team.name}`,
    );

    await tx.teamMember.delete({ where: { id: currentMembership.id } });

    await tx.teamMember.create({
      data: {
        teamId: invite.teamId,
        userId,
        role: TeamRole.MEMBER,
      },
    });

    await tx.teamInvite.update({
      where: { id: inviteId },
      data: { status: TeamInviteStatus.ACCEPTED },
    });
  });

  await createNotification({
    userId: leftTeam.ownerId,
    type: NotificationType.TEAM_MEMBER_LEFT,
    titleFa: `${leaverName}، تیم ${leftTeam.name} شما رو ترک کرد!`,
    bodyFa: `${leaverName}، تیم ${leftTeam.name} شما رو ترک کرد!`,
    link: `/profile/teams/${leftTeam.id}`,
  });

  await dismissTeamInviteNotifications(userId, inviteId);
  await notifyTeamOwnerMemberJoined(invite.teamId, userId);

  return { success: true };
}

export async function rejectTeamInvite(userId: string, inviteId: string) {
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.inviteeId !== userId) throw new Error("دعوت یافت نشد");

  await prisma.teamInvite.update({
    where: { id: inviteId },
    data: { status: TeamInviteStatus.REJECTED },
  });

  await dismissTeamInviteNotifications(userId, inviteId);

  return { success: true };
}

export async function getTeamDetail(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            include: {
              profile: {
                select: { displayName: true, avatarUrl: true, showcaseSlug: true },
              },
            },
          },
        },
      },
      invites: {
        where: { status: TeamInviteStatus.PENDING },
        include: {
          invitee: { include: { profile: { select: { displayName: true, avatarUrl: true } } } },
        },
      },
      teamMedals: { include: { medal: true } },
    },
  });

  if (!team) throw new Error("تیم یافت نشد");

  const membership = team.members.find((m) => m.userId === userId);
  if (!membership) throw new Error("دسترسی غیرمجاز");

  const isOwner = team.ownerId === userId;
  const earnedMedals: EarnedMedalInput[] = team.teamMedals.map((tm) => ({
    earnedAt: tm.earnedAt.toISOString(),
    earnedReason: tm.earnedReason,
    medal: {
      slug: tm.medal.slug,
      titleFa: tm.medal.titleFa,
      tier: tm.medal.tier,
      category: tm.medal.category,
    },
  }));

  const allHonors = buildHonorsList(earnedMedals).filter((h) =>
    TEAM_MEDAL_SLUGS.includes(h.slug as (typeof TEAM_MEDAL_SLUGS)[number]),
  );

  const config = await getTeamCapacityConfig();
  const sentInvites = await countTeamInvitesSent(teamId);
  const pendingMembershipRequests = isOwner
    ? await listPendingMembershipRequests(teamId, userId)
    : [];

  return {
    id: team.id,
    name: team.name,
    logoKey: team.logoKey,
    logoUrl: team.logoKey ? teamLogoUrl(team.logoKey) : team.logoUrl,
    capacity: team.capacity,
    createdAt: team.createdAt.toISOString(),
    isOwner,
    isComplete: isTeamComplete(team.members.length, team.capacity),
    members: team.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user.profile?.displayName ?? "بازیکن",
      avatarUrl: m.user.profile?.avatarUrl ?? null,
      showcaseSlug: m.user.profile?.showcaseSlug ?? null,
      role: m.role,
      roleFa: teamRoleFa(m.role),
      joined: true,
    })),
    pendingInvites: isOwner
      ? team.invites.map((i) => ({
          id: i.id,
          userId: i.inviteeId,
          displayName: i.invitee.profile?.displayName ?? "بازیکن",
          avatarUrl: i.invitee.profile?.avatarUrl ?? null,
          joined: false,
        }))
      : [],
    honors: allHonors,
    inviteStats: {
      sent: sentInvites,
      freeLimit: config.freeInviteLimit,
      extraCost: TEAM_EXTRA_INVITE_FEE,
    },
    unlockedLogos: isOwner ? await getUnlockedTeamLogos(userId) : [],
    pendingMembershipRequests,
  };
}

export async function renameTeam(userId: string, teamId: string, name: string) {
  const validation = validateTeamName(name);
  if (!validation.ok) throw new Error(validation.error);

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک می‌تواند نام را تغییر دهد");

  const duplicate = await prisma.team.findFirst({
    where: { name: name.trim(), NOT: { id: teamId } },
  });
  if (duplicate) throw new Error("نام تیم تکراری است");

  await deductCoinsWithType(
    userId,
    TEAM_RENAME_FEE,
    CoinTransactionType.TEAM_RENAME_FEE,
    `تغییر نام تیم به ${name.trim()}`,
  );

  return prisma.team.update({
    where: { id: teamId },
    data: { name: name.trim() },
  });
}

export async function updateTeamLogo(userId: string, teamId: string, logoKey: number) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک می‌تواند لوگو را تغییر دهد");

  await ensureLogoUnlocked(userId, logoKey);

  return prisma.team.update({
    where: { id: teamId },
    data: { logoKey, logoUrl: teamLogoUrl(logoKey) },
  });
}

export async function removeTeamMember(userId: string, teamId: string, memberId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک می‌تواند عضو را حذف کند");

  const member = team.members.find((m) => m.id === memberId);
  if (!member) throw new Error("عضو یافت نشد");
  if (member.role === TeamRole.OWNER) throw new Error("مالک قابل حذف نیست");

  await deductCoinsWithType(
    userId,
    TEAM_REMOVE_MEMBER_FEE,
    CoinTransactionType.TEAM_REMOVE_MEMBER_FEE,
    `حذف عضو از تیم ${team.name}`,
  );

  await prisma.teamMember.delete({ where: { id: memberId } });

  await prisma.teamMemberRemoval.create({
    data: {
      ownerId: userId,
      teamId,
      inviteeId: member.userId,
    },
  });

  await prisma.teamInvite.updateMany({
    where: { teamId, inviteeId: member.userId },
    data: { status: TeamInviteStatus.CANCELLED },
  });

  const ownerProfile = await prisma.userProfile.findUnique({ where: { userId } });
  const ownerName = ownerProfile?.displayName ?? "مالک تیم";
  const removalMessage = `متاسفانه ${ownerName} شما رو از تیم ${team.name} حذف کرده!`;

  await createNotification({
    userId: member.userId,
    type: NotificationType.SYSTEM,
    titleFa: removalMessage,
    bodyFa: removalMessage,
    link: "/profile/teams",
  });

  return { success: true };
}

export async function assignTeamMemberRole(
  userId: string,
  teamId: string,
  memberId: string,
  role: "CAPTAIN" | "MEMBER",
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک می‌تواند سمت تعیین کند");

  const member = team.members.find((m) => m.id === memberId);
  if (!member || member.role === TeamRole.OWNER) {
    throw new Error("برای این عضو نمی‌توان سمت تعیین کرد");
  }

  if (role === "CAPTAIN") {
    await prisma.teamMember.updateMany({
      where: { teamId, role: TeamRole.CAPTAIN },
      data: { role: TeamRole.MEMBER },
    });
  }

  await prisma.teamMember.update({
    where: { id: memberId },
    data: { role: role === "CAPTAIN" ? TeamRole.CAPTAIN : TeamRole.MEMBER },
  });

  return { success: true };
}

export async function leaveTeam(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("تیم یافت نشد");
  if (team.ownerId === userId) throw new Error("مالک نمی‌تواند تیم را ترک کند");

  const membership = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!membership) throw new Error("عضو تیم نیستید");

  const leaverProfile = await prisma.userProfile.findUnique({ where: { userId } });
  const leaverName = leaverProfile?.displayName ?? "عضو";

  await deductCoinsWithType(
    userId,
    TEAM_LEAVE_FEE,
    CoinTransactionType.TEAM_LEAVE_FEE,
    `ترک تیم ${team.name}`,
  );

  await prisma.teamMember.delete({ where: { id: membership.id } });

  await createNotification({
    userId: team.ownerId,
    type: NotificationType.TEAM_MEMBER_LEFT,
    titleFa: `${leaverName}، تیم ${team.name} شما رو ترک کرد!`,
    bodyFa: `${leaverName}، تیم ${team.name} شما رو ترک کرد!`,
    link: `/profile/teams/${teamId}`,
  });

  return { success: true };
}

function displayName(user: {
  username: string | null;
  profile: { displayName: string | null } | null;
}) {
  return user.profile?.displayName ?? user.username ?? "کاربر";
}

const userPublicInclude = {
  include: { profile: { select: { displayName: true } } },
} as const;

export async function listUserTeams(userId: string) {
  if (await shouldUseMemoryDb()) return { owned: [], member: [] };

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: {
      team: {
        include: {
          members: true,
          _count: { select: { competitionEntries: true } },
        },
      },
    },
  });

  return {
    owned: memberships
      .filter((m) => m.role === "OWNER")
      .map((m) => ({
        id: m.team.id,
        name: m.team.name,
        logoUrl: resolveTeamLogoUrl(m.team),
        memberCount: m.team.members.length,
        isSuspended: m.team.isSuspended,
        competitionCount: m.team._count.competitionEntries,
      })),
    member: memberships
      .filter((m) => m.role !== "OWNER")
      .map((m) => ({
        id: m.team.id,
        name: m.team.name,
        logoUrl: resolveTeamLogoUrl(m.team),
        memberCount: m.team.members.length,
        role: m.role,
      })),
  };
}

export async function browseTeamsForCompetition(
  competitionId: string,
  filter: "all" | "open",
) {
  const comp = await prisma.teamCompetition.findUnique({ where: { id: competitionId } });
  if (!comp) throw new Error("رقابت یافت نشد");

  const teams = await prisma.team.findMany({
    where: { isSuspended: false },
    include: {
      members: true,
      competitionEntries: { where: { teamCompetitionId: competitionId } },
    },
    orderBy: { name: "asc" },
  });

  const mapped = teams
    .map((team) => {
      const memberCount = team.members.length;
      const hasOpenSlots = memberCount < team.capacity;
      return {
        id: team.id,
        name: team.name,
        logoUrl: team.logoKey ? teamLogoUrl(team.logoKey) : team.logoUrl,
        memberCount,
        maxTeamSize: team.capacity,
        hasOpenSlots,
        isRegistered: team.competitionEntries.length > 0,
        totalScore: team.competitionEntries[0]?.rankingScore ?? 0,
      };
    })
    .filter((t) => (filter === "open" ? t.hasOpenSlots : true))
    .sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name, "fa"));

  return mapped;
}

function teamRoleFa(role: TeamRole) {
  if (role === TeamRole.OWNER) return "مالک";
  if (role === TeamRole.CAPTAIN) return "کاپیتان";
  return "عضو عادی";
}

async function notifyTeamOwnerMemberJoined(teamId: string, memberUserId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, ownerId: true, name: true },
  });
  if (!team) return;

  const memberProfile = await prisma.userProfile.findUnique({
    where: { userId: memberUserId },
    select: { displayName: true },
  });
  const memberName = memberProfile?.displayName ?? "کاربر";
  const bodyFa = `${memberName} به تیم شما ${team.name} ملحق شد.`;
  const link = `/profile/teams/${team.id}?memberJoined=${memberUserId}`;

  const existing = await prisma.notification.findFirst({
    where: {
      userId: team.ownerId,
      type: NotificationType.SYSTEM,
      category: NotificationCategory.MESSAGE,
      link,
    },
  });
  if (existing) return;

  await createNotification({
    userId: team.ownerId,
    type: NotificationType.SYSTEM,
    category: NotificationCategory.MESSAGE,
    titleFa: "عضو جدید",
    bodyFa,
    link,
  });
}

const TEAM_ROLE_ORDER: Record<TeamRole, number> = {
  [TeamRole.OWNER]: 0,
  [TeamRole.CAPTAIN]: 1,
  [TeamRole.MEMBER]: 2,
};

export async function getTeamShowcaseProfile(teamId: string): Promise<PublicTeamShowcaseData | null> {
  if (await shouldUseMemoryDb()) {
    const cd = (
      globalThis as unknown as {
        __bordinDevDb?: {
          competitionData: {
            teams: Array<{
              id: string;
              name: string;
              logoUrl: string | null;
              capacity?: number;
              members: Array<{ userId: string; role?: string }>;
            }>;
            teamCompetitionEntries: Array<{
              teamId: string;
              rankingScore: number;
              teamCompetitionId: string;
            }>;
          };
        };
      }
    ).__bordinDevDb?.competitionData;
    if (!cd) return null;

    const team = cd.teams.find((row) => row.id === teamId);
    if (!team) return null;

    const [leaderboardRank, leaderboardTotalPoints] = await Promise.all([
      getTeamLeaderboardRank(teamId),
      getTeamLeaderboardPoints(teamId),
    ]);

    return {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      memberCount: team.members.length,
      capacity: team.capacity ?? 3,
      competitionCount: cd.teamCompetitionEntries.filter((entry) => entry.teamId === teamId).length,
      leaderboardRank,
      leaderboardTotalPoints,
      isSuspended: false,
      members: team.members.map((member) => ({
        userId: member.userId,
        name: "عضو تیم",
        role: member.role ?? TeamRole.MEMBER,
        roleFa: teamRoleFa((member.role as TeamRole) ?? TeamRole.MEMBER),
        globalRank: null,
        totalXp: 0,
        showcaseSlug: null,
      })),
      competitions: [],
      medals: [],
    };
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              profile: {
                select: {
                  displayName: true,
                  globalRank: true,
                  totalXp: true,
                  showcaseSlug: true,
                },
              },
            },
          },
        },
      },
      competitionEntries: {
        include: { teamCompetition: { select: { id: true, titleFa: true, stage: true } } },
        orderBy: { createdAt: "desc" },
      },
      teamMedals: { include: { medal: true }, orderBy: { earnedAt: "desc" } },
    },
  });

  if (!team) return null;

  const members = [...team.members]
    .sort((a, b) => TEAM_ROLE_ORDER[a.role] - TEAM_ROLE_ORDER[b.role])
    .map((member) => ({
      userId: member.userId,
      name: displayName(member.user),
      role: member.role,
      roleFa: teamRoleFa(member.role),
      globalRank: member.user.profile?.globalRank ?? null,
      totalXp: member.user.profile?.totalXp ?? 0,
      showcaseSlug: member.user.profile?.showcaseSlug ?? null,
    }));

  const medals: EarnedMedalInput[] = team.teamMedals.map((teamMedal) => ({
    earnedAt: teamMedal.earnedAt.toISOString(),
    earnedReason: teamMedal.earnedReason,
    medal: {
      slug: teamMedal.medal.slug,
      titleFa: teamMedal.medal.titleFa,
      tier: teamMedal.medal.tier,
      category: teamMedal.medal.category,
    },
  }));

  const [leaderboardRank, leaderboardTotalPoints] = await Promise.all([
    getTeamLeaderboardRank(teamId),
    getTeamLeaderboardPoints(teamId),
  ]);

  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoKey ? teamLogoUrl(team.logoKey) : team.logoUrl,
    memberCount: team.members.length,
    capacity: team.capacity,
    competitionCount: team.competitionEntries.length,
    leaderboardRank,
    leaderboardTotalPoints,
    isSuspended: team.isSuspended,
    members,
    competitions: team.competitionEntries.map((entry) => ({
      id: entry.teamCompetition.id,
      titleFa: entry.teamCompetition.titleFa,
      stage: entry.teamCompetition.stage,
      rankingScore: entry.rankingScore,
    })),
    medals,
  };
}

async function countRecentMembershipRequests(userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.teamMembershipRequest.count({
    where: { userId, createdAt: { gte: since } },
  });
}

export async function getMembershipRequestPreview(userId: string) {
  const recentCount = await countRecentMembershipRequests(userId);
  const requiresFee = recentCount >= MEMBERSHIP_REQUEST_FREE_WEEKLY;
  return {
    recentCount,
    freeRemaining: Math.max(0, MEMBERSHIP_REQUEST_FREE_WEEKLY - recentCount),
    requiresFee,
    feeCoins: requiresFee ? MEMBERSHIP_REQUEST_EXTRA_FEE : 0,
  };
}

export async function createMembershipRequest(userId: string, teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team) throw new Error("تیم یافت نشد");
  if (team.isSuspended) throw new Error("این تیم تعلیق شده است");
  if (team.members.some((m) => m.userId === userId)) {
    throw new Error("شما عضو این تیم هستید");
  }

  const foreignMembership = await getForeignTeamMembership(userId, teamId);
  if (foreignMembership) {
    throw new TeamMembershipConflictError(
      foreignMembership.team.id,
      foreignMembership.team.name,
      false,
    );
  }

  const pending = await prisma.teamMembershipRequest.findFirst({
    where: { teamId, userId, status: "PENDING" },
  });
  if (pending) throw new Error("درخواست شما قبلاً ارسال شده");

  const recentCount = await countRecentMembershipRequests(userId);
  let feeCoins = 0;
  if (recentCount >= MEMBERSHIP_REQUEST_FREE_WEEKLY) {
    feeCoins = MEMBERSHIP_REQUEST_EXTRA_FEE;
  }

  if (feeCoins > 0) {
    await assertFootballCreditConfirmationSatisfied(userId, feeCoins);
  }

  const { consumeEnergy } = await import("@/server/services/energy-service");
  await consumeEnergy(userId, "TEAM_JOIN_REQUEST");

  if (feeCoins > 0) {
    await deductCoins(userId, feeCoins, `هزینه درخواست عضویت در تیم ${team.name}`);
  }

  const request = await prisma.teamMembershipRequest.create({
    data: { teamId, userId, feeCoins },
  });

  const copy = TEAM_COMP_NOTIFICATION_COPY.membershipRequestOwner(team.name);
  await createNotification({
    userId: team.ownerId,
    type: NotificationType.COMPETITION,
    category: NotificationCategory.MESSAGE,
    titleFa: copy.titleFa,
    bodyFa: copy.bodyFa,
    link: `/profile/teams/${teamId}`,
    secondaryLink: `/profile/teams/${teamId}`,
    secondaryLinkLabelFa: "نشانم بده",
  });

  return { request, teamName: team.name, feeCoins };
}

export async function listPendingMembershipRequests(teamId: string, ownerId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.ownerId !== ownerId) throw new Error("دسترسی ندارید");

  const requests = await prisma.teamMembershipRequest.findMany({
    where: { teamId, status: "PENDING" },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          profile: { select: { displayName: true, globalRank: true, totalXp: true, showcaseSlug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: displayName(r.user),
    showcaseSlug: r.user.profile?.showcaseSlug ?? null,
    globalRank: r.user.profile?.globalRank ?? null,
    totalXp: r.user.profile?.totalXp ?? 0,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function respondToMembershipRequest(
  requestId: string,
  ownerId: string,
  accept: boolean,
) {
  const request = await prisma.teamMembershipRequest.findUnique({
    where: { id: requestId },
    include: { team: true, user: { ...userPublicInclude } },
  });
  if (!request || request.team.ownerId !== ownerId) throw new Error("درخواست یافت نشد");
  if (request.status !== "PENDING") throw new Error("این درخواست قبلاً بررسی شده");

  if (accept) {
    const memberCount = await prisma.teamMember.count({ where: { teamId: request.teamId } });
    if (memberCount >= request.team.capacity) {
      throw new Error("ظرفیت تیم شما تکمیل شده!");
    }

    await prisma.$transaction(async (tx) => {
      await tx.teamMembershipRequest.update({
        where: { id: requestId },
        data: { status: "ACCEPTED" },
      });
      await tx.teamMember.create({
        data: { teamId: request.teamId, userId: request.userId, role: "MEMBER" },
      });
    });
    const copy = TEAM_COMP_NOTIFICATION_COPY.membershipAccepted(request.team.name);
    await createNotification({
      userId: request.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: copy.titleFa,
      bodyFa: copy.bodyFa,
      link: `/profile/teams/${request.teamId}`,
      secondaryLink: `/profile/teams/${request.teamId}`,
      secondaryLinkLabelFa: "نشانم بده",
    });
    await notifyTeamOwnerMemberJoined(request.teamId, request.userId);
    return { accepted: true };
  }

  await prisma.teamMembershipRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  });
  const copy = TEAM_COMP_NOTIFICATION_COPY.membershipRejected(request.team.name);
  await createNotification({
    userId: request.userId,
    type: NotificationType.COMPETITION,
    category: NotificationCategory.MESSAGE,
    titleFa: copy.titleFa,
    bodyFa: copy.bodyFa,
  });
  return { accepted: false };
}

export async function countPendingRequestsForOwner(ownerId: string) {
  const teams = await prisma.team.findMany({
    where: { ownerId },
    select: { id: true },
  });
  if (teams.length === 0) return 0;
  return prisma.teamMembershipRequest.count({
    where: { teamId: { in: teams.map((t) => t.id) }, status: "PENDING" },
  });
}
