"use client";

import { Crown, Medal, Star } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { ChatSenderDto } from "@/shared/types/chat";
import type { ChatCredibilityTier } from "@/shared/lib/chat-logic";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";

const tierRing: Record<Exclude<ChatCredibilityTier, null>, string> = {
  top5: "ring-2 ring-yellow-400/80 ring-offset-1 ring-offset-black",
  veteran: "ring-2 ring-bordin-orange/70 ring-offset-1 ring-offset-black",
  medalist: "ring-2 ring-bordin-green/50 ring-offset-1 ring-offset-black",
};

const tierBadge: Record<Exclude<ChatCredibilityTier, null>, React.ReactNode> = {
  top5: <Crown className="h-3 w-3 text-yellow-400" />,
  veteran: <Star className="h-3 w-3 text-bordin-orange" />,
  medalist: <Medal className="h-3 w-3 text-bordin-green" />,
};

export function ChatSenderHeader({
  sender,
  timeLabel,
  onProfileClick,
  align = "start",
}: {
  sender: ChatSenderDto;
  timeLabel: string;
  onProfileClick?: (slug: string) => void;
  align?: "start" | "end";
}) {
  const tier = sender.credibilityTier;
  const canOpenProfile = Boolean(sender.showcaseSlug && onProfileClick);
  const mine = align === "end";

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-[11px] text-white/45",
        mine && "flex-row-reverse text-right",
      )}
    >
      <button
        type="button"
        disabled={!canOpenProfile}
        onClick={() => {
          if (sender.showcaseSlug && onProfileClick) onProfileClick(sender.showcaseSlug);
        }}
        className={cn(
          "relative shrink-0 rounded-xl disabled:cursor-default",
          tier ? tierRing[tier] : "",
        )}
      >
        <ProfileAvatar
          avatarUrl={sender.avatarUrl}
          displayName={sender.displayName}
          size="sm"
          className="h-8 w-8 rounded-xl"
        />
        {tier ? (
          <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/90">
            {tierBadge[tier]}
          </span>
        ) : null}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5",
            mine && "justify-end",
          )}
        >
          <button
            type="button"
            disabled={!canOpenProfile}
            onClick={() => {
              if (sender.showcaseSlug && onProfileClick) onProfileClick(sender.showcaseSlug);
            }}
            className={cn(
              "truncate font-semibold",
              canOpenProfile
                ? "text-bordin-orange hover:underline"
                : "text-white/70",
              tier === "top5" && "text-yellow-300",
            )}
          >
            {sender.displayName}
          </button>
          {sender.levelNameFa ? (
            <span className="rounded-full bg-bordin-green/10 px-2 py-0.5 text-bordin-green">
              {sender.levelNameFa}
            </span>
          ) : null}
          {sender.globalRank != null && sender.globalRank <= 5 ? (
            <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-yellow-300">
              رتبه {formatPersianNumber(sender.globalRank)}
            </span>
          ) : null}
        </div>
      </div>

      <span className={cn("shrink-0 tabular-nums", mine ? "me-auto" : "ms-auto")}>{timeLabel}</span>
    </div>
  );
}

export function credibilityMessageClass(tier: ChatCredibilityTier) {
  if (tier === "top5") return "border-yellow-400/30 bg-yellow-400/5";
  if (tier === "veteran") return "border-bordin-orange/25 bg-bordin-orange/8";
  if (tier === "medalist") return "border-bordin-green/20 bg-bordin-green/5";
  return "border-white/10 bg-white/[0.04]";
}
