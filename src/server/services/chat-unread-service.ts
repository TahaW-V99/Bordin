import { ChatRoomSlug } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  CHAT_ROOMS,
  chatRoomSlugToDb,
  parseChatRoomParam,
  type ChatRoomSlugKey,
} from "@/shared/constants/chat";

const memoryReads = new Map<string, Date>();

function memoryKey(userId: string, roomKey: string) {
  return `${userId}:${roomKey}`;
}

export async function markChatRoomRead(userId: string, roomParam: string) {
  const parsed = parseChatRoomParam(roomParam);
  if (!parsed) return;

  const now = new Date();
  const roomKey = parsed.roomKey;
  if (await shouldUseMemoryDb()) {
    memoryReads.set(memoryKey(userId, roomKey), now);
    return;
  }

  await prisma.chatRoomRead.upsert({
    where: { userId_roomKey: { userId, roomKey } },
    create: { userId, roomKey, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

async function getLastReadAt(userId: string, roomKey: string): Promise<Date | null> {
  if (await shouldUseMemoryDb()) {
    return memoryReads.get(memoryKey(userId, roomKey)) ?? null;
  }

  const row = await prisma.chatRoomRead.findUnique({
    where: { userId_roomKey: { userId, roomKey } },
    select: { lastReadAt: true },
  });
  return row?.lastReadAt ?? null;
}

async function countUnreadForRoomKey(
  userId: string,
  roomKey: string,
  roomSlug: ChatRoomSlug,
  teamId: string | null,
): Promise<number> {
  if (await shouldUseMemoryDb()) return 0;

  const lastReadAt = await getLastReadAt(userId, roomKey);

  return prisma.chatMessage.count({
    where: {
      roomSlug,
      teamId,
      userId: { not: userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });
}

export async function getUnreadCountForRoomParam(userId: string, roomParam: string) {
  const parsed = parseChatRoomParam(roomParam);
  if (!parsed) return 0;
  return countUnreadForRoomKey(
    userId,
    parsed.roomKey,
    parsed.dbSlug as ChatRoomSlug,
    parsed.teamId,
  );
}

export async function getTotalChatUnreadCount(userId: string): Promise<number> {
  if (await shouldUseMemoryDb()) return 0;

  let total = 0;

  for (const room of CHAT_ROOMS) {
    if (room.slug === "teams") continue;
    const roomKey = room.slug;
    total += await countUnreadForRoomKey(
      userId,
      roomKey,
      chatRoomSlugToDb(room.slug as ChatRoomSlugKey) as ChatRoomSlug,
      null,
    );
  }

  total += await countUnreadForRoomKey(userId, "teams-all", ChatRoomSlug.TEAMS_ALL, null);

  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: { isSuspended: false, status: { in: ["ACTIVE", "FORMING"] } },
    },
    select: { teamId: true },
  });

  for (const { teamId } of memberships) {
    const roomKey = `team-${teamId}`;
    total += await countUnreadForRoomKey(userId, roomKey, ChatRoomSlug.TEAMS, teamId);
  }

  return total;
}

export async function getUnreadCountsByRoomKey(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  if (await shouldUseMemoryDb()) return counts;

  for (const room of CHAT_ROOMS) {
    if (room.slug === "teams") continue;
    counts[room.slug] = await countUnreadForRoomKey(
      userId,
      room.slug,
      chatRoomSlugToDb(room.slug as ChatRoomSlugKey) as ChatRoomSlug,
      null,
    );
  }

  counts["teams-all"] = await countUnreadForRoomKey(
    userId,
    "teams-all",
    ChatRoomSlug.TEAMS_ALL,
    null,
  );

  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: { isSuspended: false, status: { in: ["ACTIVE", "FORMING"] } },
    },
    select: { teamId: true },
  });

  for (const { teamId } of memberships) {
    counts[`team-${teamId}`] = await countUnreadForRoomKey(
      userId,
      `team-${teamId}`,
      ChatRoomSlug.TEAMS,
      teamId,
    );
  }

  return counts;
}
