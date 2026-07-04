"use client";

import Image from "next/image";
import { formatPersianNumber } from "@/shared/lib/dates";
import { medalImageUrl } from "@/shared/constants/medals";
import { cn } from "@/shared/lib/cn";

const CHAMPION_MEDAL_PX = 250;

const TROPHY_IMAGES = {
  gold: "/images/leaderboard/team-medal-gold.png",
  silver: "/images/leaderboard/team-medal-silver.png",
} as const;

type PodiumTeam = {
  name: string;
  logoUrl: string | null;
};

function TeamLogo({
  name,
  logoUrl,
  size,
}: {
  name: string;
  logoUrl: string | null;
  size: "lg" | "md";
}) {
  const dim = size === "lg" ? 56 : 44;
  const className =
    size === "lg"
      ? "h-14 w-14 rounded-2xl object-cover ring-2 ring-bordin-orange/35"
      : "h-11 w-11 rounded-xl object-cover ring-1 ring-white/15";

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={dim}
        height={dim}
        className={cn("shrink-0", className)}
        unoptimized
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-white/8 text-white/40",
        className,
      )}
      aria-hidden
    >
      {name.charAt(0) || "⚽"}
    </div>
  );
}

function PodiumCardCenter({
  coinReward,
  medalLabel,
  medalTone,
}: {
  coinReward: number;
  medalLabel: string;
  medalTone: "gold" | "silver";
}) {
  const isGold = medalTone === "gold";
  const coinClass = "text-bordin-orange";
  const medalClass = isGold ? "text-bordin-orange" : "text-slate-300";

  if (coinReward <= 0 && !medalLabel) return null;

  return (
    <div className="flex min-w-[6.5rem] shrink-0 flex-col items-center justify-center gap-1.5 px-2 text-center">
      {coinReward > 0 ? (
        <div className={cn("flex items-center gap-1.5", coinClass)}>
          <Image
            src="/images/store/coin-bordin.png"
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] shrink-0 object-contain"
            unoptimized
          />
          <span className="text-sm font-bold tabular-nums">
            {formatPersianNumber(coinReward)}
          </span>
        </div>
      ) : null}
      {medalLabel ? (
        <div className={cn("flex items-center gap-1.5", medalClass)}>
          <Image
            src={TROPHY_IMAGES[isGold ? "gold" : "silver"]}
            alt=""
            width={16}
            height={16}
            className="h-4 w-4 shrink-0 object-contain"
            unoptimized
          />
          <span className="text-xs font-semibold">{medalLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

function PodiumCard({
  team,
  rank,
  label,
  variant,
  coinReward,
  showMedal,
}: {
  team: PodiumTeam | null;
  rank: 1 | 2;
  label: string;
  variant: "champion" | "runner-up";
  coinReward: number;
  showMedal: boolean;
}) {
  const isChampion = variant === "champion";
  const medalLabel = showMedal ? (isChampion ? "مدال قهرمان" : "مدال رقیب") : "";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border transition-shadow",
        isChampion
          ? "border-bordin-orange/45 bg-gradient-to-b from-bordin-orange/14 via-[#141414] to-[#101010] px-5 py-6 ps-14 shadow-[0_0_32px_rgba(245,185,66,0.18)]"
          : "border-white/12 bg-[#141414] px-4 py-4 ps-12 shadow-lg",
      )}
    >
      {isChampion ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bordin-orange/10 to-transparent"
          aria-hidden
        />
      ) : null}

      <span
        className={cn(
          "absolute left-4 top-1/2 -translate-y-1/2 font-bold tabular-nums",
          isChampion ? "text-3xl text-bordin-orange/85" : "text-2xl text-white/45",
        )}
      >
        {formatPersianNumber(rank)}
      </span>

      <div className="relative flex items-center gap-4">
        <TeamLogo
          name={team?.name ?? "—"}
          logoUrl={team?.logoUrl ?? null}
          size={isChampion ? "lg" : "md"}
        />

        <div className="min-w-0 flex-1 text-right">
          <span
            className={cn(
              "mb-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
              isChampion
                ? "bg-bordin-orange/15 text-bordin-orange"
                : "bg-white/8 text-white/55",
            )}
          >
            {label}
          </span>

          <p
            className={cn(
              "truncate font-bold leading-tight",
              isChampion ? "text-3xl text-white" : "text-base text-white/90",
            )}
          >
            {team?.name ?? "—"}
          </p>
        </div>

        <PodiumCardCenter
          coinReward={coinReward}
          medalLabel={medalLabel}
          medalTone={isChampion ? "gold" : "silver"}
        />
      </div>
    </div>
  );
}

export function TeamCompetitionChampionshipHero({
  champion,
  runnerUp,
  winnerCoinReward,
  runnerUpCoinReward,
  winnerMedalTitles,
  runnerUpMedalTitles,
}: {
  champion: PodiumTeam | null;
  runnerUp: PodiumTeam | null;
  winnerCoinReward: number;
  runnerUpCoinReward: number;
  winnerMedalTitles: string[];
  runnerUpMedalTitles: string[];
}) {
  return (
    <section className="space-y-8 py-2">
      <div className="flex flex-col items-center space-y-4 text-center">
        <Image
          src={medalImageUrl("team-qahraman")}
          alt="مدال قهرمان"
          width={CHAMPION_MEDAL_PX}
          height={CHAMPION_MEDAL_PX}
          className="h-[250px] w-[250px] object-contain drop-shadow-[0_0_12px_rgba(255,213,74,0.35)]"
          unoptimized
          priority
        />
        <h2 className="text-base font-bold text-white">نتایج نهایی رقابت</h2>
      </div>

      <div className="space-y-4">
        <PodiumCard
          team={champion}
          rank={1}
          label="قهرمان"
          variant="champion"
          coinReward={winnerCoinReward}
          showMedal={winnerMedalTitles.length > 0}
        />
        <PodiumCard
          team={runnerUp}
          rank={2}
          label="نایب قهرمان"
          variant="runner-up"
          coinReward={runnerUpCoinReward}
          showMedal={runnerUpMedalTitles.length > 0}
        />
      </div>
    </section>
  );
}
