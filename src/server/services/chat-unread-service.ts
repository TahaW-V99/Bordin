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

async function loadReadMap(userId: string) {
  if (await shouldUseMemoryDb()) return new Map<string, Date>();

  const rows = await prisma.chatRoomRead.findMany({
    where: { userId },
    select: { roomKey: true, lastReadAt: true },
  });
  return new Map(rows.map((row) => [row.roomKey, row.lastReadAt]));
}

async function loadActiveTeamIds(userId: string) {
  if (await shouldUseMemoryDb()) return [] as string[];

  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: { isSuspended: false, status: { in: ["ACTIVE", "FORMING"] } },
    },
    select: { teamId: true },
  });

  return memberships.map((membership) => membership.teamId);
}

async function countUnreadForRoomKey(
  userId: string,
  roomKey: string,
  roomSlug: ChatRoomSlug,
  teamId: string | null,
  lastReadAt?: Date | null,
): Promise<number> {
  if (await shouldUseMemoryDb()) return 0;

  const resolvedLastReadAt =
    lastReadAt === undefined ? await getLastReadAt(userId, roomKey) : lastReadAt;

  return prisma.chatMessage.count({
    where: {
      roomSlug,
      teamId,
      userId: { not: userId },
      ...(resolvedLastReadAt ? { createdAt: { gt: resolvedLastReadAt } } : {}),
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

  const [readMap, teamIds] = await Promise.all([
    loadReadMap(userId),
    loadActiveTeamIds(userId),
  ]);

  const countPromises: Promise<number>[] = [];

  for (const room of CHAT_ROOMS) {
    if (room.slug === "teams") continue;
    countPromises.push(
      countUnreadForRoomKey(
        userId,
        room.slug,
        chatRoomSlugToDb(room.slug as ChatRoomSlugKey) as ChatRoomSlug,
        null,
        readMap.get(room.slug) ?? null,
      ),
    );
  }

  countPromises.push(
    countUnreadForRoomKey(
      userId,
      "teams-all",
      ChatRoomSlug.TEAMS_ALL,
      null,
      readMap.get("teams-all") ?? null,
    ),
  );

  for (const teamId of teamIds) {
    const roomKey = `team-${teamId}`;
    countPromises.push(
      countUnreadForRoomKey(
        userId,
        roomKey,
        ChatRoomSlug.TEAMS,
        teamId,
        readMap.get(roomKey) ?? null,
      ),
    );
  }

  const counts = await Promise.all(countPromises);
  return counts.reduce((sum, count) => sum + count, 0);
}

export async function getUnreadCountsByRoomKey(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  if (await shouldUseMemoryDb()) return counts;

  const [readMap, teamIds] = await Promise.all([
    loadReadMap(userId),
    loadActiveTeamIds(userId),
  ]);

  const entries = [
    ...CHAT_ROOMS.filter((room) => room.slug !== "teams").map((room) => ({
      roomKey: room.slug,
      roomSlug: chatRoomSlugToDb(room.slug as ChatRoomSlugKey) as ChatRoomSlug,
      teamId: null as string | null,
    })),
    {
      roomKey: "teams-all",
      roomSlug: ChatRoomSlug.TEAMS_ALL,
      teamId: null as string | null,
    },
    ...teamIds.map((teamId) => ({
      roomKey: `team-${teamId}`,
      roomSlug: ChatRoomSlug.TEAMS,
      teamId,
    })),
  ];

  const results = await Promise.all(
    entries.map(async (entry) => ({
      roomKey: entry.roomKey,
      count: await countUnreadForRoomKey(
        userId,
        entry.roomKey,
        entry.roomSlug,
        entry.teamId,
        readMap.get(entry.roomKey) ?? null,
      ),
    })),
  );

  for (const result of results) {
    counts[result.roomKey] = result.count;
  }

  return counts;
}
