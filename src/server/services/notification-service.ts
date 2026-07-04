import { NotificationCategory, NotificationType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";
import {
  categoryKeyToEnum,
  emptyNotificationUnreadByCategory,
  WELCOME_NOTIFICATION_BODY,
  WELCOME_NOTIFICATION_TITLE,
  type NotificationUnreadByCategory,
  type NotificationCategoryKey,
} from "@/shared/constants/notifications";

export type NotificationDto = {
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

function serialize(row: {
  id: string;
  type: string;
  category: string;
  titleFa: string;
  bodyFa: string | null;
  link: string | null;
  secondaryLink?: string | null;
  secondaryLinkLabelFa?: string | null;
  isRead: boolean;
  createdAt: Date;
}): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    titleFa: row.titleFa,
    bodyFa: row.bodyFa,
    link: row.link,
    secondaryLink: row.secondaryLink ?? null,
    secondaryLinkLabelFa: row.secondaryLinkLabelFa ?? null,
    isRead: row.isRead,
    createdAt: row.createdAt.toISOString(),
  };
}

function sortNotifications<T extends { isRead: boolean; createdAt: Date }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

async function resolveUserId(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = await ensureMemoryUser(userId);
    return user?.id ?? userId;
  }
  return userId;
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  category?: NotificationCategory;
  titleFa: string;
  bodyFa?: string | null;
  link?: string | null;
  secondaryLink?: string | null;
  secondaryLinkLabelFa?: string | null;
}) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.notifications.create({
      userId: input.userId,
      type: input.type,
      category: input.category ?? NotificationCategory.MESSAGE,
      titleFa: input.titleFa,
      bodyFa: input.bodyFa ?? null,
      link: input.link ?? null,
      secondaryLink: input.secondaryLink ?? null,
      secondaryLinkLabelFa: input.secondaryLinkLabelFa ?? null,
    });
  }

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      category: input.category ?? NotificationCategory.MESSAGE,
      titleFa: input.titleFa,
      bodyFa: input.bodyFa,
      link: input.link,
      secondaryLink: input.secondaryLink,
      secondaryLinkLabelFa: input.secondaryLinkLabelFa,
    },
  });
}

/** یک پیام خوش‌آمدگویی در بخش پیغام‌ها — بدون نمونه‌های تستی دیگر */
export async function ensureWelcomeNotification(userId: string) {
  if (await shouldUseMemoryDb()) {
    devMemoryDb.notifications.ensureWelcome(userId);
    return;
  }

  const existing = await prisma.notification.findFirst({
    where: { userId, titleFa: WELCOME_NOTIFICATION_TITLE },
  });
  if (existing) return;

  await prisma.notification.create({
    data: {
      userId,
      type: NotificationType.SYSTEM,
      category: NotificationCategory.MESSAGE,
      titleFa: WELCOME_NOTIFICATION_TITLE,
      bodyFa: WELCOME_NOTIFICATION_BODY,
      isRead: false,
    },
  });
}

/** @deprecated از ensureWelcomeNotification استفاده کنید */
export async function ensureSampleNotifications(userId: string) {
  return ensureWelcomeNotification(userId);
}

export async function listUserNotifications(userId: string, filter: NotificationCategoryKey) {
  const uid = await resolveUserId(userId);
  await ensureWelcomeNotification(uid);
  const category = categoryKeyToEnum(filter);

  if (await shouldUseMemoryDb()) {
    const rows = devMemoryDb.notifications.listForUser(uid, category);
    return sortNotifications(rows).map(serialize);
  }

  const rows = await prisma.notification.findMany({
    where: { userId: uid, category },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
  });

  return rows.map(serialize);
}

export async function getUnreadNotificationCount(userId: string) {
  const uid = await resolveUserId(userId);
  await ensureWelcomeNotification(uid);

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.notifications.unreadCount(uid);
  }

  return prisma.notification.count({
    where: { userId: uid, isRead: false },
  });
}

export async function getUnreadNotificationCountsByCategory(
  userId: string,
): Promise<NotificationUnreadByCategory> {
  const uid = await resolveUserId(userId);
  await ensureWelcomeNotification(uid);

  if (await shouldUseMemoryDb()) {
    const counts = emptyNotificationUnreadByCategory();
    for (const row of devMemoryDb.notifications.listForUser(uid)) {
      if (row.isRead) continue;
      if (row.category === NotificationCategory.MESSAGE) counts.message += 1;
      if (row.category === NotificationCategory.ANNOUNCEMENT) counts.announcement += 1;
      if (row.category === NotificationCategory.DISCOUNT) counts.discount += 1;
    }
    return counts;
  }

  const rows = await prisma.notification.groupBy({
    by: ["category"],
    where: { userId: uid, isRead: false },
    _count: { _all: true },
  });

  const counts = emptyNotificationUnreadByCategory();
  for (const row of rows) {
    if (row.category === NotificationCategory.MESSAGE) counts.message = row._count._all;
    if (row.category === NotificationCategory.ANNOUNCEMENT) counts.announcement = row._count._all;
    if (row.category === NotificationCategory.DISCOUNT) counts.discount = row._count._all;
  }
  return counts;
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const uid = await resolveUserId(userId);

  if (await shouldUseMemoryDb()) {
    const updated = devMemoryDb.notifications.markRead(uid, notificationId);
    if (!updated) throw new Error("پیغام یافت نشد");
    return serialize(updated);
  }

  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId: uid },
  });
  if (!existing) throw new Error("پیغام یافت نشد");

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return serialize(updated);
}

export async function dismissTeamInviteNotifications(userId: string, inviteId: string) {
  const uid = await resolveUserId(userId);
  const linkNeedle = `inviteId=${inviteId}`;

  if (await shouldUseMemoryDb()) {
    devMemoryDb.notifications.dismissTeamInvite(uid, inviteId);
    return;
  }

  await prisma.notification.updateMany({
    where: {
      userId: uid,
      type: NotificationType.TEAM_INVITE,
      isRead: false,
      OR: [
        { link: { contains: linkNeedle } },
        { secondaryLink: { contains: linkNeedle } },
      ],
    },
    data: { isRead: true },
  });
}
