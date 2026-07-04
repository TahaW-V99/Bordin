"use client";

import { useState } from "react";
import { Coins, HelpCircle, Lock, Trophy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ClickTooltip } from "@/shared/components/ui/click-tooltip";
import { formatPersianNumber } from "@/shared/lib/dates";
import { INVITE_DEFAULT_COIN_REWARD, INVITE_DEFAULT_XP_REWARD } from "@/shared/constants/invite";
import { cn } from "@/shared/lib/cn";
import type { MissionCardView } from "@/shared/types/missions";
import { MissionGoldenProgressBar } from "@/features/missions/components/mission-golden-progress-bar";
import {
  MissionMedalImage,
  MISSION_REWARD_MEDAL_PX,
} from "@/features/missions/components/mission-medal-image";
import { MissionMedalPreviewModal } from "@/features/missions/components/mission-medal-preview-modal";

const MEDAL_MISSION_SLUGS = new Set(["vafadar", "sheykarchee"]);

const STATUS_LABEL: Record<MissionCardView["status"], string> = {
  LOCKED: "قفل",
  IN_PROGRESS: "در حال انجام",
  READY_TO_CLAIM: "آماده دریافت",
  COMPLETED: "انجام شده",
};

export function MissionCard({
  mission,
  claiming,
  onClaim,
}: {
  mission: MissionCardView;
  claiming: boolean;
  onClaim: (missionSlug: string, tierKey: string) => void;
}) {
  const [previewMedal, setPreviewMedal] = useState<{
    slug: string;
    titleFa: string | null;
  } | null>(null);

  const isCompleted = mission.status === "COMPLETED";
  const isLocked = mission.status === "LOCKED";
  const canClaim =
    mission.status === "READY_TO_CLAIM" &&
    !mission.autoClaimOnComplete &&
    mission.claimableTierKey;
  const hasClickableMedals = MEDAL_MISSION_SLUGS.has(mission.slug);

  return (
    <>
      <article
        className={cn(
          "rounded-2xl border p-4 transition",
          isCompleted
            ? "border-bordin-green/30 bg-bordin-green/5 opacity-90"
            : isLocked
              ? "border-white/8 bg-white/[0.02] opacity-70"
              : "border-[#f5b942]/30 bg-gradient-to-b from-[#f5b942]/5 to-transparent",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold">{mission.titleFa}</h2>
              {mission.slug === "davat" ? (
                <span className="rounded-full bg-[#f5b942]/15 px-2 py-0.5 text-[10px] font-semibold text-[#ffd54a]">
                  نامحدود تا ۱۵ تیر
                </span>
              ) : null}
              <ClickTooltip content={mission.tooltipFa} dismissMs={5000}>
                <HelpCircle className="h-4 w-4" />
              </ClickTooltip>
            </div>
            <p className="mt-1.5 text-xs leading-6 text-white/55">{mission.descriptionFa}</p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
              isCompleted && "bg-bordin-green/15 text-bordin-green",
              mission.status === "READY_TO_CLAIM" && "bg-[#f5b942]/15 text-[#ffd54a]",
              mission.status === "IN_PROGRESS" && "bg-white/8 text-white/60",
              isLocked && "bg-white/5 text-white/40",
            )}
          >
            {isLocked ? (
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {STATUS_LABEL[mission.status]}
              </span>
            ) : (
              STATUS_LABEL[mission.status]
            )}
          </span>
        </div>

        {!isLocked ? (
          <div className="mt-4">
            <MissionGoldenProgressBar value={mission.currentProgress} max={mission.progressTarget} />
            <p className="mt-2 text-center text-xs text-white/50">
              {formatPersianNumber(mission.currentProgress)} /{" "}
              {formatPersianNumber(mission.progressTarget)}
            </p>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-[#f5b942]/90">جوایز</p>
          {mission.tiers.map((tier) => (
            <div
              key={tier.tierKey}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                tier.claimed
                  ? "border-bordin-green/25 bg-bordin-green/5"
                  : tier.claimable
                    ? "border-[#f5b942]/35 bg-[#f5b942]/8"
                    : "border-white/8 bg-black/20",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white/85">
                  {tier.tierLabelFa}
                  <span className="ms-1 font-normal text-white/45">
                    ({formatPersianNumber(tier.threshold)})
                  </span>
                </p>
                {tier.claimed ? (
                  <span className="text-[10px] text-bordin-green">دریافت شد</span>
                ) : null}
              </div>
              <div className="mt-2 text-[11px] text-white/70">
                {mission.slug === "davat" ? (
                  <>
                    <p>
                      هر دعوت {formatPersianNumber(INVITE_DEFAULT_COIN_REWARD)} سکه و{" "}
                      {formatPersianNumber(INVITE_DEFAULT_XP_REWARD)} امتیاز
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-[#ffd54a]" />
                        {formatPersianNumber(tier.coins)} سکه
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-bordin-orange" />
                        {formatPersianNumber(tier.xp)} امتیاز
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {tier.coins > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-[#ffd54a]" />
                        {formatPersianNumber(tier.coins)} سکه
                      </span>
                    ) : null}
                    {tier.xp > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-bordin-orange" />
                        {formatPersianNumber(tier.xp)} امتیاز
                      </span>
                    ) : null}
                    {tier.medalSlug ? (
                      <span className="inline-flex items-center gap-2">
                        <MissionMedalImage
                          slug={tier.medalSlug}
                          alt={tier.medalTitleFa ?? "مدال"}
                          size={MISSION_REWARD_MEDAL_PX}
                          onClick={
                            hasClickableMedals
                              ? () =>
                                  setPreviewMedal({
                                    slug: tier.medalSlug!,
                                    titleFa: tier.medalTitleFa,
                                  })
                              : undefined
                          }
                        />
                        {tier.medalTitleFa ?? "مدال"}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {canClaim && mission.claimableTierKey ? (
          <Button
            fullWidth
            disabled={claiming}
            className="mt-4 border border-[#f5b942]/50 bg-gradient-to-l from-[#ffd54a] to-[#c8962e] font-bold text-black hover:opacity-90"
            onClick={() => onClaim(mission.slug, mission.claimableTierKey!)}
          >
            {claiming ? "در حال دریافت..." : "دریافت پاداش"}
          </Button>
        ) : null}
      </article>

      {previewMedal ? (
        <MissionMedalPreviewModal
          medalSlug={previewMedal.slug}
          medalTitleFa={previewMedal.titleFa}
          onClose={() => setPreviewMedal(null)}
        />
      ) : null}
    </>
  );
}
