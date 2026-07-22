import type { EnergyActivity, EnergyCostsMap, EnergyRecoveryMode } from "@/shared/constants/energy";

export type EnergyConfigView = {
  costs: EnergyCostsMap;
  inviteRecoveryEnabled: boolean;
  /** Always includes default auto recovery; invite is additive when enabled. */
  recoveryModes: EnergyRecoveryMode[];
  totalConsumptionPercent: number;
};

export type EnergyUserView = {
  energyPercent: number;
  inviteRecoveryEnabled: boolean;
  successfulInviteCount: number;
  inviteRecoveryCap: number;
  nextAutoRecoveryAt: string | null;
};

export type EnergyInsufficientMeta = {
  energyPercent: number;
  requiredPercent: number;
  inviteRecoveryEnabled: boolean;
  successfulInviteCount: number;
  inviteRecoveryCap: number;
};

export type EnergyActivityCounts = Record<EnergyActivity, number>;
