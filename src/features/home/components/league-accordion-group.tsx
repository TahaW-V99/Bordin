"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { MatchPredictionCard } from "@/features/predictions/components/match-prediction-card";
import type { ClientKandakatorMatch } from "@/shared/lib/kandakator-utils";

export function LeagueAccordionGroup({
  leagueName,
  matches,
  kandakatorId,
  entryFeeCoins,
  perfectReward,
  needsDisplayName,
  onDisplayNameRequired,
  onSubmitted,
  autoOpenWatchPartyMatchId,
  onWatchPartyAutoOpened,
  defaultOpen = true,
}: {
  leagueName: string;
  matches: ClientKandakatorMatch[];
  kandakatorId: string;
  entryFeeCoins: number;
  perfectReward: { coins: number; xp: number };
  needsDisplayName: boolean;
  onDisplayNameRequired: () => void;
  onSubmitted: () => void;
  autoOpenWatchPartyMatchId?: string | null;
  onWatchPartyAutoOpened?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
      >
        <span className="font-semibold text-white">{leagueName}</span>
        <div className="flex items-center gap-2 text-xs text-white/45">
          <span>{matches.length} بازی</span>
          <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
        </div>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-white/8 p-3">
          {matches.map((km) => (
            <MatchPredictionCard
              key={km.id}
              matchId={km.matchId}
              kandakatorId={kandakatorId}
              match={km.match}
              entryFeeCoins={km.entryFeeCoins ?? entryFeeCoins}
              teamCompetitionBadges={km.teamCompetitionBadges}
              knockoutUiState={km.knockoutUiState}
              watchParty={km.watchParty ?? null}
              predictionCutoffMinutes={km.predictionCutoffMinutes}
              existingPrediction={km.prediction}
              perfectReward={perfectReward}
              needsDisplayName={needsDisplayName}
              onDisplayNameRequired={onDisplayNameRequired}
              onSubmitted={onSubmitted}
              autoOpenWatchParty={km.matchId === autoOpenWatchPartyMatchId}
              onWatchPartyAutoOpened={onWatchPartyAutoOpened}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
