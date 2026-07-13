"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import {
  WATCH_PARTY_ACTIVE_TOOLTIP,
  WATCH_PARTY_DISABLED_TOOLTIP,
} from "@/shared/constants/watch-party";
import { getWatchPartyUiPhase } from "@/shared/lib/watch-party-timing";

export type WatchPartyCardState = {
  roomId: string;
  matchId: string;
  capacity: number;
  entryFeeCoins: number;
  occupiedCount: number;
  hasJoined: boolean;
  uiPhase: "upcoming" | "active";
  googleMeetUrl: string | null;
};

export function WatchPartyButton({
  kickoffAt,
  watchParty,
  onOpen,
}: {
  kickoffAt: string;
  watchParty: WatchPartyCardState;
  onOpen: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [blinkDone, setBlinkDone] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const phase = useMemo(() => getWatchPartyUiPhase(kickoffAt, now), [kickoffAt, now]);

  useEffect(() => {
    if (phase !== "active" || blinkDone) return;
    const timer = setTimeout(() => setBlinkDone(true), 4 * 600);
    return () => clearTimeout(timer);
  }, [phase, blinkDone]);

  if (phase === "hidden") return null;

  const isActive = phase === "active";
  const tooltip = isActive ? WATCH_PARTY_ACTIVE_TOOLTIP : WATCH_PARTY_DISABLED_TOOLTIP;

  const handleMainClick = () => {
    if (!isActive) return;
    if (watchParty.hasJoined && watchParty.googleMeetUrl) {
      window.location.href = watchParty.googleMeetUrl;
      return;
    }
    onOpen();
  };

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={handleMainClick}
        disabled={!isActive}
        className={cn(
          "inline-flex h-8 min-w-[5.5rem] items-center justify-center rounded-lg border px-2 text-[10px] font-bold leading-tight",
          isActive
            ? "border-bordin-orange bg-bordin-orange text-black shadow-[0_0_16px_rgba(255,138,76,0.35)]"
            : "cursor-not-allowed border-white/15 bg-white/5 text-white/35",
          isActive && !blinkDone && "animate-pulse",
        )}
      >
        تماشای گروهی
      </button>
      <button
        type="button"
        aria-label="راهنما"
        onClick={() => setShowTooltip((value) => !value)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/15 text-white/55 hover:bg-white/5"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {showTooltip ? (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 rounded-xl border border-white/15 bg-[#1a1a1a] p-3 text-[11px] leading-6 text-white/75 shadow-xl">
          {tooltip}
        </div>
      ) : null}
    </div>
  );
}
