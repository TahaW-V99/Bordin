import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

export async function requireAdmin(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.findById(userId);
    if (!user || user.role !== "admin") throw new Error("دسترسی ادمین ندارید");
    return user;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "admin") throw new Error("دسترسی ادمین ندارید");
  return user;
}

export async function getAdminDashboard() {
  if (await shouldUseMemoryDb()) {
    const cd = (globalThis as unknown as { __bordinDevDb?: { competitionData: unknown; users: Map<string, unknown> } }).__bordinDevDb;
    return {
      usersCount: cd?.users.size ?? 0,
      cupsCount: (cd?.competitionData as { cups: unknown[] })?.cups?.length ?? 0,
      tournamentsCount: (cd?.competitionData as { tournaments: unknown[] })?.tournaments?.length ?? 0,
      teamCompsCount: (cd?.competitionData as { teamCompetitions: unknown[] })?.teamCompetitions?.length ?? 0,
    };
  }

  const [usersCount, cupsCount, tournamentsCount, teamCompsCount] = await Promise.all([
    prisma.user.count(),
    prisma.cup.count(),
    prisma.tournament.count(),
    prisma.teamCompetition.count(),
  ]);

  return { usersCount, cupsCount, tournamentsCount, teamCompsCount };
}

export async function listAdminUsers() {
  if (await shouldUseMemoryDb()) {
    return Array.from(
      ((globalThis as unknown as { __bordinDevDb?: { users: Map<string, { id: string; phone: string; username: string; role: string }> } }).__bordinDevDb?.users.values() ?? []),
    );
  }
  return prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    select: { id: true, phone: true, username: true, role: true, createdAt: true },
  });
}

export async function listAdminCups() {
  if (await shouldUseMemoryDb()) {
    return (globalThis as unknown as { __bordinDevDb?: { competitionData: { cups: unknown[] } } }).__bordinDevDb?.competitionData.cups ?? [];
  }
  return prisma.cup.findMany({ include: { match: true }, orderBy: { createdAt: "desc" } });
}

export async function toggleCupPublish(cupId: string, isPublished: boolean) {
  if (await shouldUseMemoryDb()) {
    const cups = (globalThis as unknown as { __bordinDevDb?: { competitionData: { cups: Array<{ id: string; isPublished: boolean }> } } }).__bordinDevDb?.competitionData.cups;
    const cup = cups?.find((c) => c.id === cupId);
    if (cup) cup.isPublished = isPublished;
    return cup;
  }
  return prisma.cup.update({ where: { id: cupId }, data: { isPublished } });
}
