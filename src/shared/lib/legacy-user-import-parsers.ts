import { MEDAL_CATALOG } from "@/shared/constants/medals";
import { MISSION_DEFINITIONS } from "@/shared/constants/missions";

const NONE_VALUES = new Set(["ندارد", "نداره", "خالی", ""]);

const CUP_TITLE_TO_SLUG = Object.fromEntries(
  MEDAL_CATALOG.filter((m) => m.category === "CUP").map((m) => [m.titleFa, m.slug]),
);

const TOURNAMENT_TITLE_TO_SLUG = Object.fromEntries(
  MEDAL_CATALOG.filter((m) => m.category === "TOURNAMENT").map((m) => [m.titleFa, m.slug]),
);

export function isLegacyNoneValue(value: string) {
  return NONE_VALUES.has(value.trim());
}

export function splitLegacyMedalLabels(value: string) {
  if (isLegacyNoneValue(value)) return [];
  return value
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !isLegacyNoneValue(part));
}

function resolveTitleToSlug(
  label: string,
  map: Record<string, string>,
): string | null {
  if (map[label]) return map[label];
  const normalized = label.replace(/\s+/g, " ").trim();
  return map[normalized] ?? null;
}

export function parseCupMedalSlugs(value: string): string[] {
  const labels = splitLegacyMedalLabels(value);
  if (labels.length === 0 && !isLegacyNoneValue(value)) {
    const single = resolveTitleToSlug(value.trim(), CUP_TITLE_TO_SLUG);
    return single ? [single] : [];
  }
  return [...new Set(labels.map((label) => resolveTitleToSlug(label, CUP_TITLE_TO_SLUG)).filter(Boolean) as string[])];
}

export function parseTournamentMedalSlugs(value: string): string[] {
  const labels = splitLegacyMedalLabels(value);
  if (labels.length === 0 && !isLegacyNoneValue(value)) {
    const single = resolveTitleToSlug(value.trim(), TOURNAMENT_TITLE_TO_SLUG);
    return single ? [single] : [];
  }
  return [
    ...new Set(
      labels
        .map((label) => resolveTitleToSlug(label, TOURNAMENT_TITLE_TO_SLUG))
        .filter(Boolean) as string[],
    ),
  ];
}

export function resolveMinimumMissionProgress(honorMedals: string) {
  if (isLegacyNoneValue(honorMedals)) {
    return { totalPredictions: 0, perfectPredictions: 0 };
  }

  const labels = splitLegacyMedalLabels(honorMedals);
  const searchLabels = labels.length > 0 ? labels : [honorMedals.trim()];

  let totalPredictions = 0;
  let perfectPredictions = 0;

  for (const label of searchLabels) {
    for (const mission of MISSION_DEFINITIONS) {
      if (mission.slug === "davat") continue;

      for (const tier of mission.tiers) {
        const medalTitle = tier.medalSlug
          ? MEDAL_CATALOG.find((m) => m.slug === tier.medalSlug)?.titleFa
          : null;
        const matches =
          label.includes(mission.titleFa) ||
          label.includes(tier.tierLabelFa) ||
          (medalTitle ? label.includes(medalTitle) : false);

        if (!matches) continue;

        if (mission.progressSource === "total_predictions") {
          totalPredictions = Math.max(totalPredictions, tier.threshold);
        } else if (mission.progressSource === "perfect_predictions") {
          perfectPredictions = Math.max(perfectPredictions, tier.threshold);
        }
      }
    }
  }

  return { totalPredictions, perfectPredictions };
}

/** Legacy Excel phones are stored as 9374425794; app users may be stored as 09374425794. */
export function legacyPhoneToLookupPhones(legacyPhone: string) {
  const trimmed = legacyPhone.trim();
  const phones = new Set<string>([trimmed]);
  if (/^9\d{9}$/.test(trimmed)) {
    phones.add(`0${trimmed}`);
  }
  if (/^09\d{9}$/.test(trimmed)) {
    phones.add(trimmed.slice(1));
  }
  return [...phones];
}

export function appPhoneToLegacyPhone(appPhone: string) {
  const trimmed = appPhone.trim();
  if (/^09\d{9}$/.test(trimmed)) return trimmed.slice(1);
  return trimmed;
}

export function legacyInviteStubPhone(legacyPhone: string, index: number) {
  return `legacy-inv-${legacyPhone}-${index}`;
}
