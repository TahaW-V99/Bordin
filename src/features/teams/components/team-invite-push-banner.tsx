"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  dispatchNotificationsUpdated,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/shared/constants/notifications";
import { TEAM_MEMBERSHIP_REQUEST_NOTIFICATION_TITLE } from "@/shared/constants/team-competition-user";

type PushNotification = {
  id: string;
  type: string;
  titleFa: string;
  bodyFa: string | null;
  link: string | null;
  isRead: boolean;
};

const POLL_MS = 20_000;

function parseInviteIdFromLink(link: string | null) {
  if (!link) return null;
  try {
    const url = new URL(link, window.location.origin);
    return url.searchParams.get("inviteId");
  } catch {
    const match = link.match(/inviteId=([^&]+)/);
    return match?.[1] ?? null;
  }
}

function isMembershipRequestNotification(row: PushNotification) {
  return (
    row.type === "COMPETITION" &&
    row.titleFa === TEAM_MEMBERSHIP_REQUEST_NOTIFICATION_TITLE
  );
}

function findPendingPushNotification(rows: PushNotification[] | undefined) {
  return rows?.find(
    (row) =>
      !row.isRead &&
      (row.type === "TEAM_INVITE" || isMembershipRequestNotification(row)),
  );
}

function resolveViewHref(notification: PushNotification) {
  if (notification.type === "TEAM_INVITE") {
    const inviteId = parseInviteIdFromLink(notification.link);
    return inviteId ? `/profile/teams?inviteId=${inviteId}` : "/profile/teams";
  }
  return "/profile/teams";
}

async function dismissInviteNotification(inviteId: string) {
  const res = await fetch("/api/notifications/dismiss-team-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteId }),
  });
  if (res.ok) {
    const data = await res.json();
    dispatchNotificationsUpdated(
      typeof data.unreadCount === "number" ? data.unreadCount : undefined,
    );
  }
}

async function dismissPushNotification(notification: PushNotification) {
  if (notification.type === "TEAM_INVITE") {
    const inviteId = parseInviteIdFromLink(notification.link);
    if (inviteId) {
      await dismissInviteNotification(inviteId);
      return;
    }
  }
  await fetch(`/api/notifications/${notification.id}/read`, { method: "POST" });
  dispatchNotificationsUpdated();
}

export function TeamInvitePushBanner() {
  const router = useRouter();
  const [notification, setNotification] = useState<PushNotification | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?category=message", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotification(findPendingPushNotification(data.notifications) ?? null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    const interval = setInterval(() => void load(), POLL_MS);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [load]);

  if (!notification) return null;

  const isInvite = notification.type === "TEAM_INVITE";
  const viewHref = resolveViewHref(notification);

  const close = async () => {
    await dismissPushNotification(notification);
    setNotification(null);
  };

  const open = async () => {
    await dismissPushNotification(notification);
    router.push(viewHref);
    setNotification(null);
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] mx-auto max-w-lg px-3 pt-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3 rounded-2xl border border-bordin-orange/40 bg-[#1a1208] p-4 shadow-2xl">
        <div className="min-w-0 flex-1 text-right">
          <p className="text-xs font-bold text-bordin-orange">
            {isInvite ? "دعوت به تیم" : "درخواست عضویت"}
          </p>
          <p className="mt-1 text-sm leading-6 text-white/90">{notification.titleFa}</p>
          {notification.bodyFa && notification.bodyFa !== notification.titleFa ? (
            <p className="mt-1 text-xs leading-6 text-white/60">{notification.bodyFa}</p>
          ) : null}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => void open()}>
            مشاهده
          </Button>
        </div>
        <button
          type="button"
          onClick={() => void close()}
          className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
          aria-label="بستن"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
