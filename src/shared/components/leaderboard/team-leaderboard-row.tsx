import { forwardRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";

export const TeamLeaderboardRow = forwardRef<
  HTMLDivElement,
  {
    rank: number;
    teamId: string;
    name: string;
    logoUrl?: string | null;
    score: number;
    highlight?: boolean;
  }
>(function TeamLeaderboardRow({ rank, teamId, name, logoUrl, score, highlight }, ref) {
  return (
    <Link
      href={`/showcase/team/${teamId}`}
      className="block"
    >
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
          highlight
            ? "border-bordin-orange/60 bg-bordin-orange/15 ring-2 ring-bordin-orange/40"
            : "border-white/8 bg-white/[0.02]",
          "cursor-pointer hover:border-bordin-orange/25 hover:bg-white/[0.04]",
        )}
      >
        <span
          className={cn(
            "w-8 shrink-0 text-center text-sm font-bold tabular-nums",
            rank <= 3 ? "text-bordin-orange" : "text-white/50",
          )}
        >
          {formatPersianNumber(rank)}
        </span>
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-full object-contain"
            unoptimized
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs text-white/35">
            تیم
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
        </div>
        <div className="shrink-0 text-left">
          <p className="text-sm font-bold text-bordin-green tabular-nums">
            {formatPersianNumber(score)}
          </p>
          <p className="text-[10px] text-white/40">امتیاز</p>
        </div>
      </div>
    </Link>
  );
});
