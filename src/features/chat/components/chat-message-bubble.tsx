"use client";

import Link from "next/link";
import { cn } from "@/shared/lib/cn";
import { formatShamsiShort, formatTehranTime } from "@/shared/lib/dates";
import type { ChatMessageDto } from "@/shared/types/chat";

export function ChatMessageBubble({ message }: { message: ChatMessageDto }) {
  const isSystem = message.type === "SYSTEM" || !message.sender;

  if (isSystem) {
    return (
      <div className="flex justify-center py-1">
        <p className="rounded-full bg-white/5 px-3 py-1 text-center text-[11px] leading-6 text-white/55">
          {message.body}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center gap-2 text-[11px] text-white/45">
        {message.sender?.showcaseSlug ? (
          <Link
            href={`/showcase/${message.sender.showcaseSlug}`}
            className="font-semibold text-bordin-orange hover:underline"
          >
            {message.sender.displayName}
          </Link>
        ) : (
          <span className="font-semibold text-white/70">{message.sender?.displayName}</span>
        )}
        {message.sender?.levelNameFa ? (
          <span className="rounded-full bg-bordin-green/10 px-2 py-0.5 text-bordin-green">
            {message.sender.levelNameFa}
          </span>
        ) : null}
        <span className="ms-auto tabular-nums">
          {formatTehranTime(message.createdAt)} · {formatShamsiShort(message.createdAt)}
        </span>
      </div>
      <div
        className={cn(
          "rounded-2xl border px-3 py-2 text-sm leading-7",
          message.type === "TEXT"
            ? "border-white/10 bg-white/[0.04] text-white/90"
            : "border-bordin-orange/25 bg-bordin-orange/10 text-white",
        )}
      >
        {message.body}
      </div>
    </div>
  );
}
