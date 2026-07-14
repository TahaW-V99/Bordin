export type WatchPartyUiPhase = "hidden" | "upcoming" | "active";

const ACTIVATE_BEFORE_MS = 30 * 60 * 1000;
const VISIBLE_AFTER_ACTIVATE_MS = 120 * 60 * 1000;
const INVITE_CUTOFF_AFTER_KICKOFF_MS = 70 * 60 * 1000;

export function getWatchPartyActivateAt(kickoffAt: Date | string) {
  return new Date(kickoffAt).getTime() - ACTIVATE_BEFORE_MS;
}

export function getWatchPartyHideAt(kickoffAt: Date | string) {
  return getWatchPartyActivateAt(kickoffAt) + VISIBLE_AFTER_ACTIVATE_MS;
}

export function getWatchPartyUiPhase(
  kickoffAt: Date | string,
  now = Date.now(),
  options?: { forceActive?: boolean },
): WatchPartyUiPhase {
  const hideAt = getWatchPartyHideAt(kickoffAt);
  const activateAt = getWatchPartyActivateAt(kickoffAt);
  if (now >= hideAt) return "hidden";
  if (options?.forceActive || now >= activateAt) return "active";
  return "upcoming";
}

export function canSendWatchPartyInvite(kickoffAt: Date | string, now = Date.now()) {
  const kickoff = new Date(kickoffAt).getTime();
  return now < kickoff + INVITE_CUTOFF_AFTER_KICKOFF_MS;
}
