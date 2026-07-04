import {
  CoinTransactionType,
  NotificationCategory,
  NotificationType,
  TeamCompetitionFeeCoverReason,
  TeamCompetitionMedalPlacement,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { addSystemRewardCoins } from "@/server/services/wallet-service";
import { createNotification } from "@/server/services/notification-service";
import { TEAM_COMP_NOTIFICATION_COPY } from "@/shared/constants/team-competition-user";
import { buildPlacementNotificationBody } from "@/shared/lib/team-competition-placement-notification";

const PRIZE_EXCLUSION_COVER_COUNT = 4;

export async function isMemberPrizeExcluded(
  teamCompetitionId: string,
  userId: string,
): Promise<boolean> {
  const count = await prisma.teamCompetitionFeeCover.count({
    where: {
      teamCompetitionId,
      coveredUserId: userId,
      reason: TeamCompetitionFeeCoverReason.PREDICTION,
    },
  });
  return count >= PRIZE_EXCLUSION_COVER_COUNT;
}

export async function distributeTeamCompetitionRewards(teamCompetitionId: string) {
  if (await shouldUseMemoryDb()) return { distributed: false };

  const comp = await prisma.teamCompetition.findUnique({
    where: { id: teamCompetitionId },
    include: {
      medalRewards: { include: { medal: true } },
    },
  });
  if (!comp || comp.rewardsDistributedAt) return { distributed: false };
  if (!comp.winnerEntryId || !comp.runnerUpEntryId) return { distributed: false };

  const winnerEntry = await prisma.teamCompetitionEntry.findUnique({
    where: { id: comp.winnerEntryId },
    include: { team: { include: { members: true } } },
  });
  const runnerEntry = await prisma.teamCompetitionEntry.findUnique({
    where: { id: comp.runnerUpEntryId },
    include: { team: { include: { members: true } } },
  });
  if (!winnerEntry || !runnerEntry) return { distributed: false };

  const winnerMedals = comp.medalRewards.filter((m) => m.placement === TeamCompetitionMedalPlacement.WINNER);
  const runnerMedals = comp.medalRewards.filter((m) => m.placement === TeamCompetitionMedalPlacement.RUNNER_UP);
  const championCopy = TEAM_COMP_NOTIFICATION_COPY.placementChampion(comp.titleFa);
  const runnerUpCopy = TEAM_COMP_NOTIFICATION_COPY.placementRunnerUp(comp.titleFa);
  const championRewardsBody = buildPlacementNotificationBody(championCopy.bodyFa, {
    coinsPerMember: comp.winnerCoinReward,
    medalTitles: winnerMedals.map((medal) => medal.medal.titleFa),
    trophy: "gold",
  });
  const runnerUpRewardsBody = buildPlacementNotificationBody(runnerUpCopy.bodyFa, {
    coinsPerMember: comp.runnerUpCoinReward,
    medalTitles: runnerMedals.map((medal) => medal.medal.titleFa),
    trophy: "silver",
  });

  for (const member of winnerEntry.team.members) {
    const excluded = await isMemberPrizeExcluded(teamCompetitionId, member.userId);
    if (!excluded && comp.winnerCoinReward > 0) {
      await addSystemRewardCoins(
        member.userId,
        comp.winnerCoinReward,
        CoinTransactionType.TEAM_COMPETITION_REWARD,
        `جایزه قهرمانی رقابت تیمی ${comp.titleFa}`,
      );
    }
    if (!excluded) {
      for (const mr of winnerMedals) {
        await awardPlacementMedal(member.userId, mr.medalId, comp.titleFa, "قهرمان");
      }
    }
    await createNotification({
      userId: member.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: championCopy.titleFa,
      bodyFa: championRewardsBody,
      link: `/competitions/teams/${comp.id}?tab=knockout`,
      secondaryLink: `/competitions/teams/${comp.id}?tab=knockout`,
      secondaryLinkLabelFa: "نشونم بده",
    });
  }

  for (const member of runnerEntry.team.members) {
    const excluded = await isMemberPrizeExcluded(teamCompetitionId, member.userId);
    if (!excluded && comp.runnerUpCoinReward > 0) {
      await addSystemRewardCoins(
        member.userId,
        comp.runnerUpCoinReward,
        CoinTransactionType.TEAM_COMPETITION_REWARD,
        `جایزه نایب قهرمانی رقابت تیمی ${comp.titleFa}`,
      );
    }
    if (!excluded) {
      for (const mr of runnerMedals) {
        await awardPlacementMedal(member.userId, mr.medalId, comp.titleFa, "نایب قهرمان");
      }
    }
    await createNotification({
      userId: member.userId,
      type: NotificationType.COMPETITION,
      category: NotificationCategory.MESSAGE,
      titleFa: runnerUpCopy.titleFa,
      bodyFa: runnerUpRewardsBody,
      link: `/competitions/teams/${comp.id}?tab=knockout`,
      secondaryLink: `/competitions/teams/${comp.id}?tab=knockout`,
      secondaryLinkLabelFa: "نشونم بده",
    });
  }

  await prisma.teamCompetition.update({
    where: { id: teamCompetitionId },
    data: { rewardsDistributedAt: new Date() },
  });

  const { syncTeamLeaderboardRanks } = await import(
    "@/server/services/team-leaderboard-rank-service"
  );
  await syncTeamLeaderboardRanks();

  return { distributed: true };
}

async function awardPlacementMedal(
  userId: string,
  medalId: string,
  compTitle: string,
  placement: string,
) {
  try {
    await prisma.userMedal.create({
      data: {
        userId,
        medalId,
        earnedReason: `${placement} رقابت تیمی ${compTitle}`,
      },
    });
  } catch {
    // duplicate
  }
}
