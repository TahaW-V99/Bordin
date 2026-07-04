"use client";

import { Swords } from "lucide-react";
import { formatTehranTime } from "@/shared/lib/dates";
import { isDuelChallengePayload } from "@/shared/lib/chat-payloads";

export function DuelChallengeCard({ payload }: { payload: Record<string, unknown> }) {
  if (!isDuelChallengePayload(payload)) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-500/30 bg-gradient-to-br from-red-950/40 to-black/40">
      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2 text-xs font-bold text-red-300">
        <Swords className="h-4 w-4" />
        دوئل پیش‌بینی — نبرد روی چمن
      </div>
      <div className="space-y-3 px-3 py-3 text-sm">
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-center leading-8 text-white/90">
          <span className="font-bold text-bordin-orange">{payload.challengerName}</span>
          <span className="text-white/50">به</span>
          <span className="font-bold text-white">{payload.opponentName}</span>
          <span className="text-white/50">چالش داد:</span>
          <span className="text-bordin-green">کی دقیق‌تر پیش‌بینی می‌کند؟</span>
        </p>
        <ul className="space-y-2">
          {payload.matches.map((match) => (
            <li
              key={match.matchId}
              className="rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-center text-xs"
            >
              <p className="font-semibold">
                {match.homeTeamName} vs {match.awayTeamName}
              </p>
              <p className="mt-1 text-white/40">سوت شروع {formatTehranTime(match.kickoffAt)}</p>
            </li>
          ))}
        </ul>
        <p className="text-center text-[11px] text-white/45">
          فقط رقابت افتخار — بدون شرط‌بندی. بزن بریم! ⚽
        </p>
      </div>
    </div>
  );
}
