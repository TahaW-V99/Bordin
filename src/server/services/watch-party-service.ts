import { addDays } from "date-fns";
import { CoinTransactionType, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { serializeKickoffAt } from "@/shared/lib/dates";
import { translateMatchTeamsToFa } from "@/shared/lib/football-names-fa";
import { deductCoinsWithType } from "@/server/services/wallet-service";
import { createNotification } from "@/server/services/notification-service";
import { sendTransactionalSms } from "@/server/services/sms-service";
import { getWatchPartyUiPhase, canSendWatchPartyInvite } from "@/shared/lib/watch-party-timing";
import { ONLINE_PRESENCE_MS } from "@/shared/constants/watch-party";

let watchPartyTableReady: boolean | null = null;

const WATCH_PARTY_SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS watch_party_rooms (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    matchId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    googleMeetUrl TEXT NOT NULL,
    capacity INT NOT NULL,
    entryFeeCoins INT NOT NULL,
    isPublished TINYINT(1) NOT NULL DEFAULT 0,
    publishedAt DATETIME(3) NULL,
    createdById VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY watch_party_rooms_matchId_key (matchId),
    KEY watch_party_rooms_isPublished_idx (isPublished),
    CONSTRAINT watch_party_rooms_matchId_fkey FOREIGN KEY (matchId) REFERENCES football_matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_rooms_createdById_fkey FOREIGN KEY (createdById) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS watch_party_entries (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    roomId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    userId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    paidCoins INT NOT NULL,
    joinedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY watch_party_entries_roomId_userId_key (roomId, userId),
    KEY watch_party_entries_roomId_idx (roomId),
    KEY watch_party_entries_userId_idx (userId),
    CONSTRAINT watch_party_entries_roomId_fkey FOREIGN KEY (roomId) REFERENCES watch_party_rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_entries_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS watch_party_invites (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    roomId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    inviterId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    inviteeId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    pushSentAt DATETIME(3) NULL,
    smsSentAt DATETIME(3) NULL,
    dismissedAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY watch_party_invites_roomId_inviterId_inviteeId_key (roomId, inviterId, inviteeId),
    KEY watch_party_invites_inviteeId_dismissedAt_idx (inviteeId, dismissedAt),
    CONSTRAINT watch_party_invites_roomId_fkey FOREIGN KEY (roomId) REFERENCES watch_party_rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_invites_inviterId_fkey FOREIGN KEY (inviterId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_invites_inviteeId_fkey FOREIGN KEY (inviteeId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

async function hasWatchPartyTable() {
  if (watchPartyTableReady !== null) return watchPartyTableReady;
  if (await shouldUseMemoryDb()) {
    watchPartyTableReady = false;
    return false;
  }

  const rows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
    SELECT COUNT(*) AS cnt
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'watch_party_rooms'
  `;
  watchPartyTableReady = Number(rows[0]?.cnt ?? 0) > 0;
  return watchPartyTableReady;
}

async function ensureWatchPartySchema() {
  if (await shouldUseMemoryDb()) return false;
  if (await hasWatchPartyTable()) return true;

  try {
    for (const sql of WATCH_PARTY_SCHEMA_DDL) {
      await prisma.$executeRawUnsafe(sql);
    }
    watchPartyTableReady = true;
    return true;
  } catch (error) {
    console.error("[Bordin:watch-party] schema ensure failed:", error);
    watchPartyTableReady = false;
    return false;
  }
}

export type AdminKandakatorMatchOption = {
  matchId: string;
  kandakatorMatchId: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string;
  kickoffAt: string;
  hasPublishedRoom: boolean;
};

export type WatchPartyRoomDto = {
  id: string;
  matchId: string;
  googleMeetUrl: string;
  capacity: number;
  entryFeeCoins: number;
  isPublished: boolean;
  publishedAt: string | null;
  occupiedCount: number;
  match: {
    homeTeamName: string;
    awayTeamName: string;
    leagueName: string | null;
    kickoffAt: string;
  };
};

export type WatchPartyPublicDto = {
  roomId: string;
  matchId: string;
  capacity: number;
  entryFeeCoins: number;
  occupiedCount: number;
  hasJoined: boolean;
  uiPhase: "hidden" | "upcoming" | "active";
  googleMeetUrl: string | null;
};

export type WatchPartyUserOption = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
};

type PublishRoomInput = {
  matchId: string;
  googleMeetUrl: string;
  capacity: number;
  entryFeeCoins: number;
};

function isWatchPartySchemaMissing(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P1014")
  );
}

function normalizeMeetUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) throw new Error("لینک گوگل میت الزامی است");
  try {
    const parsed = new URL(trimmed);
    if (!parsed.protocol.startsWith("http")) throw new Error("invalid");
    return parsed.toString();
  } catch {
    throw new Error("لینک گوگل میت معتبر نیست");
  }
}

function serializeRoom(
  room: {
    id: string;
    matchId: string;
    googleMeetUrl: string;
    capacity: number;
    entryFeeCoins: number;
    isPublished: boolean;
    publishedAt: Date | null;
    match: {
      homeTeamName: string;
      awayTeamName: string;
      leagueName: string | null;
      kickoffAt: Date;
    };
    _count?: { entries: number };
  },
): WatchPartyRoomDto {
  const translated = translateMatchTeamsToFa(room.match);
  return {
    id: room.id,
    matchId: room.matchId,
    googleMeetUrl: room.googleMeetUrl,
    capacity: room.capacity,
    entryFeeCoins: room.entryFeeCoins,
    isPublished: room.isPublished,
    publishedAt: room.publishedAt?.toISOString() ?? null,
    occupiedCount: room._count?.entries ?? 0,
    match: {
      homeTeamName: translated.homeTeamName,
      awayTeamName: translated.awayTeamName,
      leagueName: translated.leagueName,
      kickoffAt: serializeKickoffAt(room.match.kickoffAt),
    },
  };
}

export async function listUpcomingKandakatorMatchesForAdmin() {
  if (await shouldUseMemoryDb()) return [];

  await ensureWatchPartySchema();

  const now = new Date();
  const weekEnd = addDays(now, 7);
  const tableReady = await hasWatchPartyTable();

  const rows = await prisma.kandakatorMatch.findMany({
    where: {
      kandakator: { isPublished: true },
      match: {
        kickoffAt: { gte: now, lte: weekEnd },
        status: { notIn: ["CANCELLED", "POSTPONED"] },
      },
    },
    include: {
      match: tableReady
        ? {
            include: {
              watchPartyRoom: { select: { id: true, isPublished: true } },
            },
          }
        : true,
    },
    orderBy: { match: { kickoffAt: "asc" } },
  });

  return rows.map((row) => {
    const translated = translateMatchTeamsToFa(row.match);
    const watchPartyRoom =
      tableReady && "watchPartyRoom" in row.match
        ? (row.match as { watchPartyRoom?: { isPublished: boolean } | null }).watchPartyRoom
        : null;
    return {
      matchId: row.matchId,
      kandakatorMatchId: row.id,
      homeTeamName: translated.homeTeamName,
      awayTeamName: translated.awayTeamName,
      leagueName: translated.leagueName?.trim() || "سایر مسابقات",
      kickoffAt: serializeKickoffAt(row.match.kickoffAt),
      hasPublishedRoom: Boolean(watchPartyRoom?.isPublished),
    } satisfies AdminKandakatorMatchOption;
  });
}

export async function listAdminWatchPartyRooms() {
  if (await shouldUseMemoryDb()) return [];
  if (!(await ensureWatchPartySchema())) return [];

  try {
    const rooms = await prisma.watchPartyRoom.findMany({
      include: {
        match: true,
        _count: { select: { entries: true } },
      },
      orderBy: { match: { kickoffAt: "asc" } },
    });

    return rooms.map(serializeRoom);
  } catch (error) {
    if (isWatchPartySchemaMissing(error)) return [];
    throw error;
  }
}

export async function publishWatchPartyRooms(
  adminUserId: string,
  rooms: PublishRoomInput[],
) {
  if (await shouldUseMemoryDb()) {
    throw new Error("watch party در حالت حافظه پشتیبانی نمی‌شود");
  }

  if (!(await ensureWatchPartySchema())) {
    throw new Error("جداول Watch Party در دیتابیس آماده نیستند");
  }

  if (rooms.length === 0) throw new Error("حداقل یک مسابقه انتخاب کنید");

  const published: WatchPartyRoomDto[] = [];
  const now = new Date();

  for (const input of rooms) {
    const capacity = Math.floor(input.capacity);
    const entryFeeCoins = Math.floor(input.entryFeeCoins);
    if (capacity < 1 || capacity > 500) {
      throw new Error("ظرفیت هر اتاق باید بین ۱ تا ۵۰۰ باشد");
    }
    if (entryFeeCoins < 0) throw new Error("هزینه ورود نمی‌تواند منفی باشد");

    const meetUrl = normalizeMeetUrl(input.googleMeetUrl);

    const match = await prisma.footballMatch.findUnique({
      where: { id: input.matchId },
      include: { kandakatorMatches: { where: { kandakator: { isPublished: true } } } },
    });
    if (!match || match.kandakatorMatches.length === 0) {
      throw new Error("مسابقه در کنداکتور منتشر نشده است");
    }

    const room = await prisma.watchPartyRoom.upsert({
      where: { matchId: input.matchId },
      create: {
        matchId: input.matchId,
        googleMeetUrl: meetUrl,
        capacity,
        entryFeeCoins,
        isPublished: true,
        publishedAt: now,
        createdById: adminUserId,
      },
      update: {
        googleMeetUrl: meetUrl,
        capacity,
        entryFeeCoins,
        isPublished: true,
        publishedAt: now,
        createdById: adminUserId,
      },
      include: {
        match: true,
        _count: { select: { entries: true } },
      },
    });

    published.push(serializeRoom(room));
  }

  return published;
}

export async function getWatchPartyMapForMatchIds(
  userId: string,
  matchIds: string[],
): Promise<Map<string, WatchPartyPublicDto>> {
  const map = new Map<string, WatchPartyPublicDto>();
  if (matchIds.length === 0 || !(await ensureWatchPartySchema())) return map;

  let rooms;
  try {
    rooms = await prisma.watchPartyRoom.findMany({
      where: {
        matchId: { in: matchIds },
        isPublished: true,
      },
      include: {
        match: true,
        entries: {
          where: { userId },
          select: { id: true },
        },
        _count: { select: { entries: true } },
      },
    });
  } catch (error) {
    if (isWatchPartySchemaMissing(error)) return map;
    throw error;
  }

  for (const room of rooms) {
    const uiPhase = getWatchPartyUiPhase(room.match.kickoffAt);
    if (uiPhase === "hidden") continue;

    const hasJoined = room.entries.length > 0;
    map.set(room.matchId, {
      roomId: room.id,
      matchId: room.matchId,
      capacity: room.capacity,
      entryFeeCoins: room.entryFeeCoins,
      occupiedCount: room._count.entries,
      hasJoined,
      uiPhase,
      googleMeetUrl: hasJoined ? room.googleMeetUrl : null,
    });
  }

  return map;
}

export async function getWatchPartyStatusForUser(userId: string, matchId: string) {
  if (await shouldUseMemoryDb()) return null;

  const room = await prisma.watchPartyRoom.findFirst({
    where: { matchId, isPublished: true },
    include: {
      match: true,
      entries: { where: { userId }, select: { id: true } },
      _count: { select: { entries: true } },
    },
  });
  if (!room) return null;

  const uiPhase = getWatchPartyUiPhase(room.match.kickoffAt);
  if (uiPhase === "hidden") return null;

  const hasJoined = room.entries.length > 0;
  return {
    roomId: room.id,
    matchId: room.matchId,
    capacity: room.capacity,
    entryFeeCoins: room.entryFeeCoins,
    occupiedCount: room._count.entries,
    hasJoined,
    isFull: room._count.entries >= room.capacity,
    uiPhase,
    googleMeetUrl: hasJoined ? room.googleMeetUrl : null,
    match: translateMatchTeamsToFa({
      homeTeamName: room.match.homeTeamName,
      awayTeamName: room.match.awayTeamName,
      kickoffAt: serializeKickoffAt(room.match.kickoffAt),
    }),
  };
}

export async function joinWatchParty(userId: string, roomId: string) {
  if (await shouldUseMemoryDb()) {
    throw new Error("watch party در حالت حافظه پشتیبانی نمی‌شود");
  }

  const room = await prisma.watchPartyRoom.findUnique({
    where: { id: roomId },
    include: {
      match: true,
      entries: { where: { userId }, select: { id: true } },
      _count: { select: { entries: true } },
    },
  });
  if (!room?.isPublished) throw new Error("اتاق یافت نشد");

  const uiPhase = getWatchPartyUiPhase(room.match.kickoffAt);
  if (uiPhase !== "active") throw new Error("هنوز زمان ورود به اتاق فرا نرسیده");

  if (room.entries.length > 0) {
    return { googleMeetUrl: room.googleMeetUrl, alreadyJoined: true };
  }

  if (room._count.entries >= room.capacity) {
    throw new Error("ظرفیت اتاق تکمیل شده");
  }

  if (room.entryFeeCoins > 0) {
    const label = `${room.match.homeTeamName} - ${room.match.awayTeamName}`;
    await deductCoinsWithType(
      userId,
      room.entryFeeCoins,
      CoinTransactionType.WATCH_PARTY_ENTRY,
      `ورود به تماشای گروهی ${label}`,
    );
  }

  await prisma.watchPartyEntry.create({
    data: {
      roomId: room.id,
      userId,
      paidCoins: room.entryFeeCoins,
    },
  });

  return { googleMeetUrl: room.googleMeetUrl, alreadyJoined: false };
}

export async function listUsersForWatchPartyInvite(
  userId: string,
  search?: string,
) {
  if (await shouldUseMemoryDb()) return [];

  const onlineThreshold = new Date(Date.now() - ONLINE_PRESENCE_MS);
  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      isActive: true,
      ...(search?.trim()
        ? {
            OR: [
              { profile: { displayName: { contains: search.trim() } } },
              { username: { contains: search.trim() } },
              { phone: { contains: search.trim() } },
            ],
          }
        : {}),
    },
    include: {
      profile: { select: { displayName: true, avatarUrl: true } },
    },
    take: 60,
    orderBy: { lastSeenAt: "desc" },
  });

  return users.map((user) => ({
    id: user.id,
    displayName: user.profile?.displayName?.trim() || user.phone,
    avatarUrl: user.profile?.avatarUrl ?? null,
    isOnline: Boolean(user.lastSeenAt && user.lastSeenAt >= onlineThreshold),
  })) satisfies WatchPartyUserOption[];
}

export async function inviteUsersToWatchParty(
  inviterId: string,
  roomId: string,
  inviteeIds: string[],
) {
  if (await shouldUseMemoryDb()) {
    throw new Error("watch party در حالت حافظه پشتیبانی نمی‌شود");
  }

  const uniqueInvitees = [...new Set(inviteeIds.filter((id) => id && id !== inviterId))];
  if (uniqueInvitees.length === 0) throw new Error("حداقل یک کاربر انتخاب کنید");

  const room = await prisma.watchPartyRoom.findUnique({
    where: { id: roomId },
    include: {
      match: true,
      _count: { select: { entries: true } },
    },
  });
  if (!room?.isPublished) throw new Error("اتاق یافت نشد");

  if (!canSendWatchPartyInvite(room.match.kickoffAt)) {
    throw new Error("زمان ارسال دعوت‌نامه به پایان رسیده");
  }

  const remaining = room.capacity - room._count.entries;
  if (uniqueInvitees.length > remaining) {
    throw new Error(`حداکثر ${remaining} نفر را می‌توانید دعوت کنید`);
  }

  const inviter = await prisma.user.findUnique({
    where: { id: inviterId },
    include: { profile: { select: { displayName: true } } },
  });
  if (!inviter) throw new Error("کاربر یافت نشد");

  const inviterName = inviter.profile?.displayName?.trim() || inviter.phone;
  const matchLabel = `${room.match.homeTeamName} - ${room.match.awayTeamName}`;
  const link = `/home?watchParty=${room.matchId}`;

  let pushSent = 0;
  let smsSent = 0;

  for (const inviteeId of uniqueInvitees) {
    const existingInvite = await prisma.watchPartyInvite.findUnique({
      where: {
        roomId_inviterId_inviteeId: {
          roomId,
          inviterId,
          inviteeId,
        },
      },
    });
    if (existingInvite?.pushSentAt) continue;

    const invitee = await prisma.user.findUnique({
      where: { id: inviteeId, isActive: true },
      include: { profile: { select: { displayName: true } } },
    });
    if (!invitee) continue;

    await prisma.watchPartyInvite.upsert({
      where: {
        roomId_inviterId_inviteeId: { roomId, inviterId, inviteeId },
      },
      create: { roomId, inviterId, inviteeId, pushSentAt: new Date() },
      update: { pushSentAt: new Date(), dismissedAt: null },
    });

    await createNotification({
      userId: inviteeId,
      type: NotificationType.WATCH_PARTY_INVITE,
      titleFa: `${inviterName} شما رو به تماشای گروهی بازی ${matchLabel} دعوت کرده. ملحق میشی؟`,
      bodyFa: null,
      link,
      secondaryLink: link,
      secondaryLinkLabelFa: "اره حتما",
    });

    pushSent += 1;

    if (!existingInvite?.smsSentAt) {
      const smsBody = `بدو بدو! ${inviterName} برای تماشای زنده و گروهی مسابقه ${matchLabel} دعوتت کرده! تا ظرفیت تکمیل نشده، ملحق شو. https://bordin.ir/home`;
      try {
        await sendTransactionalSms(invitee.phone, smsBody);
        await prisma.watchPartyInvite.update({
          where: {
            roomId_inviterId_inviteeId: { roomId, inviterId, inviteeId },
          },
          data: { smsSentAt: new Date() },
        });
        smsSent += 1;
      } catch {
        // SMS failure should not block push
      }
    }
  }

  return { pushSent, smsSent };
}

export async function dismissWatchPartyInviteNotification(
  userId: string,
  notificationId: string,
) {
  if (await shouldUseMemoryDb()) return null;

  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId, type: NotificationType.WATCH_PARTY_INVITE },
  });
  if (!notification) return null;

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  const matchId = notification.link?.match(/watchParty=([^&]+)/)?.[1];
  if (matchId) {
    await prisma.watchPartyInvite.updateMany({
      where: {
        inviteeId: userId,
        dismissedAt: null,
        room: { matchId },
      },
      data: { dismissedAt: new Date() },
    });
  }

  return notification;
}

export async function touchUserPresence(userId: string) {
  if (await shouldUseMemoryDb()) return;
  await prisma.user.update({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });
}
