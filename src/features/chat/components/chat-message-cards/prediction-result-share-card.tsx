"use client";

import { Coins, Target, Trophy } from "lucide-react";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { isPredictionResultPayload } from "@/shared/lib/chat-payloads";

export function PredictionResultShareCard({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  if (!isPredictionResultPayload(payload)) return null;

  const perfect = payload.accuracyPercent === 100;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border",
        perfect ? "border-bordin-green/40 bg-bordin-green/10" : "border-bordin-orange/30 bg-bordin-orange/10",
      )}
    >
      <div className="border-b border-white/8 px-3 py-2 text-xs font-semibold text-bordin-orange">
        ⚽ کارت نتیجه پیش‌بینی
      </div>
      <div className="space-y-2 px-3 py-3 text-sm">
        <p className="text-center font-bold leading-tight">
          {payload.homeTeamName}
          <span className="mx-2 text-white/30">vs</span>
          {payload.awayTeamName}
        </p>
        {payload.leagueName ? (
          <p className="text-center text-[11px] text-white/40">{payload.leagueName}</p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-black/25 px-2 py-2 text-center">
            <p className="text-white/40">پیش‌بینی</p>
            <p className="mt-0.5 font-bold tabular-nums">
              {formatPersianNumber(payload.homePrediction)} –{" "}
              {formatPersianNumber(payload.awayPrediction)}
            </p>
          </div>
          <div className="rounded-lg bg-black/25 px-2 py-2 text-center">
            <p className="text-white/40">نتیجه</p>
            <p className="mt-0.5 font-bold tabular-nums text-bordin-orange">
              {formatPersianNumber(payload.homeScore)} – {formatPersianNumber(payload.awayScore)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-bordin-green">
            <Target className="h-3.5 w-3.5" />
            {formatPersianNumber(payload.accuracyPercent)}٪ دقت
          </span>
          <span className="flex items-center gap-1 text-bordin-orange">
            <Coins className="h-3.5 w-3.5" />+{formatPersianNumber(payload.coinsEarned)} سکه
          </span>
          <span className="flex items-center gap-1 text-white/70">
            <Trophy className="h-3.5 w-3.5" />+{formatPersianNumber(payload.xpEarned)} امتیاز
          </span>
        </div>
      </div>
    </div>
  );
}
