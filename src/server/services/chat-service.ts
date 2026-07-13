import { ChatMessageType, ChatRoomSlug, TeamCompetitionStage, TeamStatus } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  CHAT_DISPLAY_NAME_REQUIRED_ERROR,
  CHAT_MAX_TEXT_LENGTH,
  CHAT_MESSAGES_PAGE_SIZE,
  CHAT_ROOMS,
  CHAT_TEAMS_ACCESS_DENIED_FA,
  type ChatRoomSlugKey,
  chatRoomSlugFromDb,
  parseChatRoomParam,
} from "@/shared/constants/chat";
import type {
  ChatActiveCompetitionCard,
  ChatMessageDto,
  ChatReplyPreviewDto,
  ChatRoomContextDto,
  ChatRoomDetailDto,
  ChatRoomListItemDto,
  ChatSenderDto,
  ChatTeamRoomListItemDto,
} from "@/shared/types/chat";
import { getKandakatorForDate } from "@/server/services/kandakator-service";
import { resolveCredibilityTier } from "@/shared/lib/chat-logic";
import { loadReactionsForMessagesForUser } from "@/server/services/chat-social-service";
import { listMemorySystemMessages } from "@/server/services/chat-system-events";
import { getEligibleGlobalRanksForUsers } from "@/server/services/leaderboard-service";
import { getUnreadCountsByRoomKey } from "@/server/services/chat-unread-service";
import { formatChatMentionPlainText } from "@/shared/lib/chat-mentions";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";

type MemoryChatRow = {
  id: string;
  roomSlug: ChatRoomSlug;
  teamId: string | null;
  userId: string | null;
  type: ChatMessageType;
  body: string;
  payload: Record<string, unknown> | null;
  replyToId: string | null;
  createdAt: Date;
};

const memoryMessages: MemoryChatRow[] = [];
let memoryId = 0;

export function listMemoryTextMessages() {
  return memoryMessages;
}

function nextMemoryId() {
  memoryId += 1;
  return `chat-mem-${memoryId}`;
}

async function userHasTeamMembership(userId: string) {
  if (await shouldUseMemoryDb()) return false;

  const count = await prisma.teamMember.count({
    where: {
      userId,
      team: {
        isSuspended: false,
        status: { in: [TeamStatus.ACTIVE, TeamStatus.FORMING] },
      },
    },
  });
  return count > 0;
}

async function userIsTeamMember(userId: string, teamId: string) {
  if (await shouldUseMemoryDb()) return false;
  const count = await prisma.teamMember.count({
    where: {
      userId,
      teamId,
      team: {
        isSuspended: false,
        status: { in: [TeamStatus.ACTIVE, TeamStatus.FORMING] },
      },
    },
  });
  return count > 0;
}

export async function getChatRoomAccessForParam(userId: string, slugParam: string) {
  const parsed = parseChatRoomParam(slugParam);
  if (!parsed) {
    return { canAccess: false, canPost: false, lockedReasonFa: "اتاق چت نامعتبر است" };
  }

  if (parsed.dbSlug === "TEAMS_ALL") {
    const hasTeam = await userHasTeamMembership(userId);
    return {
      canAccess: hasTeam,
      canPost: hasTeam,
      lockedReasonFa: hasTeam ? null : CHAT_TEAMS_ACCESS_DENIED_FA,
    };
  }

  if (parsed.dbSlug === "TEAMS" && parsed.teamId) {
    const isMember = await userIsTeamMember(userId, parsed.teamId);
    return {
      canAccess: isMember,
      canPost: isMember,
      lockedReasonFa: isMember ? null : "فقط اعضای این تیم به چت اختصاصی دسترسی دارند.",
    };
  }

  if (parsed.dbSlug === "TEAMS" && !parsed.teamId) {
    const hasTeam = await userHasTeamMembership(userId);
    return {
      canAccess: hasTeam,
      canPost: hasTeam,
      lockedReasonFa: hasTeam ? null : CHAT_TEAMS_ACCESS_DENIED_FA,
    };
  }

  return { canAccess: true, canPost: true, lockedReasonFa: null };
}

export async function listChatRooms(userId: string): Promise<ChatRoomListItemDto[]> {
  const teamAccess = await getChatRoomAccessForParam(userId, "teams");
  const unread = await getUnreadCountsByRoomKey(userId);
  const teamUnreadTotal = Object.entries(unread)
    .filter(([key]) => key === "teams-all" || key.startsWith("team-"))
    .reduce((sum, [, count]) => sum + count, 0);

  return CHAT_ROOMS.map((room) => {
    const access =
      room.slug === "teams"
        ? teamAccess
        : { canAccess: true, canPost: true, lockedReasonFa: null };

    const unreadCount = room.slug === "teams" ? teamUnreadTotal : unread[room.slug] ?? 0;

    return {
      slug: room.slug,
      titleFa: room.titleFa,
      descriptionFa: room.descriptionFa,
      icon: room.icon,
      canAccess: access.canAccess,
      canPost: access.canPost,
      lockedReasonFa: access.lockedReasonFa,
      unreadCount,
      href: room.slug === "teams" ? "/chat/teams" : `/chat/${room.slug}`,
    };
  });
}

export async function listTeamChatRooms(userId: string): Promise<ChatTeamRoomListItemDto[]> {
  const hasTeam = await userHasTeamMembership(userId);
  if (!hasTeam) return [];

  const unread = await getUnreadCountsByRoomKey(userId);
  const rooms: ChatTeamRoomListItemDto[] = [
    {
      slug: "teams-all",
      titleFa: "تمام تیم‌ها",
      descriptionFa: "گفتگوی مشترک اعضای تمام تیم‌های بُردین",
      unreadCount: unread["teams-all"] ?? 0,
      href: "/chat/teams/all",
    },
  ];

  if (await shouldUseMemoryDb()) return rooms;

  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: { isSuspended: false, status: { in: [TeamStatus.ACTIVE, TeamStatus.FORMING] } },
    },
    include: {
      team: { select: { id: true, name: true, logoUrl: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  for (const membership of memberships) {
    rooms.push({
      slug: `team-${membership.teamId}`,
      teamId: membership.teamId,
      titleFa: `چت اختصاصی ${membership.team.name}`,
      descriptionFa: membership.team.name,
      logoUrl: membership.team.logoUrl,
      unreadCount: unread[`team-${membership.teamId}`] ?? 0,
      href: `/chat/teams/${membership.teamId}`,
    });
  }

  return rooms;
}

async function assertCanSendChatMessage(userId: string) {
  if (await shouldUseMemoryDb()) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true } } },
  });
  if (!user || userNeedsDisplayName(user.phone, user.profile?.displayName)) {
    const err = new Error(CHAT_DISPLAY_NAME_REQUIRED_ERROR);
    throw err;
  }
}

function serializeMemorySender(userId: string): ChatSenderDto {
  return {
    userId,
    displayName: "کاربر بُردین",
    avatarUrl: null,
    showcaseSlug: null,
    levelNameFa: null,
    globalRank: null,
    credibilityTier: null,
  };
}

function truncateReplyBody(body: string, max = 120) {
  const plain = formatChatMentionPlainText(body);
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

type ReplySourceRow = {
  id: string;
  type: ChatMessageType;
  body: string;
  createdAt: Date;
  userId: string | null;
};

type SenderSnapshot = {
  displayName: string;
  avatarUrl: string | null;
  showcaseSlug: string | null;
  levelNameFa: string | null;
  levelRank: number | null;
  medalCount: number;
};

function buildSenderDto(userId: string, snapshot: SenderSnapshot | null, globalRank: number | null): ChatSenderDto {
  const levelRank = snapshot?.levelRank ?? null;
  const medalCount = snapshot?.medalCount ?? 0;
  return {
    userId,
    displayName: snapshot?.displayName?.trim() || "کاربر بُردین",
    avatarUrl: snapshot?.avatarUrl ?? null,
    showcaseSlug: snapshot?.showcaseSlug ?? null,
    levelNameFa: snapshot?.levelNameFa ?? null,
    globalRank,
    credibilityTier: resolveCredibilityTier({ globalRank, levelRank, medalCount }),
  };
}

async function loadSenderMap(userIds: string[]) {
  const map = new Map<string, ChatSenderDto>();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueUserIds.length) return map;

  if (await shouldUseMemoryDb()) {
    for (const userId of uniqueUserIds) {
      map.set(userId, serializeMemorySender(userId));
    }
    return map;
  }

  const [users, rankMap] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: uniqueUserIds } },
      select: {
        id: true,
        _count: { select: { userMedals: true } },
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            showcaseSlug: true,
            currentLevel: { select: { nameFa: true, rank: true } },
          },
        },
      },
    }),
    getEligibleGlobalRanksForUsers(uniqueUserIds),
  ]);

  const snapshotMap = new Map<string, SenderSnapshot>();
  for (const user of users) {
    snapshotMap.set(user.id, {
      displayName: user.profile?.displayName?.trim() || "کاربر بُردین",
      avatarUrl: user.profile?.avatarUrl ?? null,
      showcaseSlug: user.profile?.showcaseSlug ?? null,
      levelNameFa: user.profile?.currentLevel?.nameFa ?? null,
      levelRank: user.profile?.currentLevel?.rank ?? null,
      medalCount: user._count.userMedals ?? 0,
    });
  }

  for (const userId of uniqueUserIds) {
    map.set(userId, buildSenderDto(userId, snapshotMap.get(userId) ?? null, rankMap.get(userId) ?? null));
  }

  return map;
}

function buildReplyPreview(
  row: ReplySourceRow,
  senderMap: Map<string, ChatSenderDto>,
): ChatReplyPreviewDto {
  const sender = row.userId ? (senderMap.get(row.userId) ?? null) : null;

  return {
    id: row.id,
    type: row.type as ChatReplyPreviewDto["type"],
    body: truncateReplyBody(row.body),
    senderDisplayName: sender?.displayName ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadReplyPreviews(ids: string[]) {
  const map = new Map<string, ChatReplyPreviewDto>();
  if (!ids.length) return map;

  if (await shouldUseMemoryDb()) {
    const systemRows = listMemorySystemMessages().map((m) => ({
      id: m.id,
      type: m.type,
      body: m.body,
      createdAt: m.createdAt,
      userId: null as string | null,
    }));
    const all: ReplySourceRow[] = [...memoryMessages, ...systemRows];
    const senderMap = await loadSenderMap(all.map((row) => row.userId ?? "").filter(Boolean));
    for (const id of ids) {
      const row = all.find((r) => r.id === id);
      if (row) map.set(id, buildReplyPreview(row, senderMap));
    }
    return map;
  }

  const rows = await prisma.chatMessage.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      type: true,
      body: true,
      createdAt: true,
      userId: true,
    },
  });

  const senderMap = await loadSenderMap(rows.map((row) => row.userId ?? "").filter(Boolean));
  for (const row of rows) {
    map.set(row.id, buildReplyPreview(row, senderMap));
  }

  return map;
}

function dbSlugToMessageSlug(dbSlug: ChatRoomSlug): ChatMessageDto["roomSlug"] {
  const slug = chatRoomSlugFromDb(dbSlug);
  if (slug === "teams-all") return "teams";
  return (slug ?? "public") as ChatRoomSlugKey;
}

async function rowToDto(
  row: {
    id: string;
    roomSlug: ChatRoomSlug;
    userId: string | null;
    type: ChatMessageType;
    body: string;
    payload: unknown;
    replyToId?: string | null;
    createdAt: Date;
  },
  viewerId: string,
  extras?: {
    reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
    replyTo?: ChatReplyPreviewDto | null;
    sender?: ChatSenderDto | null;
  },
): Promise<ChatMessageDto> {
  const sender =
    extras?.sender ??
    (row.userId
      ? (await shouldUseMemoryDb())
        ? serializeMemorySender(row.userId)
        : ((await loadSenderMap([row.userId])).get(row.userId) ?? null)
      : null);

  return {
    id: row.id,
    roomSlug: dbSlugToMessageSlug(row.roomSlug),
    type: row.type as ChatMessageDto["type"],
    body: row.body,
    payload:
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
    isMine: row.userId === viewerId,
    sender,
    reactions: extras?.reactions ?? [],
    replyTo: extras?.replyTo ?? null,
  };
}

async function listMessagesForRoom(
  roomSlug: ChatRoomSlug,
  teamId: string | null,
  beforeId?: string,
) {
  if (await shouldUseMemoryDb()) {
    const systemRows = listMemorySystemMessages()
      .filter((m) => m.roomSlug === roomSlug)
      .map((m) => ({
        id: m.id,
        roomSlug: m.roomSlug,
        userId: null as string | null,
        type: m.type,
        body: m.body,
        payload: null as Record<string, unknown> | null,
        replyToId: null as string | null,
        createdAt: m.createdAt,
      }));

    let rows = [...memoryMessages, ...systemRows]
      .filter((m) => m.roomSlug === roomSlug)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (beforeId) {
      const idx = rows.findIndex((r) => r.id === beforeId);
      if (idx >= 0) rows = rows.slice(idx + 1);
    }

    return rows.slice(0, CHAT_MESSAGES_PAGE_SIZE);
  }

  const cursor = beforeId
    ? await prisma.chatMessage.findUnique({ where: { id: beforeId }, select: { createdAt: true } })
    : null;

  return prisma.chatMessage.findMany({
    where: {
      roomSlug,
      teamId,
      ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: CHAT_MESSAGES_PAGE_SIZE,
  });
}

function isUpcomingUnsettledMatch(match: {
  kickoffAt: string | Date;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}) {
  const kickoff = new Date(match.kickoffAt);
  const now = new Date();
  const hasResult =
    match.homeScore != null &&
    match.awayScore != null &&
    (match.status === "FINISHED" || match.status === "finished" || now >= kickoff);
  return !hasResult && kickoff > now;
}

const TEAM_COMPETITION_STAGE_LABEL_FA: Record<TeamCompetitionStage, string> = {
  REGISTRATION: "ثبت‌نام",
  RANKING: "رده‌بندی",
  KNOCKOUT: "حذفی",
  FINISHED: "پایان‌یافته",
};

async function getActiveCompetitionsForChat(): Promise<ChatActiveCompetitionCard[]> {
  if (await shouldUseMemoryDb()) return [];

  const now = new Date();
  const cards: ChatActiveCompetitionCard[] = [];

  const [cups, tournaments, teamComps] = await Promise.all([
    prisma.cup.findMany({
      where: { isPublished: true, startsAt: { lte: now }, endsAt: { gt: now } },
      include: { match: true },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    prisma.tournament.findMany({
      where: { isPublished: true, startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: "asc" },
      take: 4,
    }),
    prisma.teamCompetition.findMany({
      where: {
        isPublished: true,
        stage: { not: TeamCompetitionStage.FINISHED },
      },
      orderBy: { registrationDeadline: "asc" },
      take: 6,
    }),
  ]);

  for (const cup of cups) {
    const matchLabel =
      cup.match?.homeTeamName && cup.match?.awayTeamName
        ? `${cup.match.homeTeamName} vs ${cup.match.awayTeamName}`
        : null;
    cards.push({
      id: cup.id,
      kind: "cup",
      titleFa: cup.titleFa,
      subtitleFa: matchLabel,
      href: `/competitions/cups/${cup.id}`,
      entryFeeCoins: cup.entryFeeCoins,
    });
  }

  for (const tournament of tournaments) {
    cards.push({
      id: tournament.id,
      kind: "tournament",
      titleFa: tournament.nameFa,
      subtitleFa: tournament.description,
      href: `/competitions/tournaments/${tournament.id}`,
      entryFeeCoins: tournament.registrationFeeCoins,
    });
  }

  for (const comp of teamComps) {
    cards.push({
      id: comp.id,
      kind: "team",
      titleFa: comp.titleFa,
      subtitleFa: TEAM_COMPETITION_STAGE_LABEL_FA[comp.stage] ?? comp.stage,
      href: `/competitions/teams/${comp.id}?from=chat`,
      entryFeeCoins: comp.winnerCoinReward,
    });
  }

  return cards;
}

async function getRoomContext(userId: string, slugParam: string): Promise<ChatRoomContextDto> {
  const context: ChatRoomContextDto = {
    todayKandakator: null,
    activeCompetitions: [],
  };

  if (slugParam === "today-predictions") {
    const kandakator = await getKandakatorForDate(userId);
    if (kandakator?.matches.length) {
      const eligible = kandakator.matches.filter((km) => isUpcomingUnsettledMatch(km.match));
      context.todayKandakator = {
        matches: eligible.map((km) => ({
          id: km.id,
          matchId: km.matchId,
          match: {
            homeTeamName: km.match.homeTeamName,
            awayTeamName: km.match.awayTeamName,
            leagueName: km.match.leagueName,
            kickoffAt: km.match.kickoffAt,
            homeScore: km.match.homeScore,
            awayScore: km.match.awayScore,
            status: km.match.status,
          },
          prediction: km.prediction
            ? {
                homePrediction: km.prediction.homePrediction,
                awayPrediction: km.prediction.awayPrediction,
              }
            : null,
        })),
      };
    }
  }

  if (slugParam === "competitions") {
    context.activeCompetitions = await getActiveCompetitionsForChat();
  }

  return context;
}

export async function getChatRoomDetail(
  userId: string,
  slugParam: string,
  options?: { beforeId?: string },
): Promise<ChatRoomDetailDto | null> {
  const parsed = parseChatRoomParam(slugParam);
  if (!parsed) return null;

  const access = await getChatRoomAccessForParam(userId, slugParam);
  const dbSlug = parsed.dbSlug as ChatRoomSlug;

  let titleFa = parsed.titleFa ?? "چت";
  let descriptionFa = "";
  let icon: ChatRoomListItemDto["icon"] = "public";

  if (parsed.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: parsed.teamId },
      select: { name: true },
    });
    titleFa = team ? `چت اختصاصی ${team.name}` : titleFa;
    descriptionFa = "گفتگوی اعضای تیم";
    icon = "teams";
  } else if (slugParam === "teams-all") {
    descriptionFa = "گفتگوی مشترک اعضای تمام تیم‌های بُردین";
    icon = "teams";
  } else {
    const roomDef = CHAT_ROOMS.find((r) => r.slug === slugParam);
    if (roomDef) {
      titleFa = roomDef.titleFa;
      descriptionFa = roomDef.descriptionFa;
      icon = roomDef.icon;
    }
  }

  const rows = access.canAccess
    ? await listMessagesForRoom(dbSlug, parsed.teamId, options?.beforeId)
    : [];

  const messageIds = rows.map((r) => r.id);
  const replyToIds = [
    ...new Set(
      rows
        .map((r) => ("replyToId" in r ? r.replyToId : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const [reactionsMap, replyPreviewMap] = access.canAccess
    ? await Promise.all([
        loadReactionsForMessagesForUser(messageIds, userId),
        loadReplyPreviews(replyToIds),
      ])
    : [new Map(), new Map()];
  const senderMap = access.canAccess
    ? await loadSenderMap(rows.map((row) => row.userId ?? "").filter(Boolean))
    : new Map<string, ChatSenderDto>();

  const messages = await Promise.all(
    [...rows].reverse().map((row) =>
      rowToDto(row, userId, {
        reactions: reactionsMap.get(row.id) ?? [],
        sender: row.userId ? (senderMap.get(row.userId) ?? null) : null,
        replyTo:
          "replyToId" in row && row.replyToId
            ? (replyPreviewMap.get(row.replyToId) ?? null)
            : null,
      }),
    ),
  );

  const room: ChatRoomListItemDto = {
    slug: slugParam as ChatRoomListItemDto["slug"],
    titleFa,
    descriptionFa,
    icon,
    href: parsed.href,
    ...access,
  };

  const context =
    access.canAccess && (slugParam === "today-predictions" || slugParam === "competitions")
      ? await getRoomContext(userId, slugParam)
      : { todayKandakator: null, activeCompetitions: [] };

  return { room, messages, context };
}

export async function sendChatTextMessage(
  userId: string,
  slugParam: string,
  body: string,
  replyToId?: string | null,
) {
  const parsed = parseChatRoomParam(slugParam);
  if (!parsed) {
    throw new Error("اتاق چت نامعتبر است");
  }

  await assertCanSendChatMessage(userId);

  const access = await getChatRoomAccessForParam(userId, slugParam);
  if (!access.canAccess || !access.canPost) {
    throw new Error(access.lockedReasonFa ?? "دسترسی به این اتاق مجاز نیست");
  }

  const trimmed = body.trim();
  if (!trimmed) throw new Error("پیام نمی‌تواند خالی باشد");
  if (trimmed.length > CHAT_MAX_TEXT_LENGTH) {
    throw new Error(`پیام حداکثر ${CHAT_MAX_TEXT_LENGTH} کاراکتر می‌تواند باشد`);
  }

  const dbSlug = parsed.dbSlug as ChatRoomSlug;
  const teamId = parsed.teamId;

  if (replyToId) {
    if (await shouldUseMemoryDb()) {
      const systemRows = listMemorySystemMessages();
      const parent =
        memoryMessages.find(
          (m) => m.id === replyToId && m.roomSlug === dbSlug && m.teamId === teamId,
        ) ??
        systemRows.find((m) => m.id === replyToId && m.roomSlug === dbSlug);
      if (!parent) throw new Error("پیام مرجع برای پاسخ یافت نشد");
    } else {
      const parent = await prisma.chatMessage.findUnique({
        where: { id: replyToId },
        select: { roomSlug: true, teamId: true },
      });
      if (!parent || parent.roomSlug !== dbSlug || parent.teamId !== teamId) {
        throw new Error("پیام مرجع برای پاسخ یافت نشد");
      }
    }
  }

  if (await shouldUseMemoryDb()) {
    const row: MemoryChatRow = {
      id: nextMemoryId(),
      roomSlug: dbSlug,
      teamId,
      userId,
      type: ChatMessageType.TEXT,
      body: trimmed,
      payload: null,
      replyToId: replyToId ?? null,
      createdAt: new Date(),
    };
    memoryMessages.push(row);
    const replyPreview = replyToId
      ? ((await loadReplyPreviews([replyToId])).get(replyToId) ?? null)
      : null;
    return rowToDto(row, userId, { replyTo: replyPreview });
  }

  const created = await prisma.chatMessage.create({
    data: {
      roomSlug: dbSlug,
      teamId: teamId ?? undefined,
      userId,
      type: ChatMessageType.TEXT,
      body: trimmed,
      replyToId: replyToId ?? undefined,
    },
  });

  const senderProfile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { displayName: true },
  });

  const { notifyChatMentionRecipients } = await import("@/server/services/chat-social-service");
  await notifyChatMentionRecipients({
    senderUserId: userId,
    senderDisplayName: senderProfile?.displayName?.trim() || "کاربر بُردین",
    roomParam: slugParam,
    messageId: created.id,
    body: trimmed,
  });

  const replyPreview = replyToId
    ? ((await loadReplyPreviews([replyToId])).get(replyToId) ?? null)
    : null;

  return rowToDto(created, userId, { replyTo: replyPreview });
}

/** @deprecated use getChatRoomAccessForParam */
export async function getChatRoomAccess(userId: string, slug: ChatRoomSlugKey) {
  return getChatRoomAccessForParam(userId, slug);
}
