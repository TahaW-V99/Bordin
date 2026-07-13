"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  dispatchNotificationsUpdated,
  NOTIFICATIONS_UPDATED_EVENT,
} from "@/shared/constants/notifications";
import { WATCH_PARTY_INVITE_NOTIFICATION_TYPE } from "@/shared/constants/watch-party";

type PushNotification = {
  id: string;
  type: string;
  titleFa: string;
  bodyFa: string | null;
  link: string | null;
  isRead: boolean;
};

const POLL_MS = 20_000;

function parseWatchPartyMatchId(link: string | null) {
  if (!link) return null;
  try {
    const url = new URL(link, window.location.origin);
    return url.searchParams.get("watchParty");
  } catch {
    const match = link.match(/watchParty=([^&]+)/);
    return match?.[1] ?? null;
  }
}

function findPendingWatchPartyNotification(rows: PushNotification[] | undefined) {
  return rows?.find((row) => !row.isRead && row.type === WATCH_PARTY_INVITE_NOTIFICATION_TYPE);
}

async function dismissNotification(notificationId: string) {
  await fetch(`/api/notifications/${notificationId}/read`, { method: "POST" });
  dispatchNotificationsUpdated();
}

export function WatchPartyInvitePushBanner() {
  const router = useRouter();
  const [notification, setNotification] = useState<PushNotification | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?category=message", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNotification(findPendingWatchPartyNotification(data.notifications) ?? null);
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

  const matchId = parseWatchPartyMatchId(notification.link);

  const close = async () => {
    await dismissNotification(notification.id);
    setNotification(null);
  };

  const accept = async () => {
    await dismissNotification(notification.id);
    if (matchId) {
      router.push(`/home?watchParty=${matchId}`);
    }
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
          <p className="text-xs font-bold text-bordin-orange">دعوت تماشای گروهی</p>
          <p className="mt-1 text-sm leading-6 text-white/90">{notification.titleFa}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void accept()}>
              اره حتما
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void close()}>
              فعلا نه
            </Button>
          </div>
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
