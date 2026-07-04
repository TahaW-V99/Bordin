import { ChatMessageType, ChatRoomSlug } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  formatSystemLevelMessage,
  formatSystemMedalMessage,
  formatSystemPerfectPredictionMessage,
} from "@/shared/lib/chat-logic";

type MemorySystemRow = {
  id: string;
  roomSlug: ChatRoomSlug;
  type: ChatMessageType;
  body: string;
  createdAt: Date;
};

const memorySystemMessages: MemorySystemRow[] = [];
let memorySystemId = 0;

function nextSystemId() {
  memorySystemId += 1;
  return `chat-sys-${memorySystemId}`;
}

export async function getUserDisplayNameForChat(userId: string) {
  if (await shouldUseMemoryDb()) return "کاربر بُردین";

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { displayName: true },
  });
  return profile?.displayName?.trim() || "کاربر بُردین";
}

async function insertPublicSystemMessage(body: string) {
  if (await shouldUseMemoryDb()) {
    memorySystemMessages.push({
      id: nextSystemId(),
      roomSlug: ChatRoomSlug.PUBLIC,
      type: ChatMessageType.SYSTEM,
      body,
      createdAt: new Date(),
    });
    return;
  }

  await prisma.chatMessage.create({
    data: {
      roomSlug: ChatRoomSlug.PUBLIC,
      userId: null,
      type: ChatMessageType.SYSTEM,
      body,
    },
  });
}

export async function publishMedalEarnedSystemMessage(userId: string, medalTitleFa: string) {
  const displayName = await getUserDisplayNameForChat(userId);
  await insertPublicSystemMessage(formatSystemMedalMessage(displayName, medalTitleFa));
}

export async function publishLevelUpSystemMessage(userId: string, levelNameFa: string) {
  const displayName = await getUserDisplayNameForChat(userId);
  await insertPublicSystemMessage(formatSystemLevelMessage(displayName, levelNameFa));
}

export async function publishPerfectPredictionSystemMessage(userId: string) {
  const displayName = await getUserDisplayNameForChat(userId);
  await insertPublicSystemMessage(formatSystemPerfectPredictionMessage(displayName));
}

/** Exposed for memory-db chat reads */
export function listMemorySystemMessages() {
  return memorySystemMessages;
}
