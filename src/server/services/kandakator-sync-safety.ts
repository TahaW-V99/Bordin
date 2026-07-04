/**
 * Data-loss prevention for kandakator sync.
 * Default mode is append/update-only — never delete existing conductor data.
 */

export type KandakatorSyncWriteMode = "safe" | "full_rebuild";

export type KandakatorSyncSafetyOptions = {
  publish?: boolean;
  source?: string;
  /**
   * Admin-only full rebuild. When false (default), empty/partial API responses
   * must never delete or overwrite existing matches with an empty dataset.
   */
  allowFullRebuild?: boolean;
};

export function resolveKandakatorSyncWriteMode(
  options?: KandakatorSyncSafetyOptions,
): KandakatorSyncWriteMode {
  return options?.allowFullRebuild === true ? "full_rebuild" : "safe";
}

export function canDeleteKandakatorData(options?: KandakatorSyncSafetyOptions) {
  return resolveKandakatorSyncWriteMode(options) === "full_rebuild";
}

export function logKandakatorSyncPreserved(input: {
  dateKey: string;
  reason: "empty_api_response" | "invalid_api_response" | "partial_api_response";
  existingCount: number;
  fetchedCount: number;
  source: string;
}) {
  console.warn(
    "[Bordin:sync-safety]",
    JSON.stringify({
      event: "preserved_existing_data",
      ...input,
    }),
  );
}

export function isEmptyApiPayload(matchCount: number) {
  return matchCount === 0;
}

export function isSuspiciousPartialFetch(fetchedCount: number, existingCount: number) {
  if (existingCount === 0) return false;
  if (fetchedCount === 0) return true;
  // A sudden drop to a tiny fraction of prior data often indicates API glitch.
  return fetchedCount < Math.max(1, Math.floor(existingCount * 0.25));
}
