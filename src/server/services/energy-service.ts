import { EnergyLedgerEventType as PrismaEnergyLedgerEventType, Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { countSuccessfulInvites } from "@/server/services/invite-service";
import {
  DEFAULT_ENERGY_COSTS,
  ENERGY_ACTIVITIES,
  ENERGY_ACTIVITY_COUNTER_KEYS,
  ENERGY_AUTO_RECOVERY_HOURS,
  ENERGY_AUTO_RECOVERY_PERCENT,
  ENERGY_INSUFFICIENT_CODE,
  ENERGY_INVITE_RECOVERY_MAX_INVITES,
  ENERGY_INVITE_RECOVERY_PERCENT,
  ENERGY_MAX_PERCENT,
  ENERGY_RECOVERY_MODE_DEFAULT,
  ENERGY_RECOVERY_MODE_INVITE,
  type EnergyActivity,
  type EnergyCostsMap,
  type EnergyLedgerEventType,
} from "@/shared/constants/energy";
import type {
  EnergyConfigView,
  EnergyInsufficientMeta,
  EnergyUserView,
} from "@/shared/types/energy";

type EnergyRow = {
  userId: string;
  energyPercent: number;
  lastAutoRecoveryAt: Date;
  autoRecoveredPercent: number;
  inviteRecoveredPercent: number;
  predictionCount: number;
  teamCompetitionRegCount: number;
  cupRegCount: number;
  tournamentRegCount: number;
  teamCreationCount: number;
  privateChatCount: number;
  teamJoinRequestCount: number;
  teamMemberSelectionCount: number;
  luckyWheelSpinCount: number;
};

type EnergyConfigState = {
  costs: EnergyCostsMap;
  inviteRecoveryEnabled: boolean;
};

type EnergyLedgerWrite = {
  userId: string;
  eventType: EnergyLedgerEventType;
  energyBefore: number;
  energyChange: number;
  energyAfter: number;
  activity?: EnergyActivity | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type MemoryLedgerEntry = EnergyLedgerWrite & {
  id: string;
  createdAt: Date;
};

const memoryEnergyByUser = new Map<string, EnergyRow>();
const memoryEnergyLedger: MemoryLedgerEntry[] = [];
let memoryEnergyConfig: EnergyConfigState | null = null;

function clampPercent(value: number) {
  return Math.min(ENERGY_MAX_PERCENT, Math.max(0, value));
}

function emptyCosts(): EnergyCostsMap {
  return { ...DEFAULT_ENERGY_COSTS };
}

function normalizeCosts(raw: unknown): EnergyCostsMap {
  const base = emptyCosts();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const activity of ENERGY_ACTIVITIES) {
    const value = obj[activity];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      base[activity] = value;
    }
  }
  return base;
}

function sumCosts(costs: EnergyCostsMap) {
  return ENERGY_ACTIVITIES.reduce((sum, activity) => sum + (costs[activity] ?? 0), 0);
}

function getCounter(row: EnergyRow, activity: EnergyActivity) {
  return row[ENERGY_ACTIVITY_COUNTER_KEYS[activity]];
}

function setCounter(row: EnergyRow, activity: EnergyActivity, value: number) {
  row[ENERGY_ACTIVITY_COUNTER_KEYS[activity]] = value;
}

function computeConsumed(row: EnergyRow, costs: EnergyCostsMap) {
  return ENERGY_ACTIVITIES.reduce(
    (sum, activity) => sum + getCounter(row, activity) * (costs[activity] ?? 0),
    0,
  );
}

function computeEnergyPercent(row: EnergyRow, costs: EnergyCostsMap) {
  const consumed = computeConsumed(row, costs);
  const recovered = row.autoRecoveredPercent + row.inviteRecoveredPercent;
  return clampPercent(ENERGY_MAX_PERCENT - consumed + recovered);
}

function createDefaultRow(userId: string, now = new Date()): EnergyRow {
  return {
    userId,
    energyPercent: ENERGY_MAX_PERCENT,
    lastAutoRecoveryAt: now,
    autoRecoveredPercent: 0,
    inviteRecoveredPercent: 0,
    predictionCount: 0,
    teamCompetitionRegCount: 0,
    cupRegCount: 0,
    tournamentRegCount: 0,
    teamCreationCount: 0,
    privateChatCount: 0,
    teamJoinRequestCount: 0,
    teamMemberSelectionCount: 0,
    luckyWheelSpinCount: 0,
  };
}

function applyPendingAutoRecovery(row: EnergyRow, now = new Date()) {
  const intervalMs = ENERGY_AUTO_RECOVERY_HOURS * 60 * 60 * 1000;
  let cursor = row.lastAutoRecoveryAt.getTime();
  const nowMs = now.getTime();
  let ticks = 0;

  while (cursor + intervalMs <= nowMs) {
    cursor += intervalMs;
    ticks += 1;
  }

  if (ticks > 0) {
    row.autoRecoveredPercent += ticks * ENERGY_AUTO_RECOVERY_PERCENT;
    row.lastAutoRecoveryAt = new Date(cursor);
  }

  return ticks;
}

/** Append-only ledger write. Skips no-op (zero) changes. Never updates existing rows. */
async function appendEnergyLedger(entry: EnergyLedgerWrite) {
  if (!Number.isFinite(entry.energyChange) || entry.energyChange === 0) return;

  if (await shouldUseMemoryDb()) {
    memoryEnergyLedger.push({
      ...entry,
      id: `energy-ledger-${Date.now()}-${memoryEnergyLedger.length}`,
      createdAt: new Date(),
    });
    return;
  }

  await prisma.energyLedgerEntry.create({
    data: {
      userId: entry.userId,
      eventType: entry.eventType as PrismaEnergyLedgerEventType,
      energyBefore: entry.energyBefore,
      energyChange: entry.energyChange,
      energyAfter: entry.energyAfter,
      activity: entry.activity ?? null,
      referenceId: entry.referenceId ?? null,
      metadata:
        entry.metadata == null
          ? undefined
          : (entry.metadata as Prisma.InputJsonValue),
    },
  });
}

export class EnergyInsufficientError extends Error {
  readonly code = ENERGY_INSUFFICIENT_CODE;
  readonly meta: EnergyInsufficientMeta;

  constructor(meta: EnergyInsufficientMeta) {
    super("سطح انرژی فوتبالیت تموم شده!");
    this.name = "EnergyInsufficientError";
    this.meta = meta;
  }
}

function toConfigView(state: EnergyConfigState): EnergyConfigView {
  const recoveryModes: EnergyConfigView["recoveryModes"] = [ENERGY_RECOVERY_MODE_DEFAULT];
  if (state.inviteRecoveryEnabled) {
    recoveryModes.push(ENERGY_RECOVERY_MODE_INVITE);
  }
  return {
    costs: state.costs,
    inviteRecoveryEnabled: state.inviteRecoveryEnabled,
    recoveryModes,
    totalConsumptionPercent: sumCosts(state.costs),
  };
}

async function loadConfig(): Promise<EnergyConfigState> {
  if (await shouldUseMemoryDb()) {
    if (!memoryEnergyConfig) {
      memoryEnergyConfig = {
        costs: emptyCosts(),
        inviteRecoveryEnabled: false,
      };
    }
    return {
      costs: { ...memoryEnergyConfig.costs },
      inviteRecoveryEnabled: memoryEnergyConfig.inviteRecoveryEnabled,
    };
  }

  const row = await prisma.energyConfig.findUnique({ where: { id: "default" } });
  if (!row) {
    return { costs: emptyCosts(), inviteRecoveryEnabled: false };
  }
  return {
    costs: normalizeCosts(row.costs),
    inviteRecoveryEnabled: row.inviteRecoveryEnabled,
  };
}

async function saveConfig(state: EnergyConfigState) {
  if (await shouldUseMemoryDb()) {
    memoryEnergyConfig = {
      costs: { ...state.costs },
      inviteRecoveryEnabled: state.inviteRecoveryEnabled,
    };
    return;
  }

  await prisma.energyConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      costs: state.costs,
      inviteRecoveryEnabled: state.inviteRecoveryEnabled,
    },
    update: {
      costs: state.costs,
      inviteRecoveryEnabled: state.inviteRecoveryEnabled,
    },
  });
}

async function loadRow(userId: string): Promise<EnergyRow> {
  if (await shouldUseMemoryDb()) {
    const existing = memoryEnergyByUser.get(userId);
    if (existing) return { ...existing };
    const created = createDefaultRow(userId);
    memoryEnergyByUser.set(userId, created);
    return { ...created };
  }

  const existing = await prisma.userEnergy.findUnique({ where: { userId } });
  if (existing) {
    return {
      userId: existing.userId,
      energyPercent: existing.energyPercent,
      lastAutoRecoveryAt: existing.lastAutoRecoveryAt,
      autoRecoveredPercent: existing.autoRecoveredPercent,
      inviteRecoveredPercent: existing.inviteRecoveredPercent,
      predictionCount: existing.predictionCount,
      teamCompetitionRegCount: existing.teamCompetitionRegCount,
      cupRegCount: existing.cupRegCount,
      tournamentRegCount: existing.tournamentRegCount,
      teamCreationCount: existing.teamCreationCount,
      privateChatCount: existing.privateChatCount,
      teamJoinRequestCount: existing.teamJoinRequestCount,
      teamMemberSelectionCount: existing.teamMemberSelectionCount,
      luckyWheelSpinCount: existing.luckyWheelSpinCount,
    };
  }

  const created = await prisma.userEnergy.create({
    data: { userId, energyPercent: ENERGY_MAX_PERCENT },
  });
  return {
    userId: created.userId,
    energyPercent: created.energyPercent,
    lastAutoRecoveryAt: created.lastAutoRecoveryAt,
    autoRecoveredPercent: created.autoRecoveredPercent,
    inviteRecoveredPercent: created.inviteRecoveredPercent,
    predictionCount: created.predictionCount,
    teamCompetitionRegCount: created.teamCompetitionRegCount,
    cupRegCount: created.cupRegCount,
    tournamentRegCount: created.tournamentRegCount,
    teamCreationCount: created.teamCreationCount,
    privateChatCount: created.privateChatCount,
    teamJoinRequestCount: created.teamJoinRequestCount,
    teamMemberSelectionCount: created.teamMemberSelectionCount,
    luckyWheelSpinCount: created.luckyWheelSpinCount,
  };
}

async function persistRow(row: EnergyRow) {
  if (await shouldUseMemoryDb()) {
    memoryEnergyByUser.set(row.userId, { ...row });
    return;
  }

  await prisma.userEnergy.upsert({
    where: { userId: row.userId },
    create: {
      userId: row.userId,
      energyPercent: row.energyPercent,
      lastAutoRecoveryAt: row.lastAutoRecoveryAt,
      autoRecoveredPercent: row.autoRecoveredPercent,
      inviteRecoveredPercent: row.inviteRecoveredPercent,
      predictionCount: row.predictionCount,
      teamCompetitionRegCount: row.teamCompetitionRegCount,
      cupRegCount: row.cupRegCount,
      tournamentRegCount: row.tournamentRegCount,
      teamCreationCount: row.teamCreationCount,
      privateChatCount: row.privateChatCount,
      teamJoinRequestCount: row.teamJoinRequestCount,
      teamMemberSelectionCount: row.teamMemberSelectionCount,
      luckyWheelSpinCount: row.luckyWheelSpinCount,
    },
    update: {
      energyPercent: row.energyPercent,
      lastAutoRecoveryAt: row.lastAutoRecoveryAt,
      autoRecoveredPercent: row.autoRecoveredPercent,
      inviteRecoveredPercent: row.inviteRecoveredPercent,
      predictionCount: row.predictionCount,
      teamCompetitionRegCount: row.teamCompetitionRegCount,
      cupRegCount: row.cupRegCount,
      tournamentRegCount: row.tournamentRegCount,
      teamCreationCount: row.teamCreationCount,
      privateChatCount: row.privateChatCount,
      teamJoinRequestCount: row.teamJoinRequestCount,
      teamMemberSelectionCount: row.teamMemberSelectionCount,
      luckyWheelSpinCount: row.luckyWheelSpinCount,
    },
  });
}

async function refreshRow(userId: string, costs: EnergyCostsMap): Promise<EnergyRow> {
  const row = await loadRow(userId);
  const energyBefore = row.energyPercent;
  const ticks = applyPendingAutoRecovery(row);
  row.energyPercent = computeEnergyPercent(row, costs);
  await persistRow(row);

  if (ticks > 0) {
    await appendEnergyLedger({
      userId,
      eventType: "ENERGY_RECOVERED_BY_TIME",
      energyBefore,
      energyChange: row.energyPercent - energyBefore,
      energyAfter: row.energyPercent,
      metadata: {
        ticks,
        recoveryPercentPerTick: ENERGY_AUTO_RECOVERY_PERCENT,
        hoursPerTick: ENERGY_AUTO_RECOVERY_HOURS,
      },
    });
  }

  return row;
}

function nextAutoRecoveryAt(row: EnergyRow) {
  const next = new Date(
    row.lastAutoRecoveryAt.getTime() + ENERGY_AUTO_RECOVERY_HOURS * 60 * 60 * 1000,
  );
  return next.toISOString();
}

export async function ensureUserEnergy(userId: string) {
  const config = await loadConfig();
  return refreshRow(userId, config.costs);
}

export async function getEnergyConfig(): Promise<EnergyConfigView> {
  return toConfigView(await loadConfig());
}

export async function getUserEnergyView(userId: string): Promise<EnergyUserView> {
  const config = await loadConfig();
  const row = await refreshRow(userId, config.costs);
  const successfulInviteCount = await countSuccessfulInvites(userId);
  return {
    energyPercent: row.energyPercent,
    inviteRecoveryEnabled: config.inviteRecoveryEnabled,
    successfulInviteCount,
    inviteRecoveryCap: ENERGY_INVITE_RECOVERY_MAX_INVITES,
    nextAutoRecoveryAt: nextAutoRecoveryAt(row),
  };
}

export async function consumeEnergy(userId: string, activity: EnergyActivity) {
  const config = await loadConfig();
  const cost = config.costs[activity] ?? 0;
  const row = await refreshRow(userId, config.costs);

  if (cost > 0 && row.energyPercent < cost) {
    const successfulInviteCount = await countSuccessfulInvites(userId);
    throw new EnergyInsufficientError({
      energyPercent: row.energyPercent,
      requiredPercent: cost,
      inviteRecoveryEnabled: config.inviteRecoveryEnabled,
      successfulInviteCount,
      inviteRecoveryCap: ENERGY_INVITE_RECOVERY_MAX_INVITES,
    });
  }

  const energyBefore = row.energyPercent;
  setCounter(row, activity, getCounter(row, activity) + 1);
  row.energyPercent = computeEnergyPercent(row, config.costs);
  await persistRow(row);

  await appendEnergyLedger({
    userId,
    eventType: "ENERGY_CONSUMED",
    energyBefore,
    energyChange: row.energyPercent - energyBefore,
    energyAfter: row.energyPercent,
    activity,
    metadata: { cost },
  });

  return {
    energyPercent: row.energyPercent,
    cost,
  };
}

/**
 * Grant purchased Football Energy. Caps at 100%; excess is discarded (no storage).
 */
export async function grantPurchasedEnergy(userId: string, percent: number) {
  const add = Math.floor(percent);
  if (add <= 0) return { energyPercent: 0, granted: 0 };

  const config = await loadConfig();
  const row = await refreshRow(userId, config.costs);
  const energyBefore = row.energyPercent;
  const room = Math.max(0, ENERGY_MAX_PERCENT - energyBefore);
  const granted = Math.min(room, add);

  if (granted <= 0) {
    return { energyPercent: energyBefore, granted: 0 };
  }

  row.autoRecoveredPercent += granted;
  row.energyPercent = computeEnergyPercent(row, config.costs);
  await persistRow(row);

  await appendEnergyLedger({
    userId,
    eventType: "ENERGY_PURCHASED",
    energyBefore,
    energyChange: row.energyPercent - energyBefore,
    energyAfter: row.energyPercent,
    metadata: { requestedPercent: add, grantedPercent: granted },
  });

  return { energyPercent: row.energyPercent, granted };
}

/** Apply invite-based recovery for the inviter (additive to auto recovery). */
export async function applyInviteEnergyRecovery(inviterId: string) {
  const config = await loadConfig();
  if (!config.inviteRecoveryEnabled) return null;

  const row = await refreshRow(inviterId, config.costs);
  const inviteCount = await countSuccessfulInvites(inviterId);
  const eligible = Math.min(inviteCount, ENERGY_INVITE_RECOVERY_MAX_INVITES);
  const targetRecovered = eligible * ENERGY_INVITE_RECOVERY_PERCENT;

  if (targetRecovered <= row.inviteRecoveredPercent) {
    return { energyPercent: row.energyPercent, applied: false };
  }

  const energyBefore = row.energyPercent;
  row.inviteRecoveredPercent = targetRecovered;
  row.energyPercent = computeEnergyPercent(row, config.costs);
  await persistRow(row);

  await appendEnergyLedger({
    userId: inviterId,
    eventType: "ENERGY_RECOVERED_BY_INVITE",
    energyBefore,
    energyChange: row.energyPercent - energyBefore,
    energyAfter: row.energyPercent,
    metadata: {
      inviteCount,
      eligible,
      inviteRecoveredPercent: row.inviteRecoveredPercent,
    },
  });

  return { energyPercent: row.energyPercent, applied: true };
}

export async function applyEnergyConfig(input: {
  costs: Partial<EnergyCostsMap>;
  inviteRecoveryEnabled: boolean;
}) {
  const costs = emptyCosts();
  for (const activity of ENERGY_ACTIVITIES) {
    const value = input.costs[activity];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      costs[activity] = value;
    }
  }

  const state: EnergyConfigState = {
    costs,
    inviteRecoveryEnabled: Boolean(input.inviteRecoveryEnabled),
  };
  await saveConfig(state);

  const recalculateUser = async (row: EnergyRow) => {
    const energyBefore = row.energyPercent;
    const ticks = applyPendingAutoRecovery(row);
    let inviteAdjusted = false;
    if (state.inviteRecoveryEnabled) {
      const inviteCount = await countSuccessfulInvites(row.userId);
      const eligible = Math.min(inviteCount, ENERGY_INVITE_RECOVERY_MAX_INVITES);
      const target = eligible * ENERGY_INVITE_RECOVERY_PERCENT;
      if (target > row.inviteRecoveredPercent) {
        row.inviteRecoveredPercent = target;
        inviteAdjusted = true;
      }
    }
    row.energyPercent = computeEnergyPercent(row, costs);
    await persistRow(row);

    await appendEnergyLedger({
      userId: row.userId,
      eventType: "ENERGY_ADJUSTED_BY_ADMIN",
      energyBefore,
      energyChange: row.energyPercent - energyBefore,
      energyAfter: row.energyPercent,
      metadata: {
        source: "admin_recalculate",
        ticks,
        inviteAdjusted,
        inviteRecoveryEnabled: state.inviteRecoveryEnabled,
      },
    });
  };

  if (await shouldUseMemoryDb()) {
    for (const userId of memoryEnergyByUser.keys()) {
      const row = memoryEnergyByUser.get(userId);
      if (!row) continue;
      await recalculateUser(row);
    }
  } else {
    const rows = await prisma.userEnergy.findMany();
    for (const existing of rows) {
      const row: EnergyRow = {
        userId: existing.userId,
        energyPercent: existing.energyPercent,
        lastAutoRecoveryAt: existing.lastAutoRecoveryAt,
        autoRecoveredPercent: existing.autoRecoveredPercent,
        inviteRecoveredPercent: existing.inviteRecoveredPercent,
        predictionCount: existing.predictionCount,
        teamCompetitionRegCount: existing.teamCompetitionRegCount,
        cupRegCount: existing.cupRegCount,
        tournamentRegCount: existing.tournamentRegCount,
        teamCreationCount: existing.teamCreationCount,
        privateChatCount: existing.privateChatCount,
        teamJoinRequestCount: existing.teamJoinRequestCount,
        teamMemberSelectionCount: existing.teamMemberSelectionCount,
        luckyWheelSpinCount: existing.luckyWheelSpinCount,
      };
      await recalculateUser(row);
    }
  }

  return toConfigView(state);
}

export function energyErrorToResponse(error: unknown) {
  if (error instanceof EnergyInsufficientError) {
    return {
      status: 403 as const,
      body: {
        error: error.message,
        code: error.code,
        energy: error.meta,
      },
    };
  }
  return null;
}
