"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { formatShamsiShort, formatTehranTime } from "@/shared/lib/dates";
import type { ChatMessageDto, ChatReplyPreviewDto } from "@/shared/types/chat";
import {
  ChatSenderHeader,
  credibilityMessageClass,
} from "@/features/chat/components/chat-sender-header";
import { ChatReactionBar, ChatReactionPicker } from "@/features/chat/components/chat-reaction-bar";
import { ChatReplyQuote } from "@/features/chat/components/chat-reply-quote";
import { PredictionResultShareCard } from "@/features/chat/components/chat-message-cards/prediction-result-share-card";
import { DuelChallengeCard } from "@/features/chat/components/chat-message-cards/duel-challenge-card";
import { useToast } from "@/shared/components/ui/toast";
import { renderChatMentionBody } from "@/shared/lib/chat-mentions";
import type { ChatReactionSummary } from "@/shared/types/chat";

function renderMentionBody(body: string) {
  return renderChatMentionBody(body, "font-semibold text-sky-400");
}

function toReplyPreview(message: ChatMessageDto): ChatReplyPreviewDto {
  return {
    id: message.id,
    type: message.type,
    body: message.body,
    senderDisplayName: message.sender?.displayName ?? null,
    createdAt: message.createdAt,
  };
}

export function ChatMessageRenderer({
  message,
  onProfileClick,
  onReacted,
  onReply,
  onEdit,
  onReplyQuoteClick,
  highlightDuelId,
  highlightMessageId,
}: {
  message: ChatMessageDto;
  onProfileClick?: (slug: string) => void;
  onReacted?: (messageId: string, reactions: ChatReactionSummary[]) => void;
  onReply?: (reply: ChatReplyPreviewDto) => void;
  onEdit?: (message: ChatMessageDto) => void;
  onReplyQuoteClick?: (messageId: string) => void;
  highlightDuelId?: string | null;
  highlightMessageId?: string | null;
}) {
  const { toast } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const isSystem = message.type === "SYSTEM" || !message.sender;
  const mine = message.isMine;
  const canEdit = message.isMine && message.type === "TEXT";
  const timeLabel = `${formatTehranTime(message.createdAt)} · ${formatShamsiShort(message.createdAt)}`;

  const react = async (emoji: string) => {
    const res = await fetch(`/api/chat/messages/${message.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    onReacted?.(message.id, data.reactions ?? []);
  };

  const report = async () => {
    setReporting(true);
    try {
      const res = await fetch(`/api/chat/messages/${message.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "گزارش ناموفق بود");
      toast("گزارش تخلف شما با موفقیت ثبت شد.", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setReporting(false);
    }
  };

  const startReply = () => {
    onReply?.(toReplyPreview(message));
  };

  const openPicker = () => {
    setPickerOpen(true);
  };

  if (isSystem) {
    return (
      <>
        <div id={`chat-message-${message.id}`} className="group flex flex-col items-center gap-1 py-1">
          {message.replyTo ? (
            <ChatReplyQuote
              reply={message.replyTo}
              className="max-w-md"
              onClick={
                onReplyQuoteClick ? () => onReplyQuoteClick(message.replyTo!.id) : undefined
              }
            />
          ) : null}
          <button
            type="button"
            onClick={openPicker}
            className="max-w-md rounded-full border border-transparent bg-white/5 px-3 py-1 text-center text-[11px] leading-6 text-white/55 transition hover:border-white/15 hover:bg-white/10"
          >
            {message.body}
          </button>
          <div className="flex w-full max-w-md justify-center">
            <ChatReactionBar
              reactions={message.reactions}
              onReact={(emoji) => void react(emoji)}
              align={mine ? "end" : "start"}
            />
          </div>
        </div>

        {pickerOpen ? (
          <ChatReactionPicker
            onReact={(emoji) => void react(emoji)}
            onReply={onReply ? startReply : undefined}
            showReport={false}
            onClose={() => setPickerOpen(false)}
          />
        ) : null}
      </>
    );
  }

  const sender = message.sender!;
  const tier = sender.credibilityTier;
  const duelPayload = message.type === "DUEL_CHALLENGE" ? message.payload : null;
  const duelId =
    duelPayload && typeof duelPayload.duelId === "string" ? duelPayload.duelId : null;
  const duelHighlight = Boolean(highlightDuelId && duelId === highlightDuelId);
  const messageHighlight = highlightMessageId === message.id;

  return (
    <>
      <div
        id={`chat-message-${message.id}`}
        className={cn("group flex flex-col gap-1 py-1", mine ? "items-start" : "items-end")}
      >
        <div className={cn("flex w-full items-start gap-1", mine ? "justify-start" : "justify-end")}>
          <div className={cn("min-w-0", mine ? "w-full max-w-[85%]" : "flex-1")}>
            <ChatSenderHeader
              sender={sender}
              timeLabel={timeLabel}
              onProfileClick={onProfileClick}
              align={mine ? "start" : "end"}
            />
          </div>
        </div>

        {message.replyTo ? (
          <ChatReplyQuote
            reply={message.replyTo}
            className={cn(mine ? "max-w-[85%] self-start" : "self-end")}
            onClick={
              onReplyQuoteClick ? () => onReplyQuoteClick(message.replyTo!.id) : undefined
            }
          />
        ) : null}

        {message.type === "PREDICTION_RESULT" && message.payload ? (
          <PredictionResultShareCard payload={message.payload} />
        ) : message.type === "DUEL_CHALLENGE" && message.payload ? (
          <div
            className={cn(
              duelHighlight && "animate-pulse rounded-2xl ring-2 ring-bordin-orange/70 ring-offset-2 ring-offset-black",
            )}
          >
            <DuelChallengeCard payload={message.payload} />
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className={cn(
              "rounded-2xl border px-3 py-2 text-start text-sm leading-7 text-white/90 transition",
              mine
                ? "max-w-[85%] self-start hover:border-bordin-orange/35 hover:bg-bordin-orange/12"
                : "w-full self-end hover:border-sky-400/35 hover:bg-sky-400/10",
              messageHighlight &&
                "animate-pulse ring-2 ring-bordin-orange/70 ring-offset-2 ring-offset-black",
              credibilityMessageClass(tier),
            )}
          >
            {renderMentionBody(message.body)}
          </button>
        )}

        <div className={cn("w-full", mine ? "max-w-[85%] self-start" : "self-end")}>
          <ChatReactionBar reactions={message.reactions} onReact={(emoji) => void react(emoji)} />
        </div>
      </div>

      {pickerOpen ? (
        <ChatReactionPicker
          onReact={(emoji) => void react(emoji)}
          onReply={onReply ? startReply : undefined}
          onEdit={canEdit && onEdit ? () => onEdit(message) : undefined}
          onReport={!isSystem ? () => void report() : undefined}
          showReport={!isSystem}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {reporting ? null : null}
    </>
  );
}
