import { NotificationType, NotificationCategory } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { createNotification } from "@/server/services/notification-service";
import { TEAM_SUSPENSION_NOTIFICATION } from "@/shared/constants/team-competitions";

const userPublicSelect = {
  id: true,
  username: true,
  profile: { select: { displayName: true } },
} as const;

function displayNameFromUser(user: {
  username: string | null;
  profile: { displayName: string | null } | null;
}) {
  return user.profile?.displayName ?? user.username ?? null;
}

export async function listAdminTeams() {
  if (await shouldUseMemoryDb()) {
    return [];
  }

  const teams = await prisma.team.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      members: {
        include: {
          user: { select: userPublicSelect },
        },
      },
      _count: { select: { members: true, competitionEntries: true } },
    },
  });

  const ownerIds = [...new Set(teams.map((t) => t.ownerId))];
  const owners = await prisma.user.findMany({
    where: { id: { in: ownerIds } },
    select: userPublicSelect,
  });
  const ownerById = new Map(owners.map((o) => [o.id, o]));

  return teams.map((team) => {
    const owner = ownerById.get(team.ownerId);
    return {
      id: team.id,
      name: team.name,
      logoUrl: team.logoUrl,
      isSuspended: team.isSuspended,
      suspendedAt: team.suspendedAt?.toISOString() ?? null,
      owner: {
        id: team.ownerId,
        username: owner?.username ?? null,
        displayName: owner ? displayNameFromUser(owner) : null,
      },
      memberCount: team._count.members,
      competitionCount: team._count.competitionEntries,
      updatedAt: team.updatedAt.toISOString(),
    };
  });
}

export async function getAdminTeamDetail(teamId: string) {
  if (await shouldUseMemoryDb()) {
    throw new Error("تیم یافت نشد");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: {
            select: {
              ...userPublicSelect,
              userMedals: {
                include: { medal: true },
                orderBy: { earnedAt: "desc" },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      competitionEntries: {
        include: {
          teamCompetition: {
            select: {
              id: true,
              titleFa: true,
              stage: true,
              isPublished: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!team) throw new Error("تیم یافت نشد");

  const ownerUser = await prisma.user.findUnique({
    where: { id: team.ownerId },
    select: userPublicSelect,
  });

  const owner = ownerUser
    ? {
        id: ownerUser.id,
        username: ownerUser.username,
        displayName: displayNameFromUser(ownerUser),
      }
    : null;

  const honors = team.members.flatMap((member) =>
    member.user.userMedals
      .filter((um) => um.medal.category === "TEAM" || um.medal.category === "ACHIEVEMENT")
      .map((um) => ({
        id: um.id,
        medalId: um.medalId,
        titleFa: um.medal.titleFa,
        slug: um.medal.slug,
        tier: um.medal.tier,
        earnedAt: um.earnedAt.toISOString(),
        memberName: displayNameFromUser(member.user),
      })),
  );

  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    isSuspended: team.isSuspended,
    suspendedAt: team.suspendedAt?.toISOString() ?? null,
    owner,
    members: team.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user.id,
        username: m.user.username,
        displayName: displayNameFromUser(m.user),
      },
    })),
    honors,
    competitions: team.competitionEntries.map((e) => ({
      id: e.id,
      competitionId: e.teamCompetitionId,
      titleFa: e.teamCompetition.titleFa,
      stage: e.teamCompetition.stage,
      isPublished: e.teamCompetition.isPublished,
      rankingScore: e.rankingScore,
      isEliminated: e.isEliminated,
      joinedAt: e.createdAt.toISOString(),
    })),
    competitionCount: team.competitionEntries.length,
    updatedAt: team.updatedAt.toISOString(),
  };
}

async function notifyTeamMembers(teamId: string, suspended: boolean) {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  const copy = suspended
    ? TEAM_SUSPENSION_NOTIFICATION.suspended
    : TEAM_SUSPENSION_NOTIFICATION.unsuspended;

  await Promise.all(
    members.map((m) =>
      createNotification({
        userId: m.userId,
        type: NotificationType.SYSTEM,
        category: NotificationCategory.MESSAGE,
        titleFa: copy.titleFa,
        bodyFa: copy.bodyFa,
        link: "/profile/teams",
      }),
    ),
  );
}

export async function setTeamSuspended(teamId: string, suspended: boolean) {
  if (await shouldUseMemoryDb()) {
    throw new Error("تیم یافت نشد");
  }

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("تیم یافت نشد");
  if (team.isSuspended === suspended) {
    return { id: team.id, isSuspended: team.isSuspended };
  }

  const updated = await prisma.team.update({
    where: { id: teamId },
    data: {
      isSuspended: suspended,
      suspendedAt: suspended ? new Date() : null,
    },
  });

  await notifyTeamMembers(teamId, suspended);

  return {
    id: updated.id,
    isSuspended: updated.isSuspended,
    suspendedAt: updated.suspendedAt?.toISOString() ?? null,
  };
}
