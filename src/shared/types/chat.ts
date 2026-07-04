import type { ChatMessageTypeKey, ChatRoomSlugKey } from "@/shared/constants/chat";
import type { ChatCredibilityTier } from "@/shared/lib/chat-logic";

export type ChatReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

export type ChatSenderDto = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  showcaseSlug: string | null;
  levelNameFa: string | null;
  credibilityTier: ChatCredibilityTier;
  globalRank: number | null;
};

export type ChatReplyPreviewDto = {
  id: string;
  type: ChatMessageTypeKey;
  body: string;
  senderDisplayName: string | null;
  createdAt: string;
};

export type ChatMessageDto = {
  id: string;
  roomSlug: ChatRoomSlugKey;
  type: ChatMessageTypeKey;
  body: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  isMine: boolean;
  sender: ChatSenderDto | null;
  reactions: ChatReactionSummary[];
  replyTo: ChatReplyPreviewDto | null;
};

export type ChatRoomListItemDto = {
  slug: string;
  titleFa: string;
  descriptionFa: string;
  icon: "public" | "predictions" | "teams" | "competitions";
  canAccess: boolean;
  canPost: boolean;
  lockedReasonFa: string | null;
  unreadCount?: number;
  href?: string;
};

export type ChatTeamRoomListItemDto = {
  slug: string;
  teamId?: string;
  titleFa: string;
  descriptionFa: string;
  logoUrl?: string | null;
  unreadCount: number;
  href: string;
};

export type ChatDuelOpponentDto = {
  userId: string;
  displayName: string;
  showcaseSlug: string | null;
  avatarUrl: string | null;
  globalRank: number | null;
  totalXp: number;
  isTeammate: boolean;
};

export type ChatActiveCompetitionCard = {
  id: string;
  kind: "cup" | "tournament" | "team";
  titleFa: string;
  subtitleFa: string | null;
  href: string;
  entryFeeCoins: number | null;
};

export type ChatRoomContextDto = {
  todayKandakator: {
    matches: Array<{
      id: string;
      matchId: string;
      match: {
        homeTeamName: string;
        awayTeamName: string;
        leagueName: string | null;
        kickoffAt: string;
        homeScore: number | null;
        awayScore: number | null;
        status: string;
      };
      prediction: {
        homePrediction: number;
        awayPrediction: number;
      } | null;
    }>;
  } | null;
  activeCompetitions: ChatActiveCompetitionCard[];
};

export type ChatRoomDetailDto = {
  room: ChatRoomListItemDto;
  messages: ChatMessageDto[];
  context: ChatRoomContextDto;
};

export type ChatMentionCandidateDto = {
  kind: "user" | "team";
  userId?: string;
  teamId?: string;
  displayName: string;
  showcaseSlug?: string | null;
  globalRank?: number | null;
  totalXp?: number;
  avatarUrl?: string | null;
  logoUrl?: string | null;
  isTeammate?: boolean;
};

export type ChatParticipantDto = ChatMentionCandidateDto;

export type ChatShareTargetDto = {
  slug: string;
  titleFa: string;
  descriptionFa: string;
  href: string;
  group: "general" | "team";
  canAccess: boolean;
  canPost: boolean;
};
