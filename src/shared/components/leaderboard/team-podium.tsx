import Image from "next/image";
import Link from "next/link";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { TeamLeaderboardEntry } from "@/shared/types/leaderboard";

const MEDAL_IMAGES: Record<number, string> = {
  1: "/images/leaderboard/team-medal-gold.png",
  2: "/images/leaderboard/team-medal-silver.png",
  3: "/images/leaderboard/team-medal-bronze.png",
};

function TeamLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={40}
        height={40}
        className="mx-auto h-10 w-10 rounded-full object-contain ring-2 ring-white/10"
        unoptimized
      />
    );
  }

  return (
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-xs text-white/35 ring-2 ring-white/10">
      تیم
    </span>
  );
}

export function TeamPodium({ entries }: { entries: TeamLeaderboardEntry[] }) {
  const byRank = new Map(entries.map((entry) => [entry.rank, entry]));
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
      {slots.map((entry, index) => {
        if (!entry) return <div key={`empty-${index}`} className="w-[5.5rem]" />;
        const medalSrc = MEDAL_IMAGES[entry.rank];
        const medalSize = medalSizes[entry.rank] ?? { width: 38, height: 38 };

        const column = (
          <div className="flex w-[5.5rem] flex-col items-center">
            <div className="mb-1.5">
              <TeamLogo name={entry.teamName} logoUrl={entry.logoUrl} />
            </div>
            <p className="mb-2 max-w-full truncate text-center text-xs font-semibold">
              {entry.teamName}
            </p>
            <p className="mb-2 text-[10px] text-white/45">
              {formatPersianNumber(entry.totalPoints)} امتیاز
            </p>
            <div
              className={`flex w-full items-center justify-center rounded-t-xl px-1 pt-1 ${heights[index]} ${barColors[index]}`}
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

        return (
          <Link
            key={entry.teamId}
            href={`/showcase/team/${entry.teamId}`}
            className="block transition-opacity hover:opacity-90"
            aria-label={`مشاهده تیم ${entry.teamName}`}
          >
            {column}
          </Link>
        );
      })}
    </div>
  );
}
