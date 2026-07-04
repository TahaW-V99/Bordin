"use client";

import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { formatTehranDateTime } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { parsePlacementNotificationBody } from "@/shared/lib/team-competition-placement-notification";
import { TeamCompetitionPlacementRewards } from "@/features/messages/components/team-competition-placement-rewards";
import type { NotificationItem } from "@/features/messages/components/messages-page";

export function NotificationCard({
  item,
  loading,
  onAcknowledge,
}: {
  item: NotificationItem;
  loading?: boolean;
  onAcknowledge: () => void;
}) {
  const isUnread = !item.isRead;
  const isPredictionSettled = item.type === "PREDICTION_SETTLED";
  const isLeaderboardRankUp = item.type === "LEADERBOARD_RANK_UP";
  const isTeamLeaderboardRankUp = item.type === "TEAM_LEADERBOARD_RANK_UP";
  const isCompetition = item.type === "COMPETITION";
  const hasCustomSecondaryAction = Boolean(item.secondaryLink);
  const hasSecondaryAction =
    hasCustomSecondaryAction ||
    isPredictionSettled ||
    isLeaderboardRankUp ||
    isTeamLeaderboardRankUp ||
    isCompetition;
  const isTeamInvite = item.type === "TEAM_INVITE";
  const { message: bodyMessage, rewards: placementRewards } = parsePlacementNotificationBody(
    item.bodyFa,
  );
  const actionLink = isTeamInvite
    ? (item.secondaryLink ?? item.link ?? "/profile/teams")
    : hasSecondaryAction
    ? (item.secondaryLink ??
        (isLeaderboardRankUp
          ? "/leaderboard?tab=global&highlight=1"
          : isTeamLeaderboardRankUp
            ? "/leaderboard?tab=teams"
            : isCompetition
              ? item.link
              : "/profile/predictions?filter=settled"))
    : item.type === "REWARD"
      ? (item.link ?? "/profile/predictions?filter=settled")
      : item.link;
  const actionLabel = isTeamInvite
    ? (item.secondaryLinkLabelFa ?? "مشاهده")
    : hasSecondaryAction
    ? (item.secondaryLinkLabelFa ??
        (isLeaderboardRankUp
          ? "دیدن جایگاه"
          : isTeamLeaderboardRankUp
            ? "نشانم بده"
            : isCompetition
              ? "نشونم بده"
              : "نشونم بده"))
    : "مشاهده";

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        isUnread
          ? "border-bordin-orange/50 bg-bordin-orange/10"
          : "border-bordin-green/30 bg-bordin-green/5",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-bold leading-7 text-white">{item.titleFa}</h3>
        <time className="shrink-0 text-[10px] text-white/40">
          {formatTehranDateTime(item.createdAt)}
        </time>
      </div>

      {bodyMessage ? (
        <p className="mb-4 text-sm leading-7 text-white/65">{bodyMessage}</p>
      ) : null}

      {placementRewards ? <TeamCompetitionPlacementRewards rewards={placementRewards} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        {actionLink ? (
          <Link
            href={actionLink}
            onClick={() => {
              if (isTeamInvite && isUnread) onAcknowledge();
            }}
          >
            <Button size="sm" variant="secondary">
              {actionLabel}
            </Button>
          </Link>
        ) : null}
        {isUnread ? (
          <Button size="sm" loading={loading} onClick={onAcknowledge}>
            متوجه شدم
          </Button>
        ) : (
          <span className="text-xs text-bordin-green">خوانده شد</span>
        )}
      </div>
    </article>
  );
}
