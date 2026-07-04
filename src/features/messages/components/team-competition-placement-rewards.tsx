import Image from "next/image";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { TeamCompPlacementRewardsPayload } from "@/shared/lib/team-competition-placement-notification";

const TROPHY_IMAGES = {
  gold: "/images/leaderboard/team-medal-gold.png",
  silver: "/images/leaderboard/team-medal-silver.png",
} as const;

export function TeamCompetitionPlacementRewards({
  rewards,
}: {
  rewards: TeamCompPlacementRewardsPayload;
}) {
  const hasCoins = rewards.coinsPerMember > 0;
  const hasMedals = rewards.medalTitles.length > 0;

  if (!hasCoins && !hasMedals) return null;

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="space-y-2.5">
        {hasCoins ? (
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/store/coin-bordin.png"
              alt=""
              width={22}
              height={22}
              className="h-[22px] w-[22px] shrink-0 object-contain"
              unoptimized
            />
            <p className="text-sm text-white/80">
              {formatPersianNumber(rewards.coinsPerMember)} سکه برای هر عضو
            </p>
          </div>
        ) : null}

        {hasMedals ? (
          <div className="space-y-2">
            {rewards.medalTitles.map((title, index) => (
              <div key={`${title}-${index}`} className="flex items-center gap-2.5">
                <Image
                  src={TROPHY_IMAGES[rewards.trophy]}
                  alt=""
                  width={22}
                  height={22}
                  className="h-[22px] w-[22px] shrink-0 object-contain"
                  unoptimized
                />
                <p className="text-sm text-white/80">{title}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
