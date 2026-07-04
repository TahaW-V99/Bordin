import {
  TeamCompetitionMatchStage,
  TeamCompetitionMedalPlacement,
  TeamCompetitionStage,
  TeamCompetitionType,
  type TeamCompetitionKnockoutRoundType,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  knockoutRoundsForCapacity,
  type TeamCompetitionCapacity,
  TEAM_COMPETITION_CAPACITY_OPTIONS,
} from "@/shared/constants/team-competitions";
import { latestKickoffAt } from "@/shared/lib/tehran-datetime";
import { upsertFootballMatchesByExternalIds } from "@/server/services/admin-football-catalog-service";

const legacyKnockoutRoundInputSchema = z.object({
  roundType: z.enum(["ONE_SIXTEENTH", "ONE_EIGHTH", "ONE_QUARTER", "FINAL"]),
  predictionFeePerMember: z.number().int().min(0),
  matchExternalIds: z.array(z.string().min(1)).min(1),
});

const ruleBasedKnockoutRoundInputSchema = z.object({
  roundType: z.enum(["ONE_SIXTEENTH", "ONE_EIGHTH", "ONE_QUARTER", "FINAL"]),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  predictionFeePerMember: z.number().int().min(0),
  footballCompetitionIds: z.array(z.number().int()).min(1),
});

export const createTeamCompetitionSchema = z.object({
  titleFa: z.string().min(2).max(120),
  description: z.string().max(5000).optional().nullable(),
  bannerUrl: z.string().min(1).optional().nullable(),
  competitionType: z.literal("ELIMINATION").default("ELIMINATION"),
  teamCapacity: z.union([z.literal(8), z.literal(16), z.literal(32)]),
  minTeamSize: z.number().int().min(2).max(20),
  maxTeamSize: z.number().int().min(2).max(20),
  registrationDeadline: z.string().min(1),
  registrationFeePerMember: z.number().int().min(0),
  rankingStartsAt: z.string().min(1),
  rankingEndsAt: z.string().min(1),
  rankingFootballCompetitionIds: z.array(z.number().int()).min(1),
  rankingPredictionFeePerMember: z.number().int().min(0),
  knockoutRounds: z.array(ruleBasedKnockoutRoundInputSchema).min(1),
  winnerCoinReward: z.number().int().min(0),
  runnerUpCoinReward: z.number().int().min(0),
  winnerMedalIds: z.array(z.string().min(1)),
  runnerUpMedalIds: z.array(z.string().min(1)),
  publish: z.boolean().default(true),
});

const legacyCreateTeamCompetitionSchema = createTeamCompetitionSchema
  .omit({
    rankingEndsAt: true,
    rankingFootballCompetitionIds: true,
  })
  .extend({
    rankingMatchExternalIds: z.array(z.string().min(1)).min(1),
    knockoutRounds: z.array(legacyKnockoutRoundInputSchema).min(1),
  });

export type CreateTeamCompetitionInput = z.infer<typeof createTeamCompetitionSchema>;

function parseDate(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} نامعتبر است`);
  return date;
}

function validateTeamSizes(minTeamSize: number, maxTeamSize: number) {
  if (minTeamSize > maxTeamSize) {
    throw new Error("حداقل اعضای تیم نمی‌تواند بیشتر از حداکثر باشد");
  }
}

function validateStageWindow(startsAt: Date, endsAt: Date, label: string) {
  if (startsAt >= endsAt) {
    throw new Error(`${label}: تاریخ پایان باید بعد از تاریخ شروع باشد`);
  }
}

function parseRuleBasedKnockoutRounds(
  input: z.infer<typeof createTeamCompetitionSchema>,
) {
  return input.knockoutRounds.map((round, sortOrder) => {
    const startsAt = parseDate(round.startsAt, `شروع ${round.roundType}`);
    const endsAt = parseDate(round.endsAt, `پایان ${round.roundType}`);
    validateStageWindow(startsAt, endsAt, "مرحله حذفی");
    return {
      roundType: round.roundType,
      sortOrder,
      predictionFeePerMember: round.predictionFeePerMember,
      startsAt,
      endsAt,
      footballCompetitionIds: round.footballCompetitionIds,
    };
  });
}

function validateKnockoutRounds(
  teamCapacity: TeamCompetitionCapacity,
  rounds: Array<{ roundType: TeamCompetitionKnockoutRoundType }>,
) {
  const expected = knockoutRoundsForCapacity(teamCapacity);
  const received = rounds.map((r) => r.roundType);
  if (received.length !== expected.length) {
    throw new Error("تعداد مراحل حذفی با ظرفیت رقابت همخوانی ندارد");
  }
  for (let i = 0; i < expected.length; i++) {
    if (received[i] !== expected[i]) {
      throw new Error("ترتیب مراحل حذفی نامعتبر است");
    }
  }
}

export async function listAdminTeamCompetitions() {
  if (await shouldUseMemoryDb()) {
    return [];
  }

  const rows = await prisma.teamCompetition.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { entries: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    titleFa: row.titleFa,
    bannerUrl: row.bannerUrl,
    teamCapacity: row.teamCapacity,
    stage: row.stage,
    isPublished: row.isPublished,
    registrationDeadline: row.registrationDeadline.toISOString(),
    entryCount: row._count.entries,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getAdminTeamCompetition(id: string) {
  if (await shouldUseMemoryDb()) {
    throw new Error("رقابت تیمی یافت نشد");
  }

  const row = await prisma.teamCompetition.findUnique({
    where: { id },
    include: {
      knockoutRounds: {
        orderBy: { sortOrder: "asc" },
        include: {
          footballCompetitions: true,
          stageMatches: {
            orderBy: { sortOrder: "asc" },
            include: { match: true },
          },
        },
      },
      rankingFootballCompetitions: true,
      stageMatches: {
        where: { stage: TeamCompetitionMatchStage.RANKING },
        orderBy: { sortOrder: "asc" },
        include: { match: true },
      },
      medalRewards: { include: { medal: true } },
      _count: { select: { entries: true } },
    },
  });

  if (!row) throw new Error("رقابت تیمی یافت نشد");

  return {
    id: row.id,
    titleFa: row.titleFa,
    description: row.description,
    bannerUrl: row.bannerUrl,
    competitionType: row.competitionType,
    teamCapacity: row.teamCapacity,
    minTeamSize: row.minTeamSize,
    maxTeamSize: row.maxTeamSize,
    registrationDeadline: row.registrationDeadline.toISOString(),
    registrationFeePerMember: row.registrationFeePerMember,
    rankingStartsAt: row.rankingStartsAt.toISOString(),
    rankingEndsAt: row.rankingEndsAt.toISOString(),
    rankingPredictionFeePerMember: row.rankingPredictionFeePerMember,
    knockoutStartsAt: row.knockoutStartsAt?.toISOString() ?? null,
    knockoutEndsAt: row.knockoutEndsAt?.toISOString() ?? null,
    winnerCoinReward: row.winnerCoinReward,
    runnerUpCoinReward: row.runnerUpCoinReward,
    isPublished: row.isPublished,
    stage: row.stage,
    usesRuleBasedStages: row.usesRuleBasedStages,
    entryCount: row._count.entries,
    rankingFootballCompetitionIds: row.rankingFootballCompetitions.map(
      (r) => r.footballCompetitionId,
    ),
    rankingMatches: row.stageMatches.map((sm) => ({
      id: sm.id,
      matchId: sm.matchId,
      externalId: sm.match.externalId,
      kickoffAt: sm.kickoffAt.toISOString(),
      homeTeamName: sm.match.homeTeamName,
      awayTeamName: sm.match.awayTeamName,
      leagueName: sm.match.leagueName,
    })),
    knockoutRounds: row.knockoutRounds.map((round) => ({
      id: round.id,
      roundType: round.roundType,
      sortOrder: round.sortOrder,
      startsAt: round.startsAt?.toISOString() ?? null,
      endsAt: round.endsAt?.toISOString() ?? null,
      predictionFeePerMember: round.predictionFeePerMember,
      footballCompetitionIds: round.footballCompetitions.map((r) => r.footballCompetitionId),
      matches: round.stageMatches.map((sm) => ({
        id: sm.id,
        matchId: sm.matchId,
        externalId: sm.match.externalId,
        kickoffAt: sm.kickoffAt.toISOString(),
        homeTeamName: sm.match.homeTeamName,
        awayTeamName: sm.match.awayTeamName,
        leagueName: sm.match.leagueName,
      })),
    })),
    medalRewards: row.medalRewards.map((mr) => ({
      placement: mr.placement,
      medalId: mr.medalId,
      titleFa: mr.medal.titleFa,
      slug: mr.medal.slug,
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createAdminTeamCompetition(raw: CreateTeamCompetitionInput) {
  if (await shouldUseMemoryDb()) {
    throw new Error("ایجاد رقابت تیمی در حالت حافظه پشتیبانی نمی‌شود");
  }

  const input = createTeamCompetitionSchema.parse(raw);

  if (!TEAM_COMPETITION_CAPACITY_OPTIONS.includes(input.teamCapacity as TeamCompetitionCapacity)) {
    throw new Error("ظرفیت رقابت نامعتبر است");
  }

  validateTeamSizes(input.minTeamSize, input.maxTeamSize);
  validateKnockoutRounds(input.teamCapacity, input.knockoutRounds);

  const registrationDeadline = parseDate(input.registrationDeadline, "ددلاین ثبت‌نام");
  const rankingStartsAt = parseDate(input.rankingStartsAt, "شروع مرحله رده‌بندی");
  const rankingEndsAt = parseDate(input.rankingEndsAt, "پایان مرحله رده‌بندی");
  validateStageWindow(rankingStartsAt, rankingEndsAt, "مرحله رده‌بندی");

  if (registrationDeadline >= rankingStartsAt) {
    throw new Error("شروع رده‌بندی باید بعد از ددلاین ثبت‌نام باشد");
  }

  const knockoutRoundData = parseRuleBasedKnockoutRounds(input);
  const knockoutStartsAt = knockoutRoundData[0]?.startsAt ?? null;
  const knockoutEndsAt = knockoutRoundData[knockoutRoundData.length - 1]?.endsAt ?? null;

  const competition = await prisma.$transaction(async (tx) => {
    const created = await tx.teamCompetition.create({
      data: {
        titleFa: input.titleFa,
        description: input.description ?? null,
        bannerUrl: input.bannerUrl ?? null,
        competitionType: TeamCompetitionType.ELIMINATION,
        teamCapacity: input.teamCapacity,
        minTeamSize: input.minTeamSize,
        maxTeamSize: input.maxTeamSize,
        registrationDeadline,
        registrationFeePerMember: input.registrationFeePerMember,
        rankingStartsAt,
        rankingEndsAt,
        rankingPredictionFeePerMember: input.rankingPredictionFeePerMember,
        knockoutStartsAt,
        knockoutEndsAt,
        winnerCoinReward: input.winnerCoinReward,
        runnerUpCoinReward: input.runnerUpCoinReward,
        isPublished: input.publish,
        usesRuleBasedStages: true,
        stage: TeamCompetitionStage.REGISTRATION,
      },
    });

    await tx.teamCompetitionRankingFootballCompetition.createMany({
      data: input.rankingFootballCompetitionIds.map((footballCompetitionId) => ({
        teamCompetitionId: created.id,
        footballCompetitionId,
      })),
    });

    for (const round of knockoutRoundData) {
      const knockoutRound = await tx.teamCompetitionKnockoutRound.create({
        data: {
          teamCompetitionId: created.id,
          roundType: round.roundType,
          sortOrder: round.sortOrder,
          startsAt: round.startsAt,
          endsAt: round.endsAt,
          predictionFeePerMember: round.predictionFeePerMember,
        },
      });

      await tx.teamCompetitionKnockoutRoundFootballCompetition.createMany({
        data: round.footballCompetitionIds.map((footballCompetitionId) => ({
          knockoutRoundId: knockoutRound.id,
          footballCompetitionId,
        })),
      });
    }

    const medalRows = [
      ...input.winnerMedalIds.map((medalId) => ({
        teamCompetitionId: created.id,
        placement: TeamCompetitionMedalPlacement.WINNER,
        medalId,
      })),
      ...input.runnerUpMedalIds.map((medalId) => ({
        teamCompetitionId: created.id,
        placement: TeamCompetitionMedalPlacement.RUNNER_UP,
        medalId,
      })),
    ];
    if (medalRows.length > 0) {
      await tx.teamCompetitionMedalReward.createMany({ data: medalRows });
    }

    return created;
  });

  return getAdminTeamCompetition(competition.id);
}

type LegacyCreateInput = z.infer<typeof legacyCreateTeamCompetitionSchema>;

async function buildLegacyKnockoutRoundData(
  input: LegacyCreateInput,
  rankingEndsAt: Date,
) {
  const knockoutRoundData: Array<{
    roundType: TeamCompetitionKnockoutRoundType;
    sortOrder: number;
    predictionFeePerMember: number;
    startsAt: Date | null;
    endsAt: Date | null;
    matches: Array<{ matchId: string; kickoffAt: Date; sortOrder: number }>;
  }> = [];

  let previousEnd: Date | null = rankingEndsAt;

  for (let i = 0; i < input.knockoutRounds.length; i++) {
    const roundInput = input.knockoutRounds[i];
    const upserted = await upsertFootballMatchesByExternalIds(roundInput.matchExternalIds);
    const endsAt = latestKickoffAt(upserted.map((m) => m.kickoffAt));
    if (!endsAt) throw new Error("تاریخ پایان مرحله حذفی قابل محاسبه نیست");

    knockoutRoundData.push({
      roundType: roundInput.roundType,
      sortOrder: i,
      predictionFeePerMember: roundInput.predictionFeePerMember,
      startsAt: previousEnd,
      endsAt,
      matches: upserted.map((m, sortOrder) => ({
        matchId: m.matchId,
        kickoffAt: m.kickoffAt,
        sortOrder,
      })),
    });

    previousEnd = endsAt;
  }

  return knockoutRoundData;
}

async function createLegacyStageRelations(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  competitionId: string,
  input: LegacyCreateInput,
  rankingUpserted: Awaited<ReturnType<typeof upsertFootballMatchesByExternalIds>>,
  knockoutRoundData: Awaited<ReturnType<typeof buildLegacyKnockoutRoundData>>,
) {
  await tx.teamCompetitionStageMatch.createMany({
    data: rankingUpserted.map((m, sortOrder) => ({
      teamCompetitionId: competitionId,
      stage: TeamCompetitionMatchStage.RANKING,
      matchId: m.matchId,
      sortOrder,
      kickoffAt: m.kickoffAt,
    })),
  });

  for (const round of knockoutRoundData) {
    const knockoutRound = await tx.teamCompetitionKnockoutRound.create({
      data: {
        teamCompetitionId: competitionId,
        roundType: round.roundType,
        sortOrder: round.sortOrder,
        startsAt: round.startsAt,
        endsAt: round.endsAt,
        predictionFeePerMember: round.predictionFeePerMember,
      },
    });

    await tx.teamCompetitionStageMatch.createMany({
      data: round.matches.map((m) => ({
        teamCompetitionId: competitionId,
        stage: TeamCompetitionMatchStage.KNOCKOUT,
        knockoutRoundId: knockoutRound.id,
        matchId: m.matchId,
        sortOrder: m.sortOrder,
        kickoffAt: m.kickoffAt,
      })),
    });
  }

  const medalRows = [
    ...input.winnerMedalIds.map((medalId) => ({
      teamCompetitionId: competitionId,
      placement: TeamCompetitionMedalPlacement.WINNER,
      medalId,
    })),
    ...input.runnerUpMedalIds.map((medalId) => ({
      teamCompetitionId: competitionId,
      placement: TeamCompetitionMedalPlacement.RUNNER_UP,
      medalId,
    })),
  ];

  if (medalRows.length > 0) {
    await tx.teamCompetitionMedalReward.createMany({ data: medalRows });
  }
}

export async function updateAdminTeamCompetition(id: string, raw: CreateTeamCompetitionInput) {
  if (await shouldUseMemoryDb()) {
    throw new Error("ویرایش رقابت تیمی در حالت حافظه پشتیبانی نمی‌شود");
  }

  const existing = await prisma.teamCompetition.findUnique({
    where: { id },
    select: { id: true, stage: true, usesRuleBasedStages: true },
  });
  if (!existing) throw new Error("رقابت تیمی یافت نشد");
  if (existing.stage !== TeamCompetitionStage.REGISTRATION) {
    throw new Error("فقط رقابت‌های در مرحله ثبت‌نام قابل ویرایش هستند");
  }

  if (existing.usesRuleBasedStages) {
    return updateRuleBasedAdminTeamCompetition(id, raw);
  }

  return updateLegacyAdminTeamCompetition(id, raw);
}

async function updateRuleBasedAdminTeamCompetition(
  id: string,
  raw: CreateTeamCompetitionInput,
) {
  const input = createTeamCompetitionSchema.parse(raw);

  if (!TEAM_COMPETITION_CAPACITY_OPTIONS.includes(input.teamCapacity as TeamCompetitionCapacity)) {
    throw new Error("ظرفیت رقابت نامعتبر است");
  }

  validateTeamSizes(input.minTeamSize, input.maxTeamSize);
  validateKnockoutRounds(input.teamCapacity, input.knockoutRounds);

  const registrationDeadline = parseDate(input.registrationDeadline, "ددلاین ثبت‌نام");
  const rankingStartsAt = parseDate(input.rankingStartsAt, "شروع مرحله رده‌بندی");
  const rankingEndsAt = parseDate(input.rankingEndsAt, "پایان مرحله رده‌بندی");
  validateStageWindow(rankingStartsAt, rankingEndsAt, "مرحله رده‌بندی");

  if (registrationDeadline >= rankingStartsAt) {
    throw new Error("شروع رده‌بندی باید بعد از ددلاین ثبت‌نام باشد");
  }

  const knockoutRoundData = parseRuleBasedKnockoutRounds(input);
  const knockoutStartsAt = knockoutRoundData[0]?.startsAt ?? null;
  const knockoutEndsAt = knockoutRoundData[knockoutRoundData.length - 1]?.endsAt ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.teamCompetitionMedalReward.deleteMany({ where: { teamCompetitionId: id } });
    await tx.teamCompetitionRankingFootballCompetition.deleteMany({ where: { teamCompetitionId: id } });
    await tx.teamCompetitionStageMatch.deleteMany({ where: { teamCompetitionId: id } });
    await tx.teamCompetitionKnockoutRound.deleteMany({ where: { teamCompetitionId: id } });

    await tx.teamCompetition.update({
      where: { id },
      data: {
        titleFa: input.titleFa,
        description: input.description ?? null,
        bannerUrl: input.bannerUrl ?? null,
        teamCapacity: input.teamCapacity,
        minTeamSize: input.minTeamSize,
        maxTeamSize: input.maxTeamSize,
        registrationDeadline,
        registrationFeePerMember: input.registrationFeePerMember,
        rankingStartsAt,
        rankingEndsAt,
        rankingPredictionFeePerMember: input.rankingPredictionFeePerMember,
        knockoutStartsAt,
        knockoutEndsAt,
        winnerCoinReward: input.winnerCoinReward,
        runnerUpCoinReward: input.runnerUpCoinReward,
      },
    });

    await tx.teamCompetitionRankingFootballCompetition.createMany({
      data: input.rankingFootballCompetitionIds.map((footballCompetitionId) => ({
        teamCompetitionId: id,
        footballCompetitionId,
      })),
    });

    for (const round of knockoutRoundData) {
      const knockoutRound = await tx.teamCompetitionKnockoutRound.create({
        data: {
          teamCompetitionId: id,
          roundType: round.roundType,
          sortOrder: round.sortOrder,
          startsAt: round.startsAt,
          endsAt: round.endsAt,
          predictionFeePerMember: round.predictionFeePerMember,
        },
      });

      await tx.teamCompetitionKnockoutRoundFootballCompetition.createMany({
        data: round.footballCompetitionIds.map((footballCompetitionId) => ({
          knockoutRoundId: knockoutRound.id,
          footballCompetitionId,
        })),
      });
    }

    const medalRows = [
      ...input.winnerMedalIds.map((medalId) => ({
        teamCompetitionId: id,
        placement: TeamCompetitionMedalPlacement.WINNER,
        medalId,
      })),
      ...input.runnerUpMedalIds.map((medalId) => ({
        teamCompetitionId: id,
        placement: TeamCompetitionMedalPlacement.RUNNER_UP,
        medalId,
      })),
    ];
    if (medalRows.length > 0) {
      await tx.teamCompetitionMedalReward.createMany({ data: medalRows });
    }
  });

  return getAdminTeamCompetition(id);
}

async function updateLegacyAdminTeamCompetition(
  id: string,
  raw: CreateTeamCompetitionInput,
) {
  const input = legacyCreateTeamCompetitionSchema.parse(raw);

  if (!TEAM_COMPETITION_CAPACITY_OPTIONS.includes(input.teamCapacity as TeamCompetitionCapacity)) {
    throw new Error("ظرفیت رقابت نامعتبر است");
  }

  validateTeamSizes(input.minTeamSize, input.maxTeamSize);
  validateKnockoutRounds(input.teamCapacity, input.knockoutRounds);

  const registrationDeadline = parseDate(input.registrationDeadline, "ددلاین ثبت‌نام");
  const rankingStartsAt = parseDate(input.rankingStartsAt, "شروع مرحله رده‌بندی");

  if (registrationDeadline >= rankingStartsAt) {
    throw new Error("شروع رده‌بندی باید بعد از ددلاین ثبت‌نام باشد");
  }

  const rankingUpserted = await upsertFootballMatchesByExternalIds(input.rankingMatchExternalIds);
  const rankingEndsAt = latestKickoffAt(rankingUpserted.map((m) => m.kickoffAt));
  if (!rankingEndsAt) throw new Error("تاریخ پایان رده‌بندی قابل محاسبه نیست");

  const knockoutStartsAt = rankingEndsAt;
  const knockoutRoundData = await buildLegacyKnockoutRoundData(input, rankingEndsAt);
  const knockoutEndsAt = knockoutRoundData[knockoutRoundData.length - 1]?.endsAt ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.teamCompetitionMedalReward.deleteMany({ where: { teamCompetitionId: id } });
    await tx.teamCompetitionStageMatch.deleteMany({ where: { teamCompetitionId: id } });
    await tx.teamCompetitionKnockoutRound.deleteMany({ where: { teamCompetitionId: id } });

    await tx.teamCompetition.update({
      where: { id },
      data: {
        titleFa: input.titleFa,
        description: input.description ?? null,
        bannerUrl: input.bannerUrl ?? null,
        teamCapacity: input.teamCapacity,
        minTeamSize: input.minTeamSize,
        maxTeamSize: input.maxTeamSize,
        registrationDeadline,
        registrationFeePerMember: input.registrationFeePerMember,
        rankingStartsAt,
        rankingEndsAt,
        rankingPredictionFeePerMember: input.rankingPredictionFeePerMember,
        knockoutStartsAt,
        knockoutEndsAt,
        winnerCoinReward: input.winnerCoinReward,
        runnerUpCoinReward: input.runnerUpCoinReward,
      },
    });

    await createLegacyStageRelations(tx, id, input, rankingUpserted, knockoutRoundData);
  });

  return getAdminTeamCompetition(id);
}

export async function deleteAdminTeamCompetition(id: string) {
  if (await shouldUseMemoryDb()) {
    throw new Error("رقابت تیمی یافت نشد");
  }

  const row = await prisma.teamCompetition.findUnique({
    where: { id },
    select: { id: true, isPublished: true },
  });
  if (!row) throw new Error("رقابت تیمی یافت نشد");
  if (row.isPublished) {
    throw new Error("رقابت‌های منتشر شده قابل حذف نیستند");
  }

  await prisma.teamCompetition.delete({ where: { id } });
  return { id };
}

export async function toggleTeamCompetitionPublish(id: string, isPublished: boolean) {
  if (await shouldUseMemoryDb()) {
    throw new Error("رقابت تیمی یافت نشد");
  }

  const updated = await prisma.teamCompetition.update({
    where: { id },
    data: { isPublished },
  });

  return {
    id: updated.id,
    isPublished: updated.isPublished,
  };
}

export async function listAdminMedalsForPicker() {
  if (await shouldUseMemoryDb()) {
    return [];
  }

  return prisma.medal.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { tier: "asc" }],
    select: {
      id: true,
      slug: true,
      titleFa: true,
      tier: true,
      category: true,
      iconUrl: true,
    },
  });
}
