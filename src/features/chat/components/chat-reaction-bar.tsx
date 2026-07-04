"use client";

import { CHAT_ALLOWED_REACTIONS } from "@/shared/constants/chat";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { ChatReactionSummary } from "@/shared/types/chat";

export function ChatReactionBar({
  reactions,
  onReact,
  disabled,
  align = "end",
}: {
  reactions: ChatReactionSummary[];
  onReact: (emoji: string) => void;
  disabled?: boolean;
  align?: "start" | "end";
}) {
  const withCounts = reactions.filter((r) => r.count > 0);
  if (!withCounts.length) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 pt-1",
        align === "start" ? "justify-start" : "justify-end",
      )}
    >
      {withCounts.map((summary) => (
        <button
          key={summary.emoji}
          type="button"
          disabled={disabled}
          onClick={() => onReact(summary.emoji)}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs transition",
            summary.reactedByMe
              ? "border-bordin-orange/50 bg-bordin-orange/15"
              : "border-white/8 bg-white/5 hover:border-white/20",
            disabled && "opacity-50",
          )}
        >
          <span>{summary.emoji}</span>
          <span className="tabular-nums text-white/50">{formatPersianNumber(summary.count)}</span>
        </button>
      ))}
    </div>
  );
}

export function ChatReactionPicker({
  onReact,
  onReply,
  onEdit,
  onReport,
  onClose,
  showReport,
}: {
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onEdit?: () => void;
  onReport?: () => void;
  onClose: () => void;
  showReport?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="بستن" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl border border-white/10 bg-[#111] p-4 sm:rounded-3xl">
        <p className="mb-3 text-center text-xs text-white/50">واکنش</p>
        <div className="grid grid-cols-5 gap-2">
          {CHAT_ALLOWED_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg transition hover:border-bordin-orange/40 hover:bg-bordin-orange/10"
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          {onReply ? (
            <button
              type="button"
              onClick={() => {
                onReply();
                onClose();
              }}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-white/80"
            >
              پاسخ
            </button>
          ) : null}
          {onEdit ? (
            <button
              type="button"
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="flex-1 rounded-xl border border-bordin-orange/30 bg-bordin-orange/10 py-2.5 text-xs font-semibold text-bordin-orange"
            >
              ویرایش
            </button>
          ) : null}
          {showReport && onReport ? (
            <button
              type="button"
              onClick={() => {
                onReport();
                onClose();
              }}
              className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-semibold text-red-300"
            >
              گزارش پیام
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
