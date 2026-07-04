"use client";

import { cn } from "@/shared/lib/cn";
import { formatChatMentionPlainText } from "@/shared/lib/chat-mentions";
import type { ChatReplyPreviewDto } from "@/shared/types/chat";

export function ChatReplyQuote({
  reply,
  className,
  onClick,
}: {
  reply: ChatReplyPreviewDto;
  className?: string;
  onClick?: () => void;
}) {
  const label = reply.senderDisplayName ? `${reply.senderDisplayName}: ` : "";

  const content = (
    <>
      {label ? (
        <span className="block text-[11px] font-medium text-bordin-orange/90">{label}</span>
      ) : null}
      <span className="line-clamp-2 text-[11px] leading-5 text-white/55">
        {formatChatMentionPlainText(reply.body)}
      </span>
    </>
  );

  const baseClass = cn(
    "w-full rounded-xl border border-white/8 bg-black/30 px-2.5 py-1.5 text-right",
    "border-s-2 border-s-bordin-orange/50",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(baseClass, "transition hover:bg-white/5")}>
        {content}
      </button>
    );
  }

  return <div className={baseClass}>{content}</div>;
}
