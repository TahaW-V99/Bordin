import { ChatMessageType, ChatRoomSlug, NotificationCategory, NotificationType } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  chatRoomSlugToDb,
  isTeamMentionChatParam,
  isTeamSpecificChatParam,
  isUserMentionChatParam,
  parseChatRoomParam,
  type ChatRoomSlugKey,
} from "@/shared/constants/chat";
import { isAllowedChatReaction } from "@/shared/lib/chat-logic";
import { parseChatMentions } from "@/shared/lib/chat-mentions";
import type { DuelChallengePayload, PredictionResultSharePayload } from "@/shared/lib/chat-payloads";
import { isPredictionScored } from "@/shared/types/prediction-results";
import { getGlobalLeaderboard } from "@/server/services/leaderboard-service";
import { createNotification } from "@/server/services/notification-service";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { isLegacyInvitePlaceholderUser } from "@/shared/lib/legacy-invite-placeholder";
import type { ChatDuelOpponentDto } from "@/shared/types/chat";

type MemoryReaction = { id: string; messageId: string; userId: string; emoji: string };
type MemoryReport = { id: string; messageId: string; reporterId: string };

const memoryReactions: MemoryReaction[] = [];
const memoryReports: MemoryReport[] = [];

async function getRoomAccess(userId: string, slugParam: ChatRoomSlugKey) {
  const { getChatRoomAccess } = await import("@/server/services/chat-service");
  return getChatRoomAccess(userId, slugParam);
}

export async function reportChatMessage(userId: string, messageId: string, reason?: string) {
  if (await shouldUseMemoryDb()) {
    const { listMemorySystemMessages } = await import("@/server/services/chat-system-events");
    if (listMemorySystemMessages().some((m) => m.id === messageId)) {
      throw new Error("گزارش پیام‌های سیستمی مجاز نیست");
    }
    const exists = memoryReports.some(
      (r) => r.messageId === messageId && r.reporterId === userId,
    );
    if (exists) throw new Error("این پیام را قبلاً گزارش کرده‌اید");
    memoryReports.push({ id: `rep-${memoryReports.length + 1}`, messageId, reporterId: userId });
    return { reported: true };
  }

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw new Error("پیام یافت نشد");
  if (message.type === ChatMessageType.SYSTEM) {
    throw new Error("گزارش پیام‌های سیستمی مجاز نیست");
  }

  try {
    await prisma.chatMessageReport.create({
      data: { messageId, reporterId: userId, reason: reason?.trim() || null },
    });
  } catch {
    throw new Error("این پیام را قبلاً گزارش کرده‌اید");
  }

  return { reported: true };
}

export async function setChatReaction(userId: string, messageId: string, emoji: string) {
  if (!isAllowedChatReaction(emoji)) {
    throw new Error("این واکنش در چت بُردین مجاز نیست");
  }

  if (await shouldUseMemoryDb()) {
    const idx = memoryReactions.findIndex(
      (r) => r.messageId === messageId && r.userId === userId,
    );
    if (idx >= 0) {
      if (memoryReactions[idx].emoji === emoji) {
        memoryReactions.splice(idx, 1);
        const reactions = (await loadReactionsForMessagesForUser([messageId], userId)).get(messageId) ?? [];
        return { removed: true, reactions };
      }
      memoryReactions[idx].emoji = emoji;
      const reactions = (await loadReactionsForMessagesForUser([messageId], userId)).get(messageId) ?? [];
      return { updated: true, reactions };
    }
    memoryReactions.push({
      id: `react-${memoryReactions.length + 1}`,
      messageId,
      userId,
      emoji,
    });
    const reactions = (await loadReactionsForMessagesForUser([messageId], userId)).get(messageId) ?? [];
    return { added: true, reactions };
  }

  const message = await prisma.chatMessage.findUnique({ where: { id: messageId } });
  if (!message) throw new Error("پیام یافت نشد");

  const existing = await prisma.chatReaction.findUnique({
    where: { messageId_userId: { messageId, userId } },
  });

  if (existing?.emoji === emoji) {
    await prisma.chatReaction.delete({ where: { id: existing.id } });
    const reactions = (await loadReactionsForMessagesForUser([messageId], userId)).get(messageId) ?? [];
    return { removed: true, reactions };
  }

  await prisma.chatReaction.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId, emoji },
    update: { emoji },
  });

  const reactions = (await loadReactionsForMessagesForUser([messageId], userId)).get(messageId) ?? [];
  return existing ? { updated: true, reactions } : { added: true, reactions };
}

export async function loadReactionsForMessages(messageIds: string[]) {
  if (!messageIds.length) return new Map<string, Array<{ emoji: string; count: number; reactedByMe: boolean }>>();

  if (await shouldUseMemoryDb()) {
    const map = new Map<string, Map<string, number>>();
    for (const r of memoryReactions) {
      if (!messageIds.includes(r.messageId)) continue;
      const bucket = map.get(r.messageId) ?? new Map<string, number>();
      bucket.set(r.emoji, (bucket.get(r.emoji) ?? 0) + 1);
      map.set(r.messageId, bucket);
    }
    const result = new Map<string, Array<{ emoji: string; count: number; reactedByMe: boolean }>>();
    for (const id of messageIds) {
      const bucket = map.get(id);
      if (!bucket) continue;
      result.set(
        id,
        [...bucket.entries()].map(([emoji, count]) => ({
          emoji,
          count,
          reactedByMe: false,
        })),
      );
    }
    return result;
  }

  return new Map();
}

export async function loadReactionsForMessagesForUser(messageIds: string[], viewerId: string) {
  if (!messageIds.length) {
    return new Map<string, Array<{ emoji: string; count: number; reactedByMe: boolean }>>();
  }

  if (await shouldUseMemoryDb()) {
    const map = new Map<string, Map<string, { count: number; mine: boolean }>>();
    for (const r of memoryReactions) {
      if (!messageIds.includes(r.messageId)) continue;
      const bucket = map.get(r.messageId) ?? new Map();
      const prev = bucket.get(r.emoji) ?? { count: 0, mine: false };
      bucket.set(r.emoji, {
        count: prev.count + 1,
        mine: prev.mine || r.userId === viewerId,
      });
      map.set(r.messageId, bucket);
    }
    const result = new Map<string, Array<{ emoji: string; count: number; reactedByMe: boolean }>>();
    for (const [messageId, bucket] of map) {
      result.set(
        messageId,
        [...bucket.entries()].map(([emoji, v]) => ({
          emoji,
          count: v.count,
          reactedByMe: v.mine,
        })),
      );
    }
    return result;
  }

  const rows = await prisma.chatReaction.findMany({
    where: { messageId: { in: messageIds } },
    select: { messageId: true, emoji: true, userId: true },
  });

  const map = new Map<string, Map<string, { count: number; mine: boolean }>>();
  for (const row of rows) {
    const bucket = map.get(row.messageId) ?? new Map();
    const prev = bucket.get(row.emoji) ?? { count: 0, mine: false };
    bucket.set(row.emoji, {
      count: prev.count + 1,
      mine: prev.mine || row.userId === viewerId,
    });
    map.set(row.messageId, bucket);
  }

  const result = new Map<string, Array<{ emoji: string; count: number; reactedByMe: boolean }>>();
  for (const [messageId, bucket] of map) {
    result.set(
      messageId,
      [...bucket.entries()].map(([emoji, v]) => ({
        emoji,
        count: v.count,
        reactedByMe: v.mine,
      })),
    );
  }
  return result;
}

export async function sharePredictionResultToRoom(
  userId: string,
  predictionId: string,
  slugParam: string,
) {
  const parsed = parseChatRoomParam(slugParam);
  if (!parsed) throw new Error("اتاق چت نامعتبر است");

  const { getChatRoomAccessForParam } = await import("@/server/services/chat-service");
  const access = await getChatRoomAccessForParam(userId, slugParam);
  if (!access.canAccess || !access.canPost) {
    throw new Error(access.lockedReasonFa ?? "دسترسی به این اتاق مجاز نیست");
  }

  if (await shouldUseMemoryDb()) {
    throw new Error("اشتراک نتیجه در حالت توسعه محلی پشتیبانی نمی‌شود");
  }

  const prediction = await prisma.prediction.findFirst({
    where: { id: predictionId, userId },
    include: {
      match: true,
    },
  });
  if (!prediction?.match) throw new Error("پیش‌بینی یافت نشد");
  if (!isPredictionScored({ scoredAt: prediction.scoredAt?.toISOString() ?? null })) {
    throw new Error("فقط نتایج امتیازدهی‌شده قابل اشتراک‌گذاری هستند");
  }

  const payload: PredictionResultSharePayload = {
    predictionId: prediction.id,
    homeTeamName: prediction.match.homeTeamName,
    awayTeamName: prediction.match.awayTeamName,
    leagueName: prediction.match.leagueName,
    homePrediction: prediction.homePrediction,
    awayPrediction: prediction.awayPrediction,
    homeScore: prediction.match.homeScore ?? 0,
    awayScore: prediction.match.awayScore ?? 0,
    accuracyPercent: prediction.accuracyPercent ?? 0,
    coinsEarned: prediction.coinsEarned ?? 0,
    xpEarned: prediction.xpEarned ?? 0,
  };

  const body = `نتیجه پیش‌بینی: ${payload.homeTeamName} ${payload.homeScore} – ${payload.awayScore} ${payload.awayTeamName}`;

  const created = await prisma.chatMessage.create({
    data: {
      roomSlug: parsed.dbSlug,
      teamId: parsed.teamId ?? undefined,
      userId,
      type: ChatMessageType.PREDICTION_RESULT,
      body,
      payload,
    },
  });

  return created;
}

export async function createDuelChallenge(
  userId: string,
  input: { opponentId: string; matchIds: string[] },
) {
  const slug: ChatRoomSlugKey = "today-predictions";
  const access = await getRoomAccess(userId, slug);
  if (!access.canAccess || !access.canPost) {
    throw new Error(access.lockedReasonFa ?? "دوئل فقط در اتاق پیش‌بینی امروز ممکن است");
  }

  if (input.opponentId === userId) throw new Error("نمی‌توانید با خودتان دوئل کنید");
  if (!input.matchIds.length) throw new Error("حداقل یک بازی انتخاب کنید");

  if (await shouldUseMemoryDb()) {
    throw new Error("دوئل در حالت توسعه محلی پشتیبانی نمی‌شود");
  }

  const [challenger, opponent, matches] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { displayName: true },
    }),
    prisma.userProfile.findUnique({
      where: { userId: input.opponentId },
      select: { displayName: true },
    }),
    prisma.footballMatch.findMany({
      where: { id: { in: input.matchIds } },
      select: {
        id: true,
        homeTeamName: true,
        awayTeamName: true,
        kickoffAt: true,
      },
    }),
  ]);

  if (!opponent) throw new Error("حریف یافت نشد");
  if (matches.length !== input.matchIds.length) {
    throw new Error("برخی بازی‌های انتخاب‌شده معتبر نیستند");
  }

  const challengerName = challenger?.displayName?.trim() || "کاربر بُردین";
  const opponentName = opponent.displayName?.trim() || "کاربر بُردین";
  const duelId = randomUUID();

  const payload: DuelChallengePayload = {
    duelId,
    challengerId: userId,
    challengerName,
    opponentId: input.opponentId,
    opponentName,
    matches: matches.map((m) => ({
      matchId: m.id,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      kickoffAt: m.kickoffAt.toISOString(),
    })),
  };

  const matchLabel = payload.matches
    .map((m) => `${m.homeTeamName} – ${m.awayTeamName}`)
    .join("، ");
  const body = `⚔️ ${challengerName} به ${opponentName} دوئل پیش‌بینی داد: ${matchLabel}`;

  const created = await prisma.chatMessage.create({
    data: {
      roomSlug: ChatRoomSlug.TODAY_PREDICTIONS,
      userId,
      type: ChatMessageType.DUEL_CHALLENGE,
      body,
      payload,
    },
  });

  await createNotification({
    userId: input.opponentId,
    type: NotificationType.COMPETITION,
    category: NotificationCategory.MESSAGE,
    titleFa: `${challengerName} شما را به دوئل دعوت کرده!`,
    bodyFa: "برای پذیرش یا مشاهده دوئل به چت پیش‌بینی امروز بروید.",
    link: "/chat/today-predictions",
    secondaryLink: `/chat/today-predictions?duelId=${duelId}`,
    secondaryLinkLabelFa: "نشانم بده",
  });

  return created;
}

export async function listRecentChatParticipants(
  roomSlug: ChatRoomSlugKey,
  excludeUserId?: string,
  limit = 20,
) {
  if (!(await shouldUseMemoryDb())) {
    const dbSlug = chatRoomSlugToDb(roomSlug);
    const rows = await prisma.chatMessage.findMany({
      where: {
        roomSlug: dbSlug,
        userId: { not: null },
        type: ChatMessageType.TEXT,
      },
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            profile: { select: { displayName: true, showcaseSlug: true } },
          },
        },
      },
    });

    const seen = new Set<string>();
    const participants: Array<{
      userId: string;
      displayName: string;
      showcaseSlug: string | null;
    }> = [];

    for (const row of rows) {
      const user = row.user;
      if (!user || !row.userId || seen.has(row.userId)) continue;
      if (excludeUserId && row.userId === excludeUserId) continue;
      seen.add(row.userId);
      participants.push({
        userId: user.id,
        displayName: user.profile?.displayName?.trim() || "کاربر بُردین",
        showcaseSlug: user.profile?.showcaseSlug ?? null,
      });
      if (participants.length >= limit) break;
    }

    return participants;
  }

  return [];
}

export async function listMentionCandidates(
  userId: string,
  roomParam: string,
  search?: string,
  limit = 120,
) {
  if (await shouldUseMemoryDb()) return [];

  const parsed = parseChatRoomParam(roomParam);
  if (!parsed) throw new Error("اتاق چت نامعتبر است");

  const { getChatRoomAccessForParam } = await import("@/server/services/chat-service");
  const access = await getChatRoomAccessForParam(userId, roomParam);
  if (!access.canAccess) throw new Error(access.lockedReasonFa ?? "دسترسی به این اتاق مجاز نیست");

  if (isTeamSpecificChatParam(roomParam)) {
    return [];
  }

  const query = search?.trim();

  if (isTeamMentionChatParam(roomParam)) {
    const { resolveTeamLogoUrl } = await import("@/shared/constants/teams");
    const teams = await prisma.team.findMany({
      where: {
        ...(query ? { name: { contains: query } } : {}),
      },
      select: {
        id: true,
        name: true,
        logoUrl: true,
      },
      orderBy: { name: "asc" },
      take: limit,
    });

    return teams.map((team) => ({
      kind: "team" as const,
      teamId: team.id,
      displayName: team.name,
      logoUrl: resolveTeamLogoUrl(team),
    }));
  }

  if (isUserMentionChatParam(roomParam)) {
    const profiles = await prisma.userProfile.findMany({
      where: {
        userId: { not: userId },
        displayName: query ? { contains: query } : { not: "" },
      },
      include: {
        user: { select: { phone: true, username: true } },
      },
      orderBy: { displayName: "asc" },
      take: limit,
    });

    return profiles
      .filter(
        (profile) =>
          !isLegacyInvitePlaceholderUser({
            phone: profile.user.phone,
            username: profile.user.username,
            displayName: profile.displayName,
          }) && !userNeedsDisplayName(profile.user.phone, profile.displayName),
      )
      .map((profile) => ({
        kind: "user" as const,
        userId: profile.userId,
        displayName: profile.displayName?.trim() || "کاربر بُردین",
        showcaseSlug: profile.showcaseSlug ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        totalXp: profile.totalXp ?? 0,
        globalRank: profile.globalRank ?? null,
        isTeammate: false,
      }));
  }

  return [];
}

export async function notifyChatMentionRecipients(input: {
  senderUserId: string;
  senderDisplayName: string;
  roomParam: string;
  messageId: string;
  body: string;
}) {
  if (await shouldUseMemoryDb()) return;

  const parsed = parseChatRoomParam(input.roomParam);
  if (!parsed) return;

  const { users, teams } = parseChatMentions(input.body);
  const senderName = input.senderDisplayName.trim() || "کاربر بُردین";

  if (isUserMentionChatParam(input.roomParam) && users.length > 0) {
    const roomLink = `${parsed.href}?messageId=${input.messageId}`;
    for (const mention of users) {
      if (mention.userId === input.senderUserId) continue;
      await createNotification({
        userId: mention.userId,
        type: NotificationType.COMPETITION,
        category: NotificationCategory.MESSAGE,
        titleFa: `${senderName} در چت روم شما رو منشن کرده! دیدی؟!`,
        link: roomLink,
        secondaryLink: roomLink,
        secondaryLinkLabelFa: "نشانم بده",
      });
    }
    return;
  }

  if (isTeamMentionChatParam(input.roomParam) && teams.length > 0) {
    const roomLink = `/chat/teams/all?messageId=${input.messageId}`;
    const teamIds = teams.map((team) => team.teamId);
    const members = await prisma.teamMember.findMany({
      where: { teamId: { in: teamIds } },
      select: { userId: true },
    });
    const notified = new Set<string>();
    for (const member of members) {
      if (member.userId === input.senderUserId || notified.has(member.userId)) continue;
      notified.add(member.userId);
      await createNotification({
        userId: member.userId,
        type: NotificationType.COMPETITION,
        category: NotificationCategory.MESSAGE,
        titleFa: `${senderName} در چت روم تیم‌ها، تیم شما رو منشن کرده! دیدی؟!`,
        link: roomLink,
        secondaryLink: roomLink,
        secondaryLinkLabelFa: "نشانم بده",
      });
    }
  }
}

export async function editOwnChatTextMessage(userId: string, messageId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("پیام نمی‌تواند خالی باشد");

  const { CHAT_MAX_TEXT_LENGTH } = await import("@/shared/constants/chat");
  if (trimmed.length > CHAT_MAX_TEXT_LENGTH) {
    throw new Error(`پیام حداکثر ${CHAT_MAX_TEXT_LENGTH} کاراکتر می‌تواند باشد`);
  }

  if (await shouldUseMemoryDb()) {
    const { listMemoryTextMessages } = await import("@/server/services/chat-service");
    const memoryMessages = listMemoryTextMessages();
    const message = memoryMessages.find((row) => row.id === messageId);
    if (!message || message.userId !== userId || message.type !== ChatMessageType.TEXT) {
      throw new Error("فقط پیام متنی خودتان قابل ویرایش است");
    }
    message.body = trimmed;
    return { ok: true };
  }

  const message = await prisma.chatMessage.findUnique({
    where: { id: messageId },
    select: { userId: true, type: true },
  });
  if (!message || message.userId !== userId || message.type !== ChatMessageType.TEXT) {
    throw new Error("فقط پیام متنی خودتان قابل ویرایش است");
  }

  await prisma.chatMessage.update({
    where: { id: messageId },
    data: { body: trimmed },
  });

  return { ok: true };
}

async function getTeammateUserIds(userId: string): Promise<Set<string>> {
  if (await shouldUseMemoryDb()) return new Set();

  const memberships = await prisma.teamMember.findMany({
    where: {
      userId,
      team: { isSuspended: false, status: { in: ["ACTIVE", "FORMING"] } },
    },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);
  if (!teamIds.length) return new Set();

  const teammates = await prisma.teamMember.findMany({
    where: { teamId: { in: teamIds }, userId: { not: userId } },
    select: { userId: true },
  });
  return new Set(teammates.map((t) => t.userId));
}

export async function listDuelOpponents(
  userId: string,
  search?: string,
): Promise<ChatDuelOpponentDto[]> {
  if (await shouldUseMemoryDb()) return [];

  const teammateIds = await getTeammateUserIds(userId);
  const query = search?.trim();

  if (query && query.length >= 2) {
    const profiles = await prisma.userProfile.findMany({
      where: {
        displayName: { contains: query },
        userId: { not: userId },
      },
      include: {
        user: { select: { phone: true } },
      },
      take: 40,
      orderBy: { totalXp: "desc" },
    });

    const eligible = profiles.filter(
      (p) =>
        !isLegacyInvitePlaceholderUser({
          phone: p.user.phone,
          displayName: p.displayName,
        }) && !userNeedsDisplayName(p.user.phone, p.displayName),
    );

    const leaderboard = await getGlobalLeaderboard();
    const rankMap = new Map(leaderboard.map((row) => [row.userId, row.rank]));

    return eligible.map((p) => ({
      userId: p.userId,
      displayName: p.displayName?.trim() || "کاربر بُردین",
      showcaseSlug: p.showcaseSlug,
      avatarUrl: p.avatarUrl,
      globalRank: rankMap.get(p.userId) ?? null,
      totalXp: p.totalXp,
      isTeammate: teammateIds.has(p.userId),
    }));
  }

  const leaderboard = await getGlobalLeaderboard();
  const topIds = leaderboard.map((row) => row.userId).filter((id) => id !== userId);

  const profiles = await prisma.userProfile.findMany({
    where: { userId: { in: topIds } },
    select: {
      userId: true,
      displayName: true,
      showcaseSlug: true,
      avatarUrl: true,
      totalXp: true,
    },
  });
  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  return leaderboard
    .filter((row) => row.userId !== userId)
    .map((row) => {
      const profile = profileMap.get(row.userId);
      return {
        userId: row.userId,
        displayName: profile?.displayName?.trim() || row.displayName,
        showcaseSlug: profile?.showcaseSlug ?? row.showcaseSlug,
        avatarUrl: profile?.avatarUrl ?? row.avatarUrl,
        globalRank: row.rank,
        totalXp: profile?.totalXp ?? row.totalXp,
        isTeammate: teammateIds.has(row.userId),
      };
    });
}

export async function listChatMessageReportsForAdmin() {
  if (await shouldUseMemoryDb()) return [];

  const rows = await prisma.chatMessageReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reporter: { include: { profile: { select: { displayName: true } } } },
      message: {
        include: {
          user: { include: { profile: { select: { displayName: true } } } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    reporterName: row.reporter.profile?.displayName?.trim() || "کاربر",
    offenderName: row.message.user?.profile?.displayName?.trim() || "کاربر",
    messageBody: row.message.body,
    roomSlug: row.message.roomSlug,
    teamId: row.message.teamId,
  }));
}