export const CHAT_UNREAD_UPDATED_EVENT = "bordin-chat-unread-updated";

export const CHAT_DISPLAY_NAME_REQUIRED_ERROR = "CHAT_DISPLAY_NAME_REQUIRED";
export const CHAT_DISPLAY_NAME_REQUIRED_FA =
  "الزام به ثبت اسم! برای ارسال پیغام در چت‌روم‌ها، باید ابتدا اسم خود را وارد کنید";

export const CHAT_ROOM_SLUGS = [
  "public",
  "today-predictions",
  "teams",
  "competitions",
] as const;

export type ChatRoomSlugKey = (typeof CHAT_ROOM_SLUGS)[number];

export const CHAT_MESSAGE_TYPES = [
  "TEXT",
  "SYSTEM",
  "PREDICTION_RESULT",
  "DUEL_CHALLENGE",
  "COMPETITION_INFO",
] as const;

export type ChatMessageTypeKey = (typeof CHAT_MESSAGE_TYPES)[number];

export const CHAT_MAX_TEXT_LENGTH = 500;
export const CHAT_MESSAGES_PAGE_SIZE = 50;

export const CHAT_ALLOWED_REACTIONS = ["⚽", "🔥", "👑", "🏆", "💰", "😂", "😎", "✅", "❌"] as const;

export type ChatReactionEmoji = (typeof CHAT_ALLOWED_REACTIONS)[number];

export type ChatRoomDefinition = {
  slug: ChatRoomSlugKey;
  titleFa: string;
  descriptionFa: string;
  icon: "public" | "predictions" | "teams" | "competitions";
};

export const CHAT_ROOMS: ChatRoomDefinition[] = [
  {
    slug: "public",
    titleFa: "عمومی",
    descriptionFa: "گفتگوی آزاد فوتبالی‌ها",
    icon: "public",
  },
  {
    slug: "today-predictions",
    titleFa: "پیش‌بینی امروز",
    descriptionFa: "بحث درباره بازی‌های امروز کنداکتور",
    icon: "predictions",
  },
  {
    slug: "teams",
    titleFa: "تیم‌ها",
    descriptionFa: "گفتگوی اعضای تیم‌ها",
    icon: "teams",
  },
  {
    slug: "competitions",
    titleFa: "رقابت‌ها",
    descriptionFa: "جام‌ها، تورنومنت‌ها و رقابت‌های تیمی",
    icon: "competitions",
  },
];

export const CHAT_TEAMS_ACCESS_DENIED_FA =
  "برای ورود به این اتاق باید عضو حداقل یک تیم باشید.";

export function isChatRoomSlug(value: string): value is ChatRoomSlugKey {
  return (CHAT_ROOM_SLUGS as readonly string[]).includes(value);
}

/** Maps URL slug to Prisma enum value. */
export function chatRoomSlugToDb(slug: ChatRoomSlugKey | "teams-all") {
  const map = {
    public: "PUBLIC",
    "today-predictions": "TODAY_PREDICTIONS",
    teams: "TEAMS",
    "teams-all": "TEAMS_ALL",
    competitions: "COMPETITIONS",
  } as const;
  return map[slug];
}

export function chatRoomSlugFromDb(
  value: string,
): ChatRoomSlugKey | "teams-all" | null {
  const map: Record<string, ChatRoomSlugKey | "teams-all"> = {
    PUBLIC: "public",
    TODAY_PREDICTIONS: "today-predictions",
    TEAMS: "teams",
    TEAMS_ALL: "teams-all",
    COMPETITIONS: "competitions",
  };
  return map[value] ?? null;
}

export type ParsedChatRoomParam = {
  roomKey: string;
  dbSlug: "PUBLIC" | "TODAY_PREDICTIONS" | "TEAMS" | "TEAMS_ALL" | "COMPETITIONS";
  teamId: string | null;
  titleFa?: string;
  href: string;
};

export function isTeamChatParam(param: string) {
  return param === "teams-all" || param.startsWith("team-");
}

export function isTeamSpecificChatParam(param: string) {
  return param.startsWith("team-");
}

export function isUserMentionChatParam(param: string) {
  return isChatRoomSlug(param) && param !== "teams";
}

export function isTeamMentionChatParam(param: string) {
  return param === "teams-all";
}

export function isMentionEnabledChatParam(param: string) {
  return isUserMentionChatParam(param) || isTeamMentionChatParam(param);
}

export function parseChatRoomParam(param: string): ParsedChatRoomParam | null {
  if (isChatRoomSlug(param)) {
    const def = CHAT_ROOMS.find((r) => r.slug === param);
    return {
      roomKey: param,
      dbSlug: chatRoomSlugToDb(param),
      teamId: null,
      titleFa: def?.titleFa,
      href: param === "teams" ? "/chat/teams" : `/chat/${param}`,
    };
  }
  if (param === "teams-all") {
    return {
      roomKey: "teams-all",
      dbSlug: "TEAMS_ALL",
      teamId: null,
      titleFa: "تمام تیم‌ها",
      href: "/chat/teams/all",
    };
  }
  if (param.startsWith("team-")) {
    const teamId = param.slice(5);
    if (!teamId) return null;
    return {
      roomKey: param,
      dbSlug: "TEAMS",
      teamId,
      href: `/chat/teams/${teamId}`,
    };
  }
  return null;
}

export function chatRoomKeyFromParam(param: string): string | null {
  return parseChatRoomParam(param)?.roomKey ?? null;
}
