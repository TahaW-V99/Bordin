import { forwardRef } from "react";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { PublicProfileLink } from "@/shared/components/profile/public-profile-link";

export const LeaderboardRow = forwardRef<
  HTMLDivElement,
  {
    rank: number;
    name: string;
    avatarUrl?: string | null;
    showcaseSlug?: string | null;
    level?: string;
    score: number;
    highlight?: boolean;
  }
>(function LeaderboardRow({ rank, name, avatarUrl, showcaseSlug, level, score, highlight }, ref) {
  const row = (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors",
        highlight
          ? "border-bordin-orange/60 bg-bordin-orange/15 ring-2 ring-bordin-orange/40"
          : "border-white/8 bg-white/[0.02]",
        showcaseSlug && "cursor-pointer hover:border-bordin-orange/25 hover:bg-white/[0.04]",
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
      <ProfileAvatar avatarUrl={avatarUrl} displayName={name} size="sm" className="rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        {level ? (
          <span className="mt-0.5 inline-block rounded-full bg-bordin-orange/15 px-2 py-0.5 text-[10px] text-bordin-orange">
            {level}
          </span>
        ) : null}
      </div>
      <div className="shrink-0 text-left">
        <p className="text-sm font-bold text-bordin-green tabular-nums">
          {formatPersianNumber(score)}
        </p>
        <p className="text-[10px] text-white/40">امتیاز</p>
      </div>
    </div>
  );

  if (!showcaseSlug) return row;

  return (
    <PublicProfileLink slug={showcaseSlug} ariaLabel={`مشاهده پروفایل ${name}`} className="block">
      {row}
    </PublicProfileLink>
  );
});
