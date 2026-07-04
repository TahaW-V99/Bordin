import { CompetitionType, CupMode } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { assertTeamCompetitionRegistrationAllowed } from "@/server/services/team-competition-registration-rules";
import { deductCoins, addPredictionRewardCoins, addXp } from "./wallet-service";
import { getRewardFromTable } from "@/shared/constants/reward-tables";
import { localizeFootballMatch } from "@/shared/lib/football-names-fa";
import { getPredictionDeadlineInstant, effectivePredictionCutoffMinutes } from "@/shared/lib/dates";

type FilterTab = "upcoming" | "joined" | "finished";
type TeamCompetitionFilterTab = "upcoming" | "joined" | "active" | "finished";

function cupStatus(cup: { endsAt: Date | string; registrationDeadline: Date | string }, joined: boolean) {
  const now = new Date();
  const ends = new Date(cup.endsAt);
  const reg = new Date(cup.registrationDeadline);
  if (ends < now) return joined ? "finished" : "finished";
  if (joined) return "joined";
  if (reg < now) return "upcoming";
  return "upcoming";
}

export async function listCups(userId: string, filter: FilterTab) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.listCups(userId, filter);
  }

  const cups = await prisma.cup.findMany({
    where: { isPublished: true },
    include: {
      match: true,
      entries: { where: { userId } },
    },
    orderBy: { startsAt: "asc" },
  });

  return cups
    .map((c) => {
      const joined = c.entries.length > 0;
      const status = cupStatus(c, joined);
      return {
        id: c.id,
        titleFa: c.titleFa,
        description: c.description,
        mode: c.mode,
        entryFeeCoins: c.entryFeeCoins,
        registrationDeadline: c.registrationDeadline,
        startsAt: c.startsAt,
        endsAt: c.endsAt,
        bannerUrl: c.bannerUrl,
        match: c.match ? localizeFootballMatch(c.match) : c.match,
        joined,
        status,
      };
    })
    .filter((c) => {
      if (filter === "joined") return c.joined && c.status !== "finished";
      if (filter === "finished") return c.status === "finished";
      return !c.joined && c.status !== "finished";
    });
}

export async function getCup(id: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.getCup(id, userId);
  }

  const cup = await prisma.cup.findUnique({
    where: { id },
    include: {
      match: true,
      entries: { where: { userId } },
    },
  });
  if (!cup) return null;

  const rewardTable = await prisma.rewardTable.findUnique({
    where: { id: cup.rewardTableId },
    include: { tiers: { orderBy: { accuracyPercent: "asc" }, include: { medal: true } } },
  });

  const prediction = await prisma.prediction.findFirst({
    where: {
      userId,
      matchId: cup.matchId,
      competitionType: CompetitionType.CUP,
      competitionRefId: cup.id,
    },
  });

  const joined = cup.entries.length > 0;
  return {
    ...cup,
    match: cup.match ? localizeFootballMatch(cup.match) : cup.match,
    joined,
    status: cupStatus(cup, joined),
    rewardTable,
    prediction,
    rewardTableSlug: cup.mode === CupMode.LEGEND ? "cup-legend" : "cup-normal",
  };
}

export async function joinCup(cupId: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.joinCup(cupId, userId);
  }

  const cup = await prisma.cup.findUnique({ where: { id: cupId } });
  if (!cup) throw new Error("جام یافت نشد");
  if (new Date() > cup.registrationDeadline) throw new Error("مهلت ثبت‌نام به پایان رسیده");

  const existing = await prisma.cupEntry.findUnique({
    where: { cupId_userId: { cupId, userId } },
  });
  if (existing) throw new Error("شما قبلاً ثبت‌نام کرده‌اید");

  await deductCoins(userId, cup.entryFeeCoins, `ورودی جام ${cup.titleFa}`);

  const entry = await prisma.cupEntry.create({
    data: { cupId, userId, status: "REGISTERED" },
  });

  await prisma.userProfile.update({
    where: { userId },
    data: { cupsEntered: { increment: 1 } },
  });

  return entry;
}

export async function predictCup(
  cupId: string,
  userId: string,
  homePrediction: number,
  awayPrediction: number,
) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.predictCup(cupId, userId, homePrediction, awayPrediction);
  }

  const cup = await prisma.cup.findUnique({
    where: { id: cupId },
    include: { match: true },
  });
  if (!cup) throw new Error("جام یافت نشد");

  const entry = await prisma.cupEntry.findUnique({
    where: { cupId_userId: { cupId, userId } },
  });
  if (!entry) throw new Error("ابتدا در جام ثبت‌نام کنید");

  const cutoffMs = getPredictionDeadlineInstant(cup.match.kickoffAt, effectivePredictionCutoffMinutes(5));
  if (Date.now() >= cutoffMs) throw new Error("مهلت پیش‌بینی به پایان رسیده");

  const existing = await prisma.prediction.findFirst({
    where: {
      userId,
      matchId: cup.matchId,
      competitionType: CompetitionType.CUP,
      competitionRefId: cupId,
    },
  });
  if (existing) throw new Error("پیش‌بینی قبلاً ثبت شده");

  const prediction = await prisma.prediction.create({
    data: {
      userId,
      matchId: cup.matchId,
      competitionType: CompetitionType.CUP,
      competitionRefId: cupId,
      homePrediction,
      awayPrediction,
      entryFeeCoins: 0,
    },
  });

  await prisma.cupEntry.update({
    where: { cupId_userId: { cupId, userId } },
    data: { status: "PREDICTED" },
  });

  return prediction;
}

export async function listTournaments(userId: string, filter: FilterTab) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.listTournaments(userId, filter);
  }

  const tournaments = await prisma.tournament.findMany({
    where: { isPublished: true },
    include: { entries: { where: { userId } } },
    orderBy: { startsAt: "asc" },
  });

  return tournaments
    .map((t) => {
      const joined = t.entries.length > 0;
      const finished = new Date() > t.endsAt;
      const status = finished ? "finished" : joined ? "joined" : "upcoming";
      return { ...t, joined, status };
    })
    .filter((t) => {
      if (filter === "joined") return t.joined && t.status !== "finished";
      if (filter === "finished") return t.status === "finished";
      return !t.joined && t.status !== "finished";
    });
}

export async function getTournament(id: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.getTournament(id, userId);
  }

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { entries: { where: { userId } } },
  });
  if (!tournament) return null;

  const matches = await prisma.footballMatch.findMany({
    where: {
      kickoffAt: { gte: tournament.startsAt, lte: tournament.endsAt },
      status: { not: "CANCELLED" },
    },
    orderBy: { kickoffAt: "asc" },
    take: 10,
  });

  const predictions = await prisma.prediction.findMany({
    where: {
      userId,
      competitionType: CompetitionType.TOURNAMENT,
      competitionRefId: tournament.id,
    },
  });

  const rewardTable = await prisma.rewardTable.findUnique({
    where: { id: tournament.rewardTableId },
    include: { tiers: { orderBy: { accuracyPercent: "asc" }, include: { medal: true } } },
  });

  const joined = tournament.entries.length > 0;
  return {
    ...tournament,
    joined,
    status: new Date() > tournament.endsAt ? "finished" : joined ? "joined" : "upcoming",
    matches: matches.map((m) => localizeFootballMatch(m)),
    predictions,
    rewardTable,
    rewardTableSlug: "tournament-fath",
  };
}

export async function registerTournament(tournamentId: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.registerTournament(tournamentId, userId);
  }

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("تورنمنت یافت نشد");
  if (new Date() > tournament.registrationDeadline) throw new Error("مهلت ثبت‌نام تمام شده");

  const existing = await prisma.tournamentEntry.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  if (existing) throw new Error("قبلاً ثبت‌نام کرده‌اید");

  await deductCoins(userId, tournament.registrationFeeCoins, `ثبت‌نام ${tournament.nameFa}`);

  const entry = await prisma.tournamentEntry.create({
    data: { tournamentId, userId, status: "REGISTERED" },
  });

  await prisma.userProfile.update({
    where: { userId },
    data: { tournamentsEntered: { increment: 1 } },
  });

  return entry;
}

export async function predictTournament(
  tournamentId: string,
  userId: string,
  matchId: string,
  homePrediction: number,
  awayPrediction: number,
) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.predictTournament(
      tournamentId,
      userId,
      matchId,
      homePrediction,
      awayPrediction,
    );
  }

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error("تورنمنت یافت نشد");

  const entry = await prisma.tournamentEntry.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } },
  });
  if (!entry) throw new Error("ابتدا ثبت‌نام کنید");

  const match = await prisma.footballMatch.findUnique({ where: { id: matchId } });
  if (!match) throw new Error("مسابقه یافت نشد");

  const cutoffMs = getPredictionDeadlineInstant(match.kickoffAt, effectivePredictionCutoffMinutes(5));
  if (Date.now() >= cutoffMs) throw new Error("مهلت پیش‌بینی تمام شده");

  const existing = await prisma.prediction.findFirst({
    where: {
      userId,
      matchId,
      competitionType: CompetitionType.TOURNAMENT,
      competitionRefId: tournamentId,
    },
  });
  if (existing) throw new Error("پیش‌بینی این مسابقه ثبت شده");

  await deductCoins(userId, tournament.predictionFeeCoins, `پیش‌بینی تورنمنت ${tournament.nameFa}`);

  return prisma.prediction.create({
    data: {
      userId,
      matchId,
      competitionType: CompetitionType.TOURNAMENT,
      competitionRefId: tournamentId,
      homePrediction,
      awayPrediction,
      entryFeeCoins: tournament.predictionFeeCoins,
    },
  });
}

export async function listTeamCompetitions(userId: string, filter: TeamCompetitionFilterTab) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.listTeamCompetitions(userId, filter);
  }

  const comps = await prisma.teamCompetition.findMany({
    where: { isPublished: true },
    orderBy: { registrationDeadline: "asc" },
  });

  const userTeams = await prisma.teamMember.findMany({ where: { userId } });
  const teamIds = userTeams.map((t) => t.teamId);

  const entries = await prisma.teamCompetitionEntry.findMany({
    where: { teamId: { in: teamIds } },
  });
  const joinedIds = new Set(entries.map((e) => e.teamCompetitionId));

  return comps
    .map((c) => {
      const joined = joinedIds.has(c.id);
      const status =
        c.stage === "FINISHED"
          ? "finished"
          : c.stage === "REGISTRATION"
            ? "upcoming"
            : "active";
      return { ...c, joined, status };
    })
    .filter((c) => {
      if (filter === "joined" || filter === "active") {
        return c.stage === "RANKING" || c.stage === "KNOCKOUT";
      }
      if (filter === "finished") return c.stage === "FINISHED";
      return c.stage === "REGISTRATION";
    });
}

export async function getTeamCompetition(id: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.getTeamCompetition(id, userId);
  }

  const comp = await prisma.teamCompetition.findUnique({ where: { id } });
  if (!comp) return null;

  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    include: { team: { include: { members: { include: { user: { include: { profile: true } } } } } } },
  });

  return {
    ...comp,
    userTeam: membership?.team ?? null,
    status: comp.stage === "FINISHED" ? "finished" : membership ? "joined" : "upcoming",
  };
}

export async function createTeam(userId: string, name: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.createTeam(userId, name);
  }

  const team = await prisma.team.create({
    data: {
      name,
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
    },
    include: { members: true },
  });
  return team;
}

export async function joinTeamCompetition(competitionId: string, teamId: string, userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.competitions.joinTeamCompetition(competitionId, teamId, userId);
  }

  const comp = await prisma.teamCompetition.findUnique({ where: { id: competitionId } });
  if (!comp) throw new Error("رقابت تیمی یافت نشد");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team || team.ownerId !== userId) throw new Error("فقط مالک تیم می‌تواند ثبت‌نام کند");
  if (team.isSuspended) throw new Error("تیم تعلیق شده و مجاز به شرکت در رقابت نیست");
  await assertTeamCompetitionRegistrationAllowed(userId, competitionId, teamId);
  if (team.members.length < comp.minTeamSize) {
    throw new Error(`حداقل ${comp.minTeamSize} عضو لازم است`);
  }

  const existing = await prisma.teamCompetitionEntry.findUnique({
    where: { teamCompetitionId_teamId: { teamCompetitionId: competitionId, teamId } },
  });
  if (existing) throw new Error("تیم قبلاً ثبت‌نام کرده");

  const entry = await prisma.teamCompetitionEntry.create({
    data: { teamCompetitionId: competitionId, teamId },
  });

  await prisma.userProfile.update({
    where: { userId },
    data: { teamCompetitionsEntered: { increment: 1 } },
  });

  return entry;
}

export async function getHomeSliders(userId: string) {
  const [cups, tournaments, upcomingTeams, activeTeams] = await Promise.all([
    listCups(userId, "upcoming"),
    listTournaments(userId, "upcoming"),
    loadTeamCompetitionSlider(userId, "upcoming"),
    loadTeamCompetitionSlider(userId, "active"),
  ]);
  const teamById = new Map<string, Record<string, unknown>>();
  for (const item of [...upcomingTeams, ...activeTeams]) {
    if (item && typeof item === "object" && "id" in item) {
      teamById.set(String((item as { id: string }).id), item as Record<string, unknown>);
    }
  }
  return {
    cups: cups.slice(0, 5),
    tournaments: tournaments.slice(0, 5),
    teamCompetitions: Array.from(teamById.values()).slice(0, 8),
  };
}

async function loadTeamCompetitionSlider(
  userId: string,
  filter: "upcoming" | "active",
): Promise<Array<Record<string, unknown>>> {
  try {
    const { listTeamCompetitionsForUser } = await import(
      "@/server/services/team-competition-user-service"
    );
    const items = await listTeamCompetitionsForUser(userId, filter);
    return items.filter((item) => item != null) as Array<Record<string, unknown>>;
  } catch (error) {
    console.error("[Bordin] team competition slider unavailable:", error);
    return [];
  }
}

export { getRewardFromTable, addPredictionRewardCoins, addXp };
