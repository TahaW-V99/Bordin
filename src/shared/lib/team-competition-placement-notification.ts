export const TC_PLACEMENT_REWARDS_MARKER = "\n::tc-rewards::\n";

export type TeamCompPlacementTrophy = "gold" | "silver";

export type TeamCompPlacementRewardsPayload = {
  coinsPerMember: number;
  medalTitles: string[];
  trophy: TeamCompPlacementTrophy;
};

export function buildPlacementNotificationBody(
  message: string,
  rewards: TeamCompPlacementRewardsPayload,
): string {
  return `${message}${TC_PLACEMENT_REWARDS_MARKER}${JSON.stringify(rewards)}`;
}

export function parsePlacementNotificationBody(bodyFa: string | null): {
  message: string | null;
  rewards: TeamCompPlacementRewardsPayload | null;
} {
  if (!bodyFa) return { message: null, rewards: null };

  const markerIndex = bodyFa.indexOf(TC_PLACEMENT_REWARDS_MARKER);
  if (markerIndex === -1) return { message: bodyFa, rewards: null };

  const message = bodyFa.slice(0, markerIndex);
  const raw = bodyFa.slice(markerIndex + TC_PLACEMENT_REWARDS_MARKER.length);

  try {
    const parsed = JSON.parse(raw) as TeamCompPlacementRewardsPayload;
    if (
      typeof parsed.coinsPerMember !== "number" ||
      !Array.isArray(parsed.medalTitles) ||
      (parsed.trophy !== "gold" && parsed.trophy !== "silver")
    ) {
      return { message: bodyFa, rewards: null };
    }
    return { message, rewards: parsed };
  } catch {
    return { message: bodyFa, rewards: null };
  }
}
