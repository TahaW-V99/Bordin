"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Chip } from "@/shared/components/ui/chip";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { NotificationCard } from "@/features/messages/components/notification-card";
import {
  DEFAULT_NOTIFICATION_FILTER,
  NOTIFICATION_FILTERS,
  dispatchNotificationsUpdated,
  emptyNotificationUnreadByCategory,
  resolveMessagesBackHref,
  type NotificationUnreadByCategory,
  type NotificationCategoryKey,
} from "@/shared/constants/notifications";
import { Mail } from "lucide-react";
export type NotificationItem = {
  id: string;
  type: string;
  category: string;
  titleFa: string;
  bodyFa: string | null;
  link: string | null;
  secondaryLink: string | null;
  secondaryLinkLabelFa: string | null;
  isRead: boolean;
  createdAt: string;
};

function sortNotifications(items: NotificationItem[]) {
  return [...items].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function MessagesPage() {
  const searchParams = useSearchParams();
  const backHref = resolveMessagesBackHref(searchParams.get("from"));
  const [filter, setFilter] = useState<NotificationCategoryKey>(DEFAULT_NOTIFICATION_FILTER);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadByCategory, setUnreadByCategory] = useState<NotificationUnreadByCategory>(
    emptyNotificationUnreadByCategory(),
  );
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const formatUnreadBadge = (count: number) => {
    if (count > 99) return "+99";
    return String(count);
  };

  const load = useCallback(async (category: NotificationCategoryKey) => {
    setLoading(true);
    const res = await fetch(`/api/notifications?category=${category}`, { cache: "no-store" });
    const data = await res.json();
    setItems(sortNotifications(data.notifications ?? []));
    setUnreadByCategory(data.unreadByCategory ?? emptyNotificationUnreadByCategory());
    if (typeof data.unreadCount === "number") {
      dispatchNotificationsUpdated(data.unreadCount);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const markRead = async (id: string) => {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) =>
        sortNotifications(
          prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        ),
      );
      setUnreadByCategory((prev) => ({
        ...prev,
        [filter]: Math.max(0, prev[filter] - 1),
      }));
      dispatchNotificationsUpdated(data.unreadCount);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="صندوق پیغام‌ها"
        startAction={
          <Link
            href={backHref}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        }
      />

      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-4 scrollbar-hide">
        {NOTIFICATION_FILTERS.map((item) => (
          <div key={item.key} className="relative shrink-0">
            <Chip active={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.labelFa}
            </Chip>
            {unreadByCategory[item.key] > 0 ? (
              <span className="pointer-events-none absolute -left-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-5 text-white">
                {formatUnreadBadge(unreadByCategory[item.key])}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <div className="space-y-3 px-4 pb-6">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="پیغامی نیست"
            description="فعلاً پیغامی در این بخش برای شما ثبت نشده است."
          />
        ) : (
          items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              loading={markingId === item.id}
              onAcknowledge={() => void markRead(item.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
