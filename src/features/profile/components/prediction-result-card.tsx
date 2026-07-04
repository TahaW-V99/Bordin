"use client";

import { Award, Coins, Medal, MessageSquareShare, Target, Trophy, Users } from "lucide-react";
import { formatPersianNumber, formatTehranDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { isPredictionScored, isPredictionSettled, type PredictionResultItem } from "@/shared/types/prediction-results";

function accuracyColor(percent: number | null) {
  if (percent === null) return "text-white/50";
  if (percent === 100) return "text-bordin-green";
  if (percent >= 70) return "text-bordin-orange";
  if (percent >= 40) return "text-white/80";
  return "text-white/45";
}

function CompetitionIcons({ type }: { type: string }) {
  if (type === "CUP") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-bordin-orange" title="جام">
        <Trophy className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (type === "TOURNAMENT") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-bordin-orange" title="تورنومنت">
        <Award className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (type === "TEAM") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-bordin-orange" title="رقابت گروهی">
        <Users className="h-3.5 w-3.5" />
      </span>
    );
  }
  return null;
}

export function PredictionResultCard({
  item,
  onShareInChat,
}: {
  item: PredictionResultItem;
  onShareInChat?: (predictionId: string) => void;
}) {
  const resultDetermined = isPredictionSettled(item);
  const scored = isPredictionScored(item);
  const actualLabel =
    item.match.homeScore !== null && item.match.awayScore !== null
      ? `${item.match.homeScore} – ${item.match.awayScore}`
      : "—";

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        resultDetermined
          ? "border-bordin-green/40 bg-bordin-green/10"
          : "border-yellow-500/40 bg-yellow-500/10",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 text-right">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">
              {item.match.homeTeamName}
              <span className="mx-1.5 text-white/30">vs</span>
              {item.match.awayTeamName}
            </p>
            <CompetitionIcons type={item.competitionType} />
          </div>
          {item.match.leagueName ? (
            <p className="mt-0.5 truncate text-[11px] text-white/40">{item.match.leagueName}</p>
          ) : null}
        </div>
        <span className="shrink-0 text-[10px] text-white/35">
          {formatTehranDate(item.match.kickoffAt, "d MMM")}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-black/20 px-3 py-2">
          <p className="text-white/40">پیش‌بینی شما</p>
          <p className="mt-0.5 font-bold tabular-nums">
            {formatPersianNumber(item.homePrediction)} –{" "}
            {formatPersianNumber(item.awayPrediction)}
          </p>
        </div>
        <div className="rounded-lg bg-black/20 px-3 py-2">
          <p className="text-white/40">نتیجه بازی</p>
          <p
            className={cn(
              "mt-0.5 font-bold tabular-nums",
              resultDetermined ? "text-bordin-orange" : "text-white/50",
            )}
          >
            {actualLabel === "—"
              ? "—"
              : actualLabel
                  .split(" – ")
                  .map((n) => formatPersianNumber(Number(n)))
                  .join(" – ")}
          </p>
        </div>
      </div>

      {!resultDetermined ? (
        <p className="text-center text-xs text-yellow-200/70">در انتظار نتیجه بازی</p>
      ) : !scored ? (
        <p className="text-center text-xs text-bordin-green/80">نتیجه مشخص شد — در حال ثبت پاداش</p>
      ) : (
        <div className="space-y-3 border-t border-white/6 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-white/40" />
              <span className="text-xs text-white/50">دقت پیش‌بینی</span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  accuracyColor(item.accuracyPercent),
                )}
              >
                {formatPersianNumber(item.accuracyPercent ?? 0)}٪
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span
                className="flex items-center gap-1 text-bordin-orange"
                title="سکه جایزه پیش‌بینی"
              >
                <Coins className="h-3.5 w-3.5" />
                +{formatPersianNumber(item.coinsEarned ?? 0)} سکه
              </span>
              <span className="text-bordin-green" title="امتیاز دریافت شده">
                +{formatPersianNumber(item.xpEarned ?? 0)} امتیاز
              </span>
            </div>
          </div>

          {item.medal ? (
            <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
              <Medal className="h-4 w-4 shrink-0 text-bordin-orange" />
              <span className="text-white/50">مدال:</span>
              <span className="font-semibold text-white">{item.medal.titleFa}</span>
            </div>
          ) : null}

          {onShareInChat ? (
            <button
              type="button"
              onClick={() => onShareInChat(item.id)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-bordin-orange/30 bg-bordin-orange/10 px-3 py-2.5 text-sm font-semibold text-bordin-orange transition hover:bg-bordin-orange/15"
            >
              <MessageSquareShare className="h-4 w-4" />
              اشتراک در چت
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}
