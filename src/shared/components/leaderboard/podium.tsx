import Image from "next/image";
import { formatPersianNumber } from "@/shared/lib/dates";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { PublicProfileLink } from "@/shared/components/profile/public-profile-link";
import type { GlobalLeaderboardEntry } from "@/shared/types/leaderboard";

const MEDAL_IMAGES: Record<number, string> = {
  1: "/images/leaderboard/medal-gold.png",
  2: "/images/leaderboard/medal-silver.png",
  3: "/images/leaderboard/medal-bronze.png",
};

export function Podium({ entries }: { entries: GlobalLeaderboardEntry[] }) {
  const byRank = new Map(entries.map((e) => [e.rank, e]));
  const slots = [byRank.get(2), byRank.get(1), byRank.get(3)];
  const heights = ["h-20", "h-28", "h-16"];
  const barColors = ["bg-white/10", "bg-bordin-orange/25", "bg-bordin-purple/15"];
  const medalSizes: Record<number, { width: number; height: number }> = {
    1: { width: 48, height: 48 },
    2: { width: 44, height: 44 },
    3: { width: 38, height: 38 },
  };

  return (
    <div className="flex items-end justify-center gap-2 px-4 py-4 sm:gap-3">
      {slots.map((entry, i) => {
        if (!entry) return <div key={`empty-${i}`} className="w-[5.5rem]" />;
        const medalSrc = MEDAL_IMAGES[entry.rank];
        const medalSize = medalSizes[entry.rank] ?? { width: 38, height: 38 };
        const column = (
          <div className="flex w-[5.5rem] flex-col items-center">
            <div className="mb-1.5">
              <ProfileAvatar
                avatarUrl={entry.avatarUrl}
                displayName={entry.displayName}
                size="sm"
                className="mx-auto rounded-full ring-2 ring-white/10"
              />
            </div>
            <p className="mb-0.5 max-w-full truncate text-center text-xs font-semibold">
              {entry.displayName}
            </p>
            {entry.level ? (
              <p className="mb-1 max-w-full truncate text-center text-[10px] text-bordin-orange">
                {entry.level}
              </p>
            ) : null}
            <p className="mb-2 text-[10px] text-white/45">
              {formatPersianNumber(entry.totalXp)} امتیاز
            </p>
            <div
              className={`flex w-full items-center justify-center rounded-t-xl px-1 pt-1 ${heights[i]} ${barColors[i]}`}
            >
              {medalSrc ? (
                <Image
                  src={medalSrc}
                  alt={`مدال رتبه ${entry.rank}`}
                  width={medalSize.width}
                  height={medalSize.height}
                  className="object-contain drop-shadow-sm"
                  unoptimized
                  priority={entry.rank === 1}
                />
              ) : (
                <span className="text-lg font-bold">{formatPersianNumber(entry.rank)}</span>
              )}
            </div>
          </div>
        );

        if (!entry.showcaseSlug) {
          return <div key={entry.userId}>{column}</div>;
        }

        return (
          <PublicProfileLink
            key={entry.userId}
            slug={entry.showcaseSlug}
            ariaLabel={`مشاهده پروفایل ${entry.displayName}`}
            className="block transition-opacity hover:opacity-90"
          >
            {column}
          </PublicProfileLink>
        );
      })}
    </div>
  );
}
