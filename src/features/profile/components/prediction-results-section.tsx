"use client";

import { Coins, Target } from "lucide-react";
import { formatPersianNumber, formatTehranDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";

export type PredictionResultItem = {
  id: string;
  homePrediction: number;
  awayPrediction: number;
  entryFeeCoins: number;
  accuracyPercent: number | null;
  coinsEarned: number | null;
  xpEarned: number | null;
  scoredAt: string | null;
  submittedAt: string;
  competitionType: string;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    leagueName: string | null;
    kickoffAt: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  };
};

function accuracyColor(percent: number | null) {
  if (percent === null) return "text-white/50";
  if (percent === 100) return "text-bordin-green";
  if (percent >= 70) return "text-bordin-orange";
  if (percent >= 40) return "text-white/80";
  return "text-white/45";
}

export function PredictionResultsSection({
  results,
}: {
  results: PredictionResultItem[];
}) {
  if (results.length === 0) {
    return (
      <section>
        <h3 className="mb-3 font-bold">نتایج پیش‌بینی</h3>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-center text-sm text-white/45">
          هنوز پیش‌بینی ثبت نکرده‌اید.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-1 font-bold">نتایج پیش‌بینی</h3>
      <p className="mb-3 text-xs text-white/45">
        سکه و XP به مجموع شما اضافه می‌شود. سکه جایزه به موجودی «سکه جایزه پیش‌بینی» (قابل فروش) واریز می‌شود.
      </p>
      <div className="space-y-3">
        {results.map((item) => {
          const isPending =
            item.match.status !== "FINISHED" || item.accuracyPercent === null;
          const actualLabel =
            item.match.homeScore !== null && item.match.awayScore !== null
              ? `${item.match.homeScore} – ${item.match.awayScore}`
              : "—";

          return (
            <article
              key={item.id}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold text-white">
                    {item.match.homeTeamName}
                    <span className="mx-1.5 text-white/30">vs</span>
                    {item.match.awayTeamName}
                  </p>
                  {item.match.leagueName ? (
                    <p className="mt-0.5 truncate text-[11px] text-white/40">
                      {item.match.leagueName}
                    </p>
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
                  <p className="mt-0.5 font-bold tabular-nums text-bordin-orange">
                    {actualLabel === "—"
                      ? "—"
                      : actualLabel
                          .split(" – ")
                          .map((n) => formatPersianNumber(Number(n)))
                          .join(" – ")}
                  </p>
                </div>
              </div>

              {isPending ? (
                <p className="text-center text-xs text-white/45">در انتظار نتیجه بازی</p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/6 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-xs text-white/50">دقت</span>
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
                    <span className="flex items-center gap-1 text-bordin-orange" title="سکه جایزه پیش‌بینی — قابل فروش">
                      <Coins className="h-3.5 w-3.5" />
                      +{formatPersianNumber(item.coinsEarned ?? 0)} سکه
                    </span>
                    <span className="text-bordin-green" title="امتیاز تجربه">
                      +{formatPersianNumber(item.xpEarned ?? 0)} XP
                    </span>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
