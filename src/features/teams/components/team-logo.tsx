"use client";

import Image from "next/image";
import { cn } from "@/shared/lib/cn";
import { isPaidTeamLogo, teamLogoUrl } from "@/shared/constants/teams";
import { Lock } from "lucide-react";

export function TeamLogo({
  logoKey,
  unlocked,
  selected,
  onClick,
  size = "md",
}: {
  logoKey: number;
  unlocked?: boolean;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const paid = isPaidTeamLogo(logoKey);
  const locked = paid && !unlocked;
  const dim =
    size === "sm" ? 48 : size === "lg" ? 80 : size === "xl" ? 96 : 64;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-2xl border-2 transition",
        selected ? "border-bordin-orange bg-bordin-orange/10" : "border-white/10 bg-white/5",
        locked && "opacity-80",
        onClick && "hover:border-bordin-orange/50",
      )}
      style={{ width: dim, height: dim }}
    >
      <div className="flex h-[calc(100%-8px)] w-[calc(100%-8px)] items-center justify-center rounded-xl bg-white/5">
        <Image
          src={teamLogoUrl(logoKey)}
          alt=""
          width={dim - 16}
          height={dim - 16}
          className="rounded-lg object-contain"
          unoptimized
        />
      </div>
      {paid ? (
        <span
          className={cn(
            "pointer-events-none absolute -top-1 -left-1 z-20 rounded-full px-1.5 py-0.5 text-[9px] font-bold shadow-sm",
            locked ? "bg-bordin-orange text-black" : "bg-bordin-green/20 text-bordin-green",
          )}
        >
          {locked ? "پولی" : "خریداری‌شده"}
        </span>
      ) : (
        <span className="pointer-events-none absolute -top-1 -left-1 z-20 rounded-full bg-bordin-green/20 px-1.5 py-0.5 text-[9px] font-bold text-bordin-green shadow-sm">
          رایگان
        </span>
      )}
      {locked ? (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/15 backdrop-blur-[1px]">
          <Lock className="h-5 w-5 text-bordin-orange" />
        </span>
      ) : null}
    </button>
  );
}
