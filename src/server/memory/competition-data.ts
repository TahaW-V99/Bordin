import { COIN_PACKAGES, LEVELS } from "@/shared/constants/reward-tables";
import { MEDAL_CATALOG } from "@/shared/constants/medals";
import { WHEEL_REWARD_OPTIONS } from "@/shared/constants/wheel";

export function createCompetitionSeedData() {
  const now = new Date();
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const in5d = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const in10d = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
  const regDeadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const levels = LEVELS.map((l) => ({
    id: `level-${l.rank}`,
    ...l,
  }));

  const cups = [
    {
      id: "cup-1",
      titleFa: "جام الکلاسیکو",
      description: "رئال مادرید در برابر بارسلونا — جام ویژه بُردین",
      mode: "NORMAL" as const,
      matchId: "match-2",
      entryFeeCoins: 800,
      rewardTableSlug: "cup-normal",
      registrationDeadline: regDeadline,
      startsAt: now,
      endsAt: in5d,
      isPublished: true,
      bannerUrl: null,
      match: {
        id: "match-2",
        homeTeamName: "رئال مادرید",
        awayTeamName: "بارسلونا",
        leagueName: "لالیگا",
        kickoffAt: in2h,
        homeScore: null,
        awayScore: null,
        status: "SCHEDULED",
      },
    },
    {
      id: "cup-2",
      titleFa: "جام افسانه الکلاسیکو",
      description: "حالت افسانه — پاداش‌های بزرگ‌تر و مدال‌های نادر",
      mode: "LEGEND" as const,
      matchId: "match-2",
      entryFeeCoins: 1100,
      rewardTableSlug: "cup-legend",
      registrationDeadline: regDeadline,
      startsAt: now,
      endsAt: in5d,
      isPublished: true,
      bannerUrl: null,
      match: {
        id: "match-2",
        homeTeamName: "رئال مادرید",
        awayTeamName: "بارسلونا",
        leagueName: "لالیگا",
        kickoffAt: in2h,
        homeScore: null,
        awayScore: null,
        status: "SCHEDULED",
      },
    },
  ];

  const tournaments = [
    {
      id: "tournament-fath",
      slug: "fath",
      nameFa: "فتح",
      description: "تورنمنت فصلانه بُردین — رقابت برای جایگاه برتر",
      registrationFeeCoins: 200,
      predictionFeeCoins: 600,
      rewardTableSlug: "tournament-fath",
      registrationDeadline: in10d,
      startsAt: now,
      endsAt: in10d,
      pointsMultiplier: 2,
      isPublished: true,
      bannerUrl: null,
      matches: [
        {
          id: "tm-1",
          matchId: "match-1",
          match: {
            id: "match-1",
            homeTeamName: "پرسپولیس",
            awayTeamName: "استقلال",
            leagueName: "لیگ برتر ایران",
            kickoffAt: in2h,
            homeScore: null,
            awayScore: null,
            status: "SCHEDULED",
          },
        },
        {
          id: "tm-2",
          matchId: "match-2",
          match: {
            id: "match-2",
            homeTeamName: "رئال مادرید",
            awayTeamName: "بارسلونا",
            leagueName: "لالیگا",
            kickoffAt: in2h,
            homeScore: null,
            awayScore: null,
            status: "SCHEDULED",
          },
        },
      ],
    },
  ];

  const teamCompetitions = [
    {
      id: "tc-1",
      titleFa: "جام قهرمانان تیمی",
      description: "تیم بساز، با هم پیش‌بینی کنید و قهرمان شوید",
      minTeamSize: 3,
      registrationDeadline: in10d,
      rankingEndsAt: in5d,
      knockoutEndsAt: in10d,
      winnerCoinReward: 8000,
      runnerUpCoinReward: 5000,
      isPublished: true,
      stage: "RANKING",
      bannerUrl: null,
    },
  ];

  const medals = MEDAL_CATALOG.map((medal, index) => ({
    id: `medal-${index + 1}`,
    slug: medal.slug,
    titleFa: medal.titleFa,
    tier: medal.tier,
    category: medal.category,
  }));

  const missions = [
    {
      id: "mission-1",
      slug: "sheykarchee",
      titleFa: "ماموریت شکارچی",
      description: "۱۰ پیش‌بینی با دقت بالا انجام دهید",
      targetCount: 10,
      tier: "BRONZE",
      medalSlug: "sheykarchee-bronze",
    },
    {
      id: "mission-2",
      slug: "vafadar",
      titleFa: "ماموریت وفادار",
      description: "۳۰ روز پیش‌بینی کنید",
      targetCount: 30,
      tier: "BRONZE",
      medalSlug: "vafadar-bronze",
    },
  ];

  return {
    levels,
    cups,
    tournaments,
    teamCompetitions,
    medals,
    missions,
    coinPackages: COIN_PACKAGES,
    wheelRewards: WHEEL_REWARD_OPTIONS.map((option, i) => ({
      id: `wheel-${i}`,
      coins: option.amount,
      weight: option.weight,
      tickets: option.tickets ? [...option.tickets] : [],
    })),
    cupEntries: [] as Array<{ id: string; cupId: string; userId: string; status: string }>,
    tournamentEntries: [] as Array<{
      id: string;
      tournamentId: string;
      userId: string;
      status: string;
      totalPoints: number;
    }>,
    teamCompetitionEntries: [] as Array<{
      id: string;
      teamCompetitionId: string;
      teamId: string;
      rankingScore: number;
    }>,
    teams: [] as Array<{
      id: string;
      name: string;
      logoUrl: string | null;
      ownerId: string;
      members: Array<{ userId: string; role: string }>;
    }>,
    userMedals: [] as Array<{
      id: string;
      userId: string;
      medalId: string;
      earnedReason: string;
      earnedAt: Date;
    }>,
    missionProgress: [] as Array<{
      userId: string;
      missionId: string;
      currentCount: number;
      completedAt: Date | null;
    }>,
    missionTierClaims: [] as Array<{
      userId: string;
      missionSlug: string;
      tierKey: string;
      claimedAt: Date;
    }>,
    wheelSpins: [] as Array<{
      userId: string;
      spunAt: Date;
      coinsWon: number;
      coinsCostApplied: number;
    }>,
    invites: [] as Array<{ inviterId: string; inviteeId: string; rewarded: boolean }>,
    notifications: [] as Array<{
      id: string;
      userId: string;
      titleFa: string;
      bodyFa: string;
      isRead: boolean;
      createdAt: Date;
    }>,
    transactions: [] as Array<{
      id: string;
      userId: string;
      type: string;
      amount: number;
      description: string;
      createdAt: Date;
    }>,
  };
}
