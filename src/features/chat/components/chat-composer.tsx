"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, Search, Send, Swords, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  CHAT_MAX_TEXT_LENGTH,
  isMentionEnabledChatParam,
  isTeamMentionChatParam,
} from "@/shared/constants/chat";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  decodeMentionsForComposer,
  encodeComposerMentions,
  formatChatMentionPlainText,
  formatComposerMentionLabel,
  mentionCandidateKey,
  renderChatMentionBody,
  type ComposerMentionMeta,
} from "@/shared/lib/chat-mentions";
import { ChatReplyQuote } from "@/features/chat/components/chat-reply-quote";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import type { ChatMessageDto, ChatMentionCandidateDto, ChatReplyPreviewDto } from "@/shared/types/chat";

function getMentionQuery(text: string, cursor: number) {
  const beforeCursor = text.slice(0, cursor);
  const atIndex = beforeCursor.lastIndexOf("@");
  if (atIndex < 0) return null;
  const beforeAt = beforeCursor[atIndex - 1];
  if (beforeAt && !/\s/.test(beforeAt)) return null;
  const afterAt = beforeCursor.slice(atIndex + 1);
  if (afterAt.includes("[") || afterAt.includes("]")) return null;
  if (afterAt.includes("@")) return null;
  return { atIndex, query: afterAt };
}

export function ChatComposer({
  roomSlug,
  disabled,
  loading,
  replyTo,
  editingMessage,
  onCancelReply,
  onCancelEdit,
  onSend,
  onEdit,
  showDuelShortcut,
  onDuelShortcut,
}: {
  roomSlug: string;
  disabled?: boolean;
  disabledReason?: string | null;
  loading?: boolean;
  replyTo?: ChatReplyPreviewDto | null;
  editingMessage?: ChatMessageDto | null;
  onCancelReply?: () => void;
  onCancelEdit?: () => void;
  onSend: (body: string, replyToId?: string) => Promise<void>;
  onEdit?: (messageId: string, body: string) => Promise<void>;
  showDuelShortcut?: boolean;
  onDuelShortcut?: () => void;
}) {
  const [text, setText] = useState("");
  const [participants, setParticipants] = useState<ChatMentionCandidateDto[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [selectedMentionKeys, setSelectedMentionKeys] = useState<Set<string>>(new Set());
  const [mentionMeta, setMentionMeta] = useState<ComposerMentionMeta>(new Map());
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const blocked = disabled || loading;
  const mentionEnabled = isMentionEnabledChatParam(roomSlug);
  const teamMentionMode = isTeamMentionChatParam(roomSlug);
  const mention = useMemo(
    () => (mentionEnabled ? getMentionQuery(text, cursorPos) : null),
    [mentionEnabled, text, cursorPos],
  );

  const syncCursor = () => {
    const pos = textareaRef.current?.selectionStart ?? text.length;
    setCursorPos(pos);
  };

  useEffect(() => {
    if (!editingMessage) return;
    const decoded = decodeMentionsForComposer(editingMessage.body);
    setText(decoded.text);
    setMentionMeta(decoded.meta);
  }, [editingMessage]);

  useEffect(() => {
    if (!mention) {
      setParticipants([]);
      setMentionSearch("");
      setSelectedMentionKeys(new Set());
      return;
    }
    const q = mentionSearch.trim() || mention.query.trim();
    setMentionLoading(true);
    fetch(`/api/chat/participants?room=${encodeURIComponent(roomSlug)}&q=${encodeURIComponent(q)}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => setParticipants(data.participants ?? []))
      .finally(() => setMentionLoading(false));
  }, [mention, mentionSearch, roomSlug]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || blocked) return;
    const encoded = encodeComposerMentions(trimmed, mentionMeta);
    if (editingMessage && onEdit) {
      await onEdit(editingMessage.id, encoded);
      setText("");
      setMentionMeta(new Map());
      return;
    }
    await onSend(encoded, replyTo?.id);
    setText("");
    setMentionMeta(new Map());
  };

  const duelShortcut = () => {
    onDuelShortcut?.();
    window.dispatchEvent(new CustomEvent("bordin-chat-duel-hint"));
  };

  const toggleMentionSelection = (participant: ChatMentionCandidateDto) => {
    const key = mentionCandidateKey(participant);
    setSelectedMentionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applySelectedMentions = () => {
    const textarea = textareaRef.current;
    if (!textarea || !mention || selectedMentionKeys.size === 0) return;

    const selected = participants.filter((participant) =>
      selectedMentionKeys.has(mentionCandidateKey(participant)),
    );
    if (selected.length === 0) return;

    const cursor = textarea.selectionStart ?? text.length;
    const labels = selected.map((participant) => {
      const visible = formatComposerMentionLabel(participant.displayName);
      const id =
        participant.kind === "team" ? participant.teamId : participant.userId;
      if (!id) return null;
      return {
        visible,
        entry: {
          kind: participant.kind,
          id,
          displayName: participant.displayName,
        } as const,
      };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item));

    const replacement = `${labels.map((item) => item.visible).join(" ")} `;
    const nextValue = `${text.slice(0, mention.atIndex)}${replacement}${text.slice(cursor)}`;

    setMentionMeta((prev) => {
      const next = new Map(prev);
      for (const item of labels) {
        next.set(item.visible, item.entry);
      }
      return next;
    });
    setText(nextValue);
    setSelectedMentionKeys(new Set());
    setMentionSearch("");

    requestAnimationFrame(() => {
      const pos = mention.atIndex + replacement.length;
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
      setCursorPos(pos);
    });
  };

  return (
    <div className="relative border-t border-white/10 bg-black/95 px-4 py-3 safe-bottom">
      {showDuelShortcut ? (
        <button
          type="button"
          onClick={duelShortcut}
          className="absolute bottom-[calc(100%+0.35rem)] start-0 flex items-center gap-1 rounded-full border border-bordin-orange/35 bg-bordin-orange/10 px-2.5 py-1 text-[10px] font-semibold text-bordin-orange transition hover:bg-bordin-orange/20"
        >
          <Swords className="h-3 w-3" />
          دوئل
        </button>
      ) : null}

      {mention ? (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 w-[380px] max-w-[calc(100vw-2rem)] -translate-x-1/2">
          <div className="flex h-[260px] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#101010] shadow-2xl">
            <div className="border-b border-white/8 px-3 py-2">
              <div className="relative">
                <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
                <input
                  type="search"
                  value={mentionSearch}
                  onChange={(e) => setMentionSearch(e.target.value)}
                  placeholder={teamMentionMode ? "جستجوی نام تیم…" : "جستجوی نام کاربر…"}
                  className="h-8 w-full rounded-xl border border-white/10 bg-white/5 pe-3 ps-8 text-xs text-white outline-none placeholder:text-white/30 focus:border-bordin-orange/40"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {participants.length > 0 ? (
                <div className="space-y-1">
                  {participants.map((participant) => {
                    const key = mentionCandidateKey(participant);
                    const selected = selectedMentionKeys.has(key);
                    return (
                      <button
                        key={
                          participant.kind === "team"
                            ? `team-${participant.teamId}`
                            : `user-${participant.userId}`
                        }
                        type="button"
                        onClick={() => toggleMentionSelection(participant)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-start transition hover:bg-white/5"
                      >
                        {participant.kind === "team" ? (
                          participant.logoUrl ? (
                            <Image
                              src={participant.logoUrl}
                              alt=""
                              width={32}
                              height={32}
                              className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                              unoptimized
                            />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[10px] text-white/40 ring-1 ring-white/10">
                              تیم
                            </span>
                          )
                        ) : (
                          <ProfileAvatar
                            avatarUrl={participant.avatarUrl ?? null}
                            displayName={participant.displayName}
                            size="sm"
                            className="h-8 w-8 rounded-xl"
                          />
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs text-white/80">
                          {participant.displayName}
                        </span>
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                            selected
                              ? "border-bordin-orange bg-bordin-orange text-black"
                              : "border-white/20 bg-transparent text-transparent"
                          }`}
                          aria-hidden
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : mentionLoading ? (
                <p className="px-2 py-3 text-xs text-white/45">در حال جستجو...</p>
              ) : (
                <p className="px-2 py-3 text-xs text-white/45">
                  {teamMentionMode ? "تیمی برای منشن پیدا نشد." : "کاربری برای منشن پیدا نشد."}
                </p>
              )}
            </div>
            <div className="border-t border-white/8 px-3 py-2">
              <Button
                size="sm"
                fullWidth
                disabled={selectedMentionKeys.size === 0}
                onClick={applySelectedMentions}
              >
                افزودن منشن
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {replyTo ? (
        <div className="mb-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] text-bordin-orange/80">در حال پاسخ به</p>
            <ChatReplyQuote reply={replyTo} />
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="mt-5 shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white/70"
            aria-label="لغو پاسخ"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {editingMessage ? (
        <div className="mb-2 flex items-start gap-2">
          <div className="min-w-0 flex-1 rounded-2xl border border-bordin-orange/25 bg-bordin-orange/10 px-3 py-2">
            <p className="mb-1 text-[10px] text-bordin-orange/80">در حال ویرایش پیام</p>
            <p className="line-clamp-2 text-xs leading-6 text-white/65">
              {formatChatMentionPlainText(editingMessage.body)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelEdit}
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white/70"
            aria-label="لغو ویرایش"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <div className="relative max-h-28 min-h-[3rem] flex-1">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-2xl border border-transparent px-3 py-2 text-sm leading-6 text-white"
          >
            {text ? renderChatMentionBody(text) : null}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, CHAT_MAX_TEXT_LENGTH));
              setCursorPos(e.target.selectionStart ?? e.target.value.length);
            }}
            onSelect={syncCursor}
            onKeyUp={syncCursor}
            onClick={syncCursor}
            disabled={blocked}
            rows={2}
            placeholder={
              disabled
                ? "ارسال پیام در این اتاق مجاز نیست"
                : editingMessage
                  ? "پیام خود را ویرایش کنید…"
                  : "پیام متنی بنویسید…"
            }
            className="relative max-h-28 min-h-[3rem] w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-transparent caret-white outline-none placeholder:text-white/30 focus:border-bordin-orange/50 disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </div>
        <Button
          size="sm"
          className="h-11 w-11 shrink-0 rounded-2xl p-0"
          loading={loading}
          disabled={blocked || !text.trim()}
          onClick={() => void submit()}
          aria-label={editingMessage ? "ثبت ویرایش پیام" : "ارسال پیام"}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-white/35">
        {formatPersianNumber(text.length)} / {formatPersianNumber(CHAT_MAX_TEXT_LENGTH)}
      </p>
    </div>
  );
}
