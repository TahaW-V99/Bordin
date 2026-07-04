import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import type { Prisma } from "@prisma/client";
import { logSyncEvent } from "@/server/services/match-lifecycle-logger";

export type SyncHealthStatus = "success" | "partial" | "failed";

export type RecordSyncInput = {
  scope: string;
  status: SyncHealthStatus;
  source: string;
  matchCount?: number;
  settledCount?: number;
  staleCount?: number;
  orphanCount?: number;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

export async function recordKandakatorSync(input: RecordSyncInput) {
  await logSyncEvent(input);

  if (await shouldUseMemoryDb()) {
    return { id: "memory", ...input };
  }

  return prisma.kandakatorSyncRecord.create({
    data: {
      scope: input.scope,
      status: input.status,
      source: input.source,
      matchCount: input.matchCount ?? 0,
      settledCount: input.settledCount ?? 0,
      staleCount: input.staleCount ?? 0,
      orphanCount: input.orphanCount ?? 0,
      errorMessage: input.errorMessage,
      durationMs: input.durationMs,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function getKandakatorSyncHealth() {
  if (await shouldUseMemoryDb()) {
    return {
      lastSuccess: null,
      lastFailure: null,
      recentRecords: [] as Array<{
        scope: string;
        status: string;
        source: string;
        matchCount: number;
        createdAt: Date;
        errorMessage: string | null;
      }>,
      staleMatchCount: 0,
      unsettledPredictionCount: 0,
    };
  }

  const [lastSuccess, lastFailure, recentRecords, staleMatchCount, unsettledPredictionCount] =
    await Promise.all([
      prisma.kandakatorSyncRecord.findFirst({
        where: { status: "success" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.kandakatorSyncRecord.findFirst({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.kandakatorSyncRecord.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          scope: true,
          status: true,
          source: true,
          matchCount: true,
          settledCount: true,
          staleCount: true,
          orphanCount: true,
          durationMs: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.footballMatch.count({
        where: {
          kickoffAt: { lte: new Date() },
          status: { notIn: ["CANCELLED", "POSTPONED"] },
          OR: [{ homeScore: null }, { awayScore: null }],
        },
      }),
      prisma.prediction.count({
        where: {
          scoredAt: null,
          match: {
            homeScore: { not: null },
            awayScore: { not: null },
          },
        },
      }),
    ]);

  return {
    lastSuccess,
    lastFailure,
    recentRecords,
    staleMatchCount,
    unsettledPredictionCount,
  };
}
