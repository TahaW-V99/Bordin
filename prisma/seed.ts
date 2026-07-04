import { PrismaClient, AdminConfigKey, MedalTier, MedalCategory, CompetitionType, CupMode } from "@prisma/client";
import { WHEEL_REWARD_OPTIONS } from "../src/shared/constants/wheel";

const prisma = new PrismaClient();

const LEVELS = [
  { rank: 1, nameFa: "تماشاگر", xpThreshold: 50, rewardCoins: 0 },
  { rank: 2, nameFa: "هوادار", xpThreshold: 3050, rewardCoins: 100 },
  { rank: 3, nameFa: "نیمکت نشین", xpThreshold: 6550, rewardCoins: 150 },
  { rank: 4, nameFa: "یارکمکی", xpThreshold: 13550, rewardCoins: 200 },
  { rank: 5, nameFa: "بازیخوان", xpThreshold: 28550, rewardCoins: 300 },
  { rank: 6, nameFa: "آقای گل", xpThreshold: 53550, rewardCoins: 400 },
  { rank: 7, nameFa: "کاپتان بُردین", xpThreshold: 88550, rewardCoins: 500 },
  { rank: 8, nameFa: "کمک مربی", xpThreshold: 128550, rewardCoins: 600 },
  { rank: 9, nameFa: "مربی", xpThreshold: 183550, rewardCoins: 800 },
  { rank: 10, nameFa: "اسطوره", xpThreshold: 248550, rewardCoins: 1000 },
  { rank: 11, nameFa: "مرجع", xpThreshold: 328550, rewardCoins: 1500 },
];

const DAILY_REWARD_TIERS = [
  { accuracyPercent: 0, coins: 20, xp: 24 },
  { accuracyPercent: 10, coins: 40, xp: 48 },
  { accuracyPercent: 20, coins: 70, xp: 84 },
  { accuracyPercent: 30, coins: 110, xp: 132 },
  { accuracyPercent: 40, coins: 140, xp: 168 },
  { accuracyPercent: 50, coins: 220, xp: 264 },
  { accuracyPercent: 60, coins: 290, xp: 348 },
  { accuracyPercent: 70, coins: 370, xp: 444 },
  { accuracyPercent: 80, coins: 800, xp: 552 },
  { accuracyPercent: 90, coins: 900, xp: 672 },
  { accuracyPercent: 100, coins: 1200, xp: 900 },
];

const CUP_NORMAL_TIERS = [
  { accuracyPercent: 0, coins: 24, xp: 140 },
  { accuracyPercent: 10, coins: 48, xp: 160 },
  { accuracyPercent: 20, coins: 84, xp: 190 },
  { accuracyPercent: 30, coins: 132, xp: 230 },
  { accuracyPercent: 40, coins: 168, xp: 260 },
  { accuracyPercent: 50, coins: 364, xp: 340 },
  { accuracyPercent: 60, coins: 410, xp: 548, medalSlug: "cup-normal-60" },
  { accuracyPercent: 70, coins: 800, xp: 644, medalSlug: "cup-normal-70" },
  { accuracyPercent: 80, coins: 920, xp: 752, medalSlug: "cup-normal-80" },
  { accuracyPercent: 90, coins: 1020, xp: 872, medalSlug: "cup-normal-90" },
  { accuracyPercent: 100, coins: 1600, xp: 1800, medalSlug: "cup-normal-100" },
];

const CUP_LEGEND_TIERS = [
  { accuracyPercent: 0, coins: 24, xp: 640 },
  { accuracyPercent: 10, coins: 48, xp: 660 },
  { accuracyPercent: 20, coins: 84, xp: 690 },
  { accuracyPercent: 30, coins: 132, xp: 730 },
  { accuracyPercent: 40, coins: 168, xp: 760 },
  { accuracyPercent: 50, coins: 840, xp: 564, medalSlug: "cup-legend-50" },
  { accuracyPercent: 60, coins: 1100, xp: 748, medalSlug: "cup-legend-60" },
  { accuracyPercent: 70, coins: 1300, xp: 844, medalSlug: "cup-legend-70" },
  { accuracyPercent: 80, coins: 1420, xp: 952, medalSlug: "cup-legend-80" },
  { accuracyPercent: 90, coins: 1520, xp: 1072, medalSlug: "cup-legend-90" },
  { accuracyPercent: 100, coins: 2400, xp: 2700, medalSlug: "cup-legend-100" },
];

const TOURNAMENT_TIERS = [
  { accuracyPercent: 0, coins: 48, xp: 20 },
  { accuracyPercent: 10, coins: 96, xp: 40 },
  { accuracyPercent: 20, coins: 168, xp: 70 },
  { accuracyPercent: 30, coins: 264, xp: 110 },
  { accuracyPercent: 40, coins: 336, xp: 140 },
  { accuracyPercent: 50, coins: 528, xp: 220 },
  { accuracyPercent: 60, coins: 696, xp: 290 },
  { accuracyPercent: 70, coins: 888, xp: 370 },
  { accuracyPercent: 80, coins: 1104, xp: 800 },
  { accuracyPercent: 90, coins: 1344, xp: 900 },
  { accuracyPercent: 100, coins: 1800, xp: 1200 },
];

const WHEEL_REWARDS = WHEEL_REWARD_OPTIONS.map((o) => o.amount);

async function seedRewardTable(
  slug: string,
  nameFa: string,
  competitionType: CompetitionType,
  cupMode: CupMode | null,
  tiers: Array<{ accuracyPercent: number; coins: number; xp: number; medalSlug?: string }>,
) {
  const medalMap = new Map(
    (await prisma.medal.findMany()).map((m) => [m.slug, m.id]),
  );

  const table = await prisma.rewardTable.upsert({
    where: { slug },
    update: { nameFa, competitionType, cupMode },
    create: { slug, nameFa, competitionType, cupMode },
  });

  for (const tier of tiers) {
    await prisma.rewardTier.upsert({
      where: {
        rewardTableId_accuracyPercent: {
          rewardTableId: table.id,
          accuracyPercent: tier.accuracyPercent,
        },
      },
      update: {
        coins: tier.coins,
        xp: tier.xp,
        medalId: tier.medalSlug ? medalMap.get(tier.medalSlug) ?? null : null,
      },
      create: {
        rewardTableId: table.id,
        accuracyPercent: tier.accuracyPercent,
        coins: tier.coins,
        xp: tier.xp,
        medalId: tier.medalSlug ? medalMap.get(tier.medalSlug) ?? null : null,
      },
    });
  }

  return table;
}

async function main() {
  for (const level of LEVELS) {
    await prisma.level.upsert({
      where: { rank: level.rank },
      update: level,
      create: level,
    });
  }

  const medalDefs = [
    { slug: "sheykarchee-bronze", titleFa: "شکارچی", tier: MedalTier.BRONZE, category: MedalCategory.MISSION },
    { slug: "sheykarchee-silver", titleFa: "شکارچی", tier: MedalTier.SILVER, category: MedalCategory.MISSION },
    { slug: "sheykarchee-gold", titleFa: "شکارچی", tier: MedalTier.GOLD, category: MedalCategory.MISSION },
    { slug: "sheykarchee-dark", titleFa: "شکارچی", tier: MedalTier.DARK_PURPLE, category: MedalCategory.MISSION },
    { slug: "vafadar-bronze", titleFa: "وفادار", tier: MedalTier.BRONZE, category: MedalCategory.MISSION },
    { slug: "vafadar-silver", titleFa: "وفادار", tier: MedalTier.SILVER, category: MedalCategory.MISSION },
    { slug: "vafadar-gold", titleFa: "وفادار", tier: MedalTier.GOLD, category: MedalCategory.MISSION },
    { slug: "vafadar-dark", titleFa: "وفادار", tier: MedalTier.DARK_PURPLE, category: MedalCategory.MISSION },
    { slug: "cup-normal-60", titleFa: "مهاجم", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-normal-70", titleFa: "گلزن", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-normal-80", titleFa: "ستاره", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-normal-90", titleFa: "آذرخش", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-normal-100", titleFa: "فاتح", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-legend-50", titleFa: "سایه", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-legend-60", titleFa: "کمین", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-legend-70", titleFa: "طوفان", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-legend-80", titleFa: "شکار", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-legend-90", titleFa: "تاج", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "cup-legend-100", titleFa: "اسطوره", tier: MedalTier.SPECIAL, category: MedalCategory.CUP },
    { slug: "tournament-fateh", titleFa: "فاتح", tier: MedalTier.SPECIAL, category: MedalCategory.TOURNAMENT },
    { slug: "tournament-pirooz", titleFa: "پیروز", tier: MedalTier.SPECIAL, category: MedalCategory.TOURNAMENT },
    { slug: "tournament-pishro", titleFa: "پیشرو", tier: MedalTier.SPECIAL, category: MedalCategory.TOURNAMENT },
    { slug: "team-qahraman", titleFa: "قهرمان", tier: MedalTier.SPECIAL, category: MedalCategory.TEAM },
    { slug: "team-raqib", titleFa: "رقیب", tier: MedalTier.SPECIAL, category: MedalCategory.TEAM },
  ];

  for (const medal of medalDefs) {
    const iconUrl = `/images/medals/${medal.slug}.png`;
    await prisma.medal.upsert({
      where: { slug: medal.slug },
      update: { ...medal, iconUrl },
      create: { ...medal, description: `مدال ${medal.titleFa}`, iconUrl },
    });
  }

  await seedRewardTable("daily-prediction", "پیش‌بینی روزانه", CompetitionType.DAILY, null, DAILY_REWARD_TIERS);
  await seedRewardTable("cup-normal", "جام عادی", CompetitionType.CUP, CupMode.NORMAL, CUP_NORMAL_TIERS);
  await seedRewardTable("cup-legend", "جام افسانه", CompetitionType.CUP, CupMode.LEGEND, CUP_LEGEND_TIERS);
  await seedRewardTable("tournament-fath", "تورنمنت فتح", CompetitionType.TOURNAMENT, null, TOURNAMENT_TIERS);

  const configs: Array<{ key: AdminConfigKey; value: unknown }> = [
    { key: AdminConfigKey.SIGNUP_BONUS_COINS, value: 900 },
    { key: AdminConfigKey.DAILY_PREDICTION_COST, value: 600 },
    { key: AdminConfigKey.WHEEL_ENABLED, value: true },
    { key: AdminConfigKey.WHEEL_COOLDOWN_HOURS, value: 24 },
    { key: AdminConfigKey.INVITE_MAX_FRIENDS, value: 10 },
    { key: AdminConfigKey.INVITE_COIN_REWARD, value: 50 },
    { key: AdminConfigKey.INVITE_XP_REWARD, value: 100 },
    { key: AdminConfigKey.MIN_TEAM_SIZE, value: 3 },
  ];

  for (const config of configs) {
    await prisma.adminConfig.upsert({
      where: { key: config.key },
      update: { value: config.value as object },
      create: { key: config.key, value: config.value as object },
    });
  }

  await prisma.wheelRewardOption.deleteMany();
  for (let i = 0; i < WHEEL_REWARD_OPTIONS.length; i++) {
    const option = WHEEL_REWARD_OPTIONS[i];
    await prisma.wheelRewardOption.create({
      data: { coins: option.amount, weight: option.weight, sortOrder: i },
    });
  }

  await prisma.mission.upsert({
    where: { slug: "sheykarchee" },
    update: {},
    create: {
      slug: "sheykarchee",
      titleFa: "ماموریت شکارچی",
      description: "پیش‌بینی‌های دقیق انجام دهید و مدال شکارچی جمع کنید.",
      medalSlug: "sheykarchee-bronze",
      targetCount: 10,
      tier: MedalTier.BRONZE,
      sortOrder: 1,
    },
  });

  await prisma.mission.upsert({
    where: { slug: "vafadar" },
    update: {},
    create: {
      slug: "vafadar",
      titleFa: "ماموریت وفادار",
      description: "هر روز پیش‌بینی کنید و وفاداری خود را نشان دهید.",
      medalSlug: "vafadar-bronze",
      targetCount: 30,
      tier: MedalTier.BRONZE,
      sortOrder: 2,
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const kickoff1 = new Date();
  kickoff1.setHours(kickoff1.getHours() + 4, 0, 0, 0);
  const kickoff2 = new Date();
  kickoff2.setHours(kickoff2.getHours() + 6, 30, 0, 0);
  const kickoff3 = new Date();
  kickoff3.setDate(kickoff3.getDate() + 1);
  kickoff3.setHours(20, 0, 0, 0);

  const matches = await Promise.all([
    prisma.footballMatch.upsert({
      where: { externalId: "demo-1" },
      update: {},
      create: {
        externalId: "demo-1",
        homeTeamName: "پرسپولیس",
        awayTeamName: "استقلال",
        leagueName: "لیگ برتر ایران",
        kickoffAt: kickoff1,
      },
    }),
    prisma.footballMatch.upsert({
      where: { externalId: "demo-2" },
      update: {},
      create: {
        externalId: "demo-2",
        homeTeamName: "رئال مادرید",
        awayTeamName: "بارسلونا",
        leagueName: "لالیگا",
        kickoffAt: kickoff2,
      },
    }),
    prisma.footballMatch.upsert({
      where: { externalId: "demo-3" },
      update: {},
      create: {
        externalId: "demo-3",
        homeTeamName: "منچسترسیتی",
        awayTeamName: "لیورپول",
        leagueName: "لیگ برتر انگلیس",
        kickoffAt: kickoff3,
      },
    }),
  ]);

  const kandakator = await prisma.dailyKandakator.upsert({
    where: { date: today },
    update: { isPublished: true, title: "کنداکتور امروز" },
    create: {
      date: today,
      title: "کنداکتور امروز",
      isPublished: true,
      entryFeeCoins: 600,
    },
  });

  for (let i = 0; i < matches.length; i++) {
    await prisma.kandakatorMatch.upsert({
      where: {
        kandakatorId_matchId: { kandakatorId: kandakator.id, matchId: matches[i].id },
      },
      update: { sortOrder: i },
      create: {
        kandakatorId: kandakator.id,
        matchId: matches[i].id,
        sortOrder: i,
      },
    });
  }

  const cupNormalTable = await prisma.rewardTable.findUnique({ where: { slug: "cup-normal" } });
  const cupLegendTable = await prisma.rewardTable.findUnique({ where: { slug: "cup-legend" } });
  const tournamentTable = await prisma.rewardTable.findUnique({ where: { slug: "tournament-fath" } });

  const regDeadline = new Date();
  regDeadline.setDate(regDeadline.getDate() + 7);
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 14);

  if (cupNormalTable && matches[1]) {
    await prisma.cup.upsert({
      where: { id: "seed-cup-normal" },
      update: { isPublished: true },
      create: {
        id: "seed-cup-normal",
        matchId: matches[1].id,
        mode: CupMode.NORMAL,
        titleFa: "جام الکلاسیکو",
        description: "رئال مادرید vs بارسلونا — جام ویژه",
        entryFeeCoins: 800,
        rewardTableId: cupNormalTable.id,
        registrationDeadline: regDeadline,
        startsAt: new Date(),
        endsAt,
        isPublished: true,
      },
    });
    await prisma.cup.upsert({
      where: { id: "seed-cup-legend" },
      update: { isPublished: true },
      create: {
        id: "seed-cup-legend",
        matchId: matches[1].id,
        mode: CupMode.LEGEND,
        titleFa: "جام افسانه الکلاسیکو",
        description: "حالت افسانه — پاداش‌های بزرگ‌تر",
        entryFeeCoins: 1100,
        rewardTableId: cupLegendTable!.id,
        registrationDeadline: regDeadline,
        startsAt: new Date(),
        endsAt,
        isPublished: true,
      },
    });
  }

  if (tournamentTable) {
    await prisma.tournament.upsert({
      where: { slug: "fath" },
      update: { isPublished: true },
      create: {
        slug: "fath",
        nameFa: "فتح",
        description: "تورنمنت فصلانه بُردین",
        registrationFeeCoins: 200,
        predictionFeeCoins: 600,
        rewardTableId: tournamentTable.id,
        registrationDeadline: regDeadline,
        startsAt: new Date(),
        endsAt,
        isPublished: true,
      },
    });
  }

  await prisma.teamCompetition.upsert({
    where: { id: "seed-tc-1" },
    update: { isPublished: true },
    create: {
      id: "seed-tc-1",
      titleFa: "جام قهرمانان تیمی",
      description: "تیم بساز و قهرمان شو",
      competitionType: "ELIMINATION",
      teamCapacity: 16,
      minTeamSize: 3,
      maxTeamSize: 5,
      registrationDeadline: regDeadline,
      registrationFeePerMember: 100,
      rankingStartsAt: regDeadline,
      rankingEndsAt: endsAt,
      rankingPredictionFeePerMember: 50,
      knockoutStartsAt: endsAt,
      knockoutEndsAt: endsAt,
      winnerCoinReward: 8000,
      runnerUpCoinReward: 5000,
      isPublished: true,
      stage: "REGISTRATION",
    },
  });

  const packages = [
    { id: "pkg-600", nameFa: "یک مشت سکه ۶۰۰تایی", coinAmount: 600, priceToman: 24000, sortOrder: 0 },
    { id: "pkg-1200", nameFa: "یک کیسه سکه ۱۲۰۰تایی", coinAmount: 1200, priceToman: 43000, sortOrder: 1 },
    { id: "pkg-3000", nameFa: "یک جعبه سکه ۳۰۰۰تایی", coinAmount: 3000, priceToman: 102000, sortOrder: 2 },
    { id: "pkg-6000", nameFa: "یک فرغون سکه ۶۰۰۰تایی", coinAmount: 6000, priceToman: 192000, sortOrder: 3 },
    { id: "pkg-12000", nameFa: "یک وانت سکه ۱۲۰۰۰تایی", coinAmount: 12000, priceToman: 360000, sortOrder: 4 },
  ];
  for (const pkg of packages) {
    await prisma.coinPackage.upsert({
      where: { id: pkg.id },
      update: pkg,
      create: pkg,
    });
  }

  console.log("Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
