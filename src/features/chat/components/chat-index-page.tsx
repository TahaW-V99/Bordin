"use client";

import { useEffect, useState } from "react";
import { ChatRoomListPage } from "@/features/chat/components/chat-room-list-page";
import { CHAT_UNREAD_UPDATED_EVENT } from "@/shared/constants/chat";
import type { ChatRoomListItemDto } from "@/shared/types/chat";

export function ChatIndexPage() {
  const [rooms, setRooms] = useState<ChatRoomListItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chat/rooms", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        setRooms(data.rooms ?? []);
        window.dispatchEvent(new CustomEvent(CHAT_UNREAD_UPDATED_EVENT));
      })
      .finally(() => setLoading(false));
  }, []);

  return <ChatRoomListPage rooms={rooms} loading={loading} />;
}
