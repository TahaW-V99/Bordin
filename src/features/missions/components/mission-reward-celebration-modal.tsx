"use client";

import { Coins, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { MissionClaimResult } from "@/shared/types/missions";
import {
  MissionMedalImage,
  MISSION_CELEBRATION_MEDAL_PX,
} from "@/features/missions/components/mission-medal-image";

export function MissionRewardCelebrationModal({
  open,
  reward,
  onClose,
}: {
  open: boolean;
  reward: MissionClaimResult | null;
  onClose: () => void;
}) {
  if (!open || !reward) return null;

  const hasMedal = Boolean(reward.medalSlug);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="mission-celebration-overlay pointer-events-none absolute inset-0 overflow-hidden" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#f5b942]/40 bg-gradient-to-b from-[#1a1408] to-[#0d0d0d] p-6 shadow-[0_0_48px_rgba(245,185,66,0.25)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#ffd54a]/15 to-transparent" />

        {hasMedal ? (
          <div className="relative mx-auto mb-4 flex items-center justify-center">
            <div
              className="mission-medal-glow absolute rounded-full"
              style={{
                width: MISSION_CELEBRATION_MEDAL_PX + 16,
                height: MISSION_CELEBRATION_MEDAL_PX + 16,
              }}
            />
            <MissionMedalImage
              slug={reward.medalSlug!}
              alt={reward.medalTitleFa ?? "مدال"}
              size={MISSION_CELEBRATION_MEDAL_PX}
              className="relative z-10 drop-shadow-[0_8px_24px_rgba(255,213,74,0.55)]"
            />
          </div>
        ) : (
          <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-[#f5b942]/35 bg-[#f5b942]/10">
            <Sparkles className="h-10 w-10 text-[#ffd54a]" />
          </div>
        )}

        <h2 className="text-center text-lg font-bold text-[#ffd54a]">تبریک می‌گم!</h2>
        <p className="mt-2 text-center text-sm leading-7 text-white/80">
          {hasMedal ? (
            <>
              یک مدال ارزشمند کسب کردی
              {reward.medalTitleFa ? ` (${reward.medalTitleFa})` : ""} به همراه{" "}
            </>
          ) : (
            <>پاداش ماموریت «{reward.missionTitleFa}» شامل </>
          )}
          {reward.coins > 0 ? (
            <>
              <span className="font-bold text-[#ffd54a]">
                {formatPersianNumber(reward.coins)} سکه
              </span>
              {reward.xp > 0 ? " و " : ""}
            </>
          ) : null}
          {reward.xp > 0 ? (
            <span className="font-bold text-bordin-orange">
              {formatPersianNumber(reward.xp)} امتیاز
            </span>
          ) : null}
          .
        </p>

        <div className="mt-5 flex items-center justify-center gap-4">
          {reward.coins > 0 ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-[#f5b942]/25 bg-black/30 px-3 py-2 text-sm">
              <Coins className="h-4 w-4 text-[#ffd54a]" />
              <span>{formatPersianNumber(reward.coins)}</span>
            </div>
          ) : null}
          {reward.xp > 0 ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-bordin-orange/25 bg-black/30 px-3 py-2 text-sm">
              <span className="text-xs font-bold text-bordin-orange">XP</span>
              <span>{formatPersianNumber(reward.xp)}</span>
            </div>
          ) : null}
        </div>

        <Button
          fullWidth
          className="mt-6 border border-[#f5b942]/40 bg-gradient-to-l from-[#ffd54a] to-[#c8962e] font-bold text-black hover:opacity-90"
          onClick={onClose}
        >
          متوجه شدم
        </Button>
      </div>

      <style jsx global>{`
        .mission-celebration-overlay::before,
        .mission-celebration-overlay::after {
          content: "";
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(circle at 20% 30%, rgba(255, 213, 74, 0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 70% 20%, rgba(245, 185, 66, 0.4) 0 2px, transparent 3px),
            radial-gradient(circle at 40% 80%, rgba(255, 140, 0, 0.35) 0 2px, transparent 3px),
            radial-gradient(circle at 85% 65%, rgba(255, 213, 74, 0.3) 0 2px, transparent 3px);
          animation: mission-confetti 2.8s ease-out infinite;
        }
        .mission-celebration-overlay::after {
          animation-delay: 0.6s;
          opacity: 0.7;
        }
        .mission-medal-glow {
          background: radial-gradient(circle, rgba(255, 213, 74, 0.45) 0%, transparent 70%);
          animation: mission-medal-pulse 1.8s ease-in-out infinite;
        }
        @keyframes mission-confetti {
          0% {
            transform: translateY(10%) scale(0.9);
            opacity: 0.2;
          }
          40% {
            opacity: 1;
          }
          100% {
            transform: translateY(-8%) scale(1.05);
            opacity: 0.15;
          }
        }
        @keyframes mission-medal-pulse {
          0%,
          100% {
            transform: scale(0.92);
            opacity: 0.65;
          }
          50% {
            transform: scale(1.08);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
