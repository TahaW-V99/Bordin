import { NotificationCategory, NotificationType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { createNotification } from "@/server/services/notification-service";
import { buildGlobalTeamLeaderboardRows } from "@/server/services/team-leaderboard-service";

const TEAM_LEADERBOARD_LINK = "/leaderboard?tab=teams";

function teamLeaderboardNotificationCopy(teamName: string, newRank: number) {
  if (newRank === 1) {
    return {
      titleFa: "صدر جدول تیم‌ها",
      bodyFa: `خبر داری؟! تیم شما ${teamName} در صدر جدول کل تیم‌های بُردین قرار گرفته! این واقعا عالیه. حواست باشه که جایگاه تیمت رو از دست ندی!`,
    };
  }
  if (newRank === 2) {
    return {
      titleFa: "رتبه دوم لیدر برد تیم‌ها",
      bodyFa: `بی نظریه! تیم شما ${teamName} فقط یک قدم با رتبه نخست جدول تیم‌ها قرار داره! برای رسیدن به افتخار اول شدن، همینطوری ادامه بده`,
    };
  }
  if (newRank === 3) {
    return {
      titleFa: "رتبه سوم لیدر برد تیم‌ها",
      bodyFa: `به این میگن یک پیشرفت اساسی! تیم شما ${teamName} الان جزو ۳ تیم برتر در بُردین هست! دست از تلاش برندار. راه زیادی رو برای قهرمانی تیمت طی کردی!`,
    };
  }
  return {
    titleFa: "ارتقای رتبه لیدر برد تیم‌ها",
    bodyFa: `تبریک میگم! تیم شما ${teamName} در لیدر بورد جایگاه بالاتری کسب کرده`,
  };
}

async function notifyTeamLeaderboardRankUp(
  userId: string,
  teamName: string,
  newRank: number,
) {
  const copy = teamLeaderboardNotificationCopy(teamName, newRank);
  await createNotification({
    userId,
    type: NotificationType.TEAM_LEADERBOARD_RANK_UP,
    category: NotificationCategory.MESSAGE,
    titleFa: copy.titleFa,
    bodyFa: copy.bodyFa,
    link: TEAM_LEADERBOARD_LINK,
    secondaryLink: TEAM_LEADERBOARD_LINK,
    secondaryLinkLabelFa: "نشانم بده",
  });
}

async function notifyTeamMembersOfRankUp(teamId: string, teamName: string, newRank: number) {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });

  for (const member of members) {
    await notifyTeamLeaderboardRankUp(member.userId, teamName, newRank);
  }
}

/** بعد از تغییر امتیاز، رتبه همه تیم‌های لیدر برد را همگام و در صورت ارتقا اعلان بفرست. */
export async function syncTeamLeaderboardRanks() {
  if (await shouldUseMemoryDb()) return;

  const rows = await buildGlobalTeamLeaderboardRows();
  const teams = await prisma.team.findMany({
    where: { id: { in: rows.map((row) => row.teamId) } },
    select: { id: true, name: true, leaderboardRank: true },
  });
  const teamById = new Map(teams.map((team) => [team.id, team]));

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    const newRank = index + 1;
    const team = teamById.get(row.teamId);
    if (!team) continue;

    const previousRank = team.leaderboardRank;
    await prisma.team.update({
      where: { id: row.teamId },
      data: { leaderboardRank: newRank },
    });

    if (previousRank !== null && newRank < previousRank) {
      await notifyTeamMembersOfRankUp(row.teamId, row.teamName, newRank);
    }
  }
}

/** بعد از تغییر امتیاز، رتبه جهانی را به‌روز و در صورت ارتقا اعلان بفرست. */
export async function refreshTeamLeaderboardRank(teamId: string) {
  if (await shouldUseMemoryDb()) return null;
  await syncTeamLeaderboardRanks();
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { leaderboardRank: true },
  });
  return team?.leaderboardRank ?? null;
}

export async function refreshTeamLeaderboardRanks(_teamIds: string[]) {
  await syncTeamLeaderboardRanks();
}
