import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

export const OWNER_ALREADY_IN_THIS_COMP_FA =
  "شما قبلاً یکی از تیم‌های خود را در این رقابت ثبت‌نام کرده‌اید";

export const TEAM_MEMBER_ALREADY_IN_COMP_FA =
  "یکی از اعضای این تیم قبلاً از طریق تیم دیگری در این رقابت ثبت‌نام کرده است";

export function ownerAlreadyInOtherCompFa(competitionTitle: string) {
  return `شما قبلاً در رقابت «${competitionTitle}» ثبت‌نام کرده‌اید و نمی‌توانید در رقابت دیگری شرکت کنید`;
}

export type OwnerRegistrationBlock = {
  registeredTeamIdInThisComp: string | null;
  blockedByCompetition: { id: string; titleFa: string } | null;
};

export async function getOwnerRegistrationBlock(
  userId: string,
  competitionId: string,
): Promise<OwnerRegistrationBlock> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.getOwnerRegistrationBlock(userId, competitionId);
  }

  const ownerTeams = await prisma.team.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const ownerTeamIds = ownerTeams.map((t) => t.id);
  if (ownerTeamIds.length === 0) {
    return { registeredTeamIdInThisComp: null, blockedByCompetition: null };
  }

  const entries = await prisma.teamCompetitionEntry.findMany({
    where: { teamId: { in: ownerTeamIds } },
    include: { teamCompetition: { select: { id: true, titleFa: true, stage: true } } },
  });

  const inThis = entries.find((e) => e.teamCompetitionId === competitionId);

  return {
    registeredTeamIdInThisComp: inThis?.teamId ?? null,
    blockedByCompetition: null,
  };
}

export async function assertOwnerTeamCompetitionRegistrationAllowed(
  userId: string,
  competitionId: string,
  teamId: string,
) {
  const block = await getOwnerRegistrationBlock(userId, competitionId);

  if (
    block.registeredTeamIdInThisComp &&
    block.registeredTeamIdInThisComp !== teamId
  ) {
    throw new Error(OWNER_ALREADY_IN_THIS_COMP_FA);
  }
}

/** Teams that cannot register because a member already participates via another team in the same competition. */
export async function findTeamsWithMemberCompetitionConflict(
  competitionId: string,
  teamIds: string[],
): Promise<Set<string>> {
  if (teamIds.length === 0) return new Set();

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.findTeamsWithMemberCompetitionConflict(
      competitionId,
      teamIds,
    );
  }

  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, members: { select: { userId: true } } },
  });

  const entries = await prisma.teamCompetitionEntry.findMany({
    where: { teamCompetitionId: competitionId },
    select: {
      teamId: true,
      team: { select: { members: { select: { userId: true } } } },
    },
  });

  const registeredUserToTeamId = new Map<string, string>();
  for (const entry of entries) {
    for (const member of entry.team.members) {
      registeredUserToTeamId.set(member.userId, entry.teamId);
    }
  }

  const blocked = new Set<string>();
  for (const team of teams) {
    for (const member of team.members) {
      const otherTeamId = registeredUserToTeamId.get(member.userId);
      if (otherTeamId && otherTeamId !== team.id) {
        blocked.add(team.id);
        break;
      }
    }
  }

  return blocked;
}

export async function assertTeamMembersNotAlreadyInCompetition(
  competitionId: string,
  teamId: string,
) {
  const blocked = await findTeamsWithMemberCompetitionConflict(competitionId, [teamId]);
  if (blocked.has(teamId)) {
    throw new Error(TEAM_MEMBER_ALREADY_IN_COMP_FA);
  }
}

export async function assertTeamCompetitionRegistrationAllowed(
  userId: string,
  competitionId: string,
  teamId: string,
) {
  await assertOwnerTeamCompetitionRegistrationAllowed(userId, competitionId, teamId);
  await assertTeamMembersNotAlreadyInCompetition(competitionId, teamId);
}
