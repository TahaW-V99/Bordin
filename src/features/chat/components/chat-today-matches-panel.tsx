"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { formatPersianNumber, formatTehranTime } from "@/shared/lib/dates";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Clock, Swords } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import type { ChatRoomContextDto } from "@/shared/types/chat";
import { groupMatchesByLeague } from "@/shared/lib/kandakator-utils";
import { ChatDuelModal } from "@/features/chat/components/chat-duel-modal";

export function ChatTodayMatchesPanel({
  context,
  onDuelCreated,
  scrollToTop,
}: {
  context: ChatRoomContextDto["todayKandakator"];
  onDuelCreated?: () => void;
  scrollToTop?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duelOpen, setDuelOpen] = useState(false);
  const [hintBlink, setHintBlink] = useState(false);

  const groups = useMemo(() => {
    if (!context?.matches.length) return [];
    return groupMatchesByLeague(
      context.matches.map((km) => ({
        id: km.id,
        matchId: km.matchId,
        sortOrder: 0,
        predictionCutoffMinutes: 5,
        match: {
          id: km.matchId,
          ...km.match,
        },
        prediction: km.prediction
          ? {
              homePrediction: km.prediction.homePrediction,
              awayPrediction: km.prediction.awayPrediction,
              accuracyPercent: null,
              coinsEarned: null,
              xpEarned: null,
            }
          : null,
      })),
    );
  }, [context]);

  const triggerHintBlink = useCallback(() => {
    scrollToTop?.();
    setHintBlink(true);
    window.setTimeout(() => setHintBlink(false), 5000);
  }, [scrollToTop]);

  useEffect(() => {
    const onHint = () => triggerHintBlink();
    window.addEventListener("bordin-chat-duel-hint", onHint);
    return () => window.removeEventListener("bordin-chat-duel-hint", onHint);
  }, [triggerHintBlink]);

  if (!context?.matches.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-center text-xs text-white/45">
        امروز بازی فعالی در کنداکتور ثبت نشده است.
      </div>
    );
  }

  const toggle = (matchId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  };

  const selectedMatches = context.matches.filter((m) => selected.has(m.matchId));
  const selectedLabels = selectedMatches.map(
    (m) => `${m.match.homeTeamName} vs ${m.match.awayTeamName}`,
  );

  return (
    <div id="chat-today-matches-panel" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white/80">بازی‌های امروز</p>
        {selected.size > 0 ? (
          <Button
            size="sm"
            className="h-8 gap-1 rounded-xl px-3 text-xs"
            onClick={() => setDuelOpen(true)}
          >
            <Swords className="h-3.5 w-3.5" />
            دوئل ({formatPersianNumber(selected.size)})
          </Button>
        ) : null}
      </div>

      <p
        id="chat-duel-hint"
        className={cn(
          "text-sm transition",
          hintBlink ? "animate-pulse font-semibold text-bordin-orange" : "text-bordin-orange/90",
        )}
      >
        برای چالش دوئل، یک یا چند کارت بازی را انتخاب کنید.
      </p>

      {groups.map((group) => (
        <div
          key={group.leagueName}
          className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]"
        >
          <div className="border-b border-white/8 px-3 py-2 text-xs font-semibold text-white/70">
            {group.leagueName}
          </div>
          <div className="divide-y divide-white/6">
            {group.matches.map((km) => {
              const isSelected = selected.has(km.matchId);
              return (
                <button
                  key={km.id}
                  type="button"
                  onClick={() => toggle(km.matchId)}
                  className={cn(
                    "w-full space-y-2 px-3 py-3 text-start transition",
                    isSelected
                      ? "bg-bordin-orange/10 ring-1 ring-inset ring-bordin-orange/40"
                      : "hover:bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="blue">{group.leagueName}</Badge>
                    <div className="flex items-center gap-2 text-[11px] text-white/45">
                      {isSelected ? (
                        <span className="rounded-full bg-bordin-orange/20 px-2 py-0.5 text-bordin-orange">
                          انتخاب شد
                        </span>
                      ) : null}
                      <Clock className="h-3 w-3" />
                      <span>شروع {formatTehranTime(km.match.kickoffAt)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                    <p className="text-center font-semibold leading-tight">{km.match.homeTeamName}</p>
                    <span className="text-xs text-white/30">VS</span>
                    <p className="text-center font-semibold leading-tight">{km.match.awayTeamName}</p>
                  </div>
                  {km.prediction ? (
                    <p className="text-center text-xs text-bordin-green">
                      پیش‌بینی شما: {formatPersianNumber(km.prediction.homePrediction)} -{" "}
                      {formatPersianNumber(km.prediction.awayPrediction)}
                    </p>
                  ) : (
                    <p className="text-center text-xs text-white/40">
                      پیش‌بینی ثبت نشده — از صفحه خانه ثبت کنید
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {duelOpen ? (
        <ChatDuelModal
          matchIds={selectedMatches.map((m) => m.matchId)}
          matchLabels={selectedLabels}
          onClose={() => setDuelOpen(false)}
          onCreated={() => {
            setDuelOpen(false);
            setSelected(new Set());
            onDuelCreated?.();
          }}
        />
      ) : null}
    </div>
  );
}
