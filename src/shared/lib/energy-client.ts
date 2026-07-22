import { ENERGY_INSUFFICIENT_CODE, ENERGY_UPDATED_EVENT } from "@/shared/constants/energy";
import type { EnergyInsufficientMeta } from "@/shared/types/energy";

export const ENERGY_DEPLETED_EVENT = "bordin:energy-depleted";

export function dispatchEnergyUpdated(energyPercent?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ENERGY_UPDATED_EVENT, {
      detail: typeof energyPercent === "number" ? { energyPercent } : undefined,
    }),
  );
}

export function dispatchEnergyDepleted(meta: EnergyInsufficientMeta) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ENERGY_DEPLETED_EVENT, { detail: meta }));
}

export function isEnergyInsufficientResponse(data: unknown): data is {
  code: typeof ENERGY_INSUFFICIENT_CODE;
  energy: EnergyInsufficientMeta;
  error?: string;
} {
  if (!data || typeof data !== "object") return false;
  const row = data as { code?: string; energy?: EnergyInsufficientMeta };
  return row.code === ENERGY_INSUFFICIENT_CODE && Boolean(row.energy);
}

/** Call after a failed API response JSON parse. Returns true if handled. */
export function handleEnergyApiError(data: unknown): boolean {
  if (!isEnergyInsufficientResponse(data)) return false;
  dispatchEnergyDepleted(data.energy);
  return true;
}
