"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { AppBackButton } from "@/shared/components/navigation/app-back-button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { ChatMessageRenderer } from "@/features/chat/components/chat-message-renderer";
import { ChatComposer } from "@/features/chat/components/chat-composer";
import { ChatTodayMatchesPanel } from "@/features/chat/components/chat-today-matches-panel";
import { ChatCompetitionsPanel } from "@/features/chat/components/chat-competitions-panel";
import { ChatProfilePreviewModal } from "@/features/chat/components/chat-profile-preview-modal";
import { ChatDisplayNameRequiredModal } from "@/features/chat/components/chat-display-name-modal";
import { restoreChatRoomScroll, saveChatRoomScroll } from "@/shared/lib/chat-scroll";
import {
  CHAT_DISPLAY_NAME_REQUIRED_ERROR,
  CHAT_UNREAD_UPDATED_EVENT,
} from "@/shared/constants/chat";
import type { ChatReplyPreviewDto, ChatRoomDetailDto } from "@/shared/types/chat";

function chatBackHref(slug: string) {
  if (slug === "teams-all" || slug.startsWith("team-")) return "/chat/teams";
  return "/chat";
}

export function ChatRoomPage({ slug }: { slug: string }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const highlightDuelId = searchParams.get("duelId");
  const highlightMessageId = searchParams.get("messageId");
  const [detail, setDetail] = useState<ChatRoomDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatReplyPreviewDto | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatRoomDetailDto["messages"][number] | null>(null);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const initialScrollRestored = useRef(false);

  const dispatchUnreadUpdate = () => {
    window.dispatchEvent(new CustomEvent(CHAT_UNREAD_UPDATED_EVENT));
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetch(`/api/chat/rooms/${encodeURIComponent(slug)}`, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      if (!silent) toast(data.error ?? "خطا در بارگذاری چت", "error");
      setLoading(false);
      return;
    }
    setDetail(data as ChatRoomDetailDto);
    setLoading(false);
    dispatchUnreadUpdate();
  }, [slug, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!detail?.room.canAccess) return;
    const id = window.setInterval(() => {
      void load(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [detail?.room.canAccess, load]);

  useEffect(() => {
    if (!detail || initialScrollRestored.current) return;
    initialScrollRestored.current = true;
    restoreChatRoomScroll(slug, scrollRef.current);
  }, [detail, slug]);

  useEffect(() => {
    if (!profileSlug) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [detail?.messages.length, profileSlug]);

  useEffect(() => {
    if (!highlightDuelId || !detail?.messages.length) return;
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-duel-id="${highlightDuelId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [highlightDuelId, detail?.messages.length]);

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`chat-message-${messageId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  useEffect(() => {
    if (!highlightMessageId || !detail?.messages.length) return;
    const timer = window.setTimeout(() => {
      scrollToMessage(highlightMessageId);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [highlightMessageId, detail?.messages.length]);

  const openProfile = (showcaseSlug: string) => {
    if (scrollRef.current) {
      saveChatRoomScroll(slug, scrollRef.current.scrollTop);
    }
    setProfileSlug(showcaseSlug);
  };

  const send = async (body: string, replyToId?: string) => {
    setSending(true);
    try {
      const res = await fetch(`/api/chat/rooms/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, replyToId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === CHAT_DISPLAY_NAME_REQUIRED_ERROR) {
          setNameModalOpen(true);
          return;
        }
        throw new Error(data.error ?? "ارسال پیام ناموفق بود");
      }
      setReplyTo(null);
      setEditingMessage(null);
      await load(true);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setSending(false);
    }
  };

  const editMessage = async (messageId: string, body: string) => {
    setSending(true);
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ویرایش پیام ناموفق بود");
      setEditingMessage(null);
      await load(true);
      toast("پیام با موفقیت ویرایش شد", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setSending(false);
    }
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  if (loading && !detail) {
    return (
      <>
        <PageHeader
          title="چت"
          startAction={<AppBackButton fallbackHref={chatBackHref(slug)} ariaLabel="بازگشت" />}
        />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-16" />
        </div>
      </>
    );
  }

  if (!detail) {
    return (
      <>
        <PageHeader
          title="چت"
          startAction={<AppBackButton fallbackHref={chatBackHref(slug)} ariaLabel="بازگشت" />}
        />
        <div className="px-4 py-8 text-center text-sm text-white/50">اتاق چت یافت نشد.</div>
      </>
    );
  }

  const { room, messages, context } = detail;
  const isTodayRoom = slug === "today-predictions";

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={room.titleFa}
        subtitle={room.descriptionFa}
        titleClassName={slug.startsWith("team-") ? "text-base font-semibold md:text-lg" : undefined}
        startAction={<AppBackButton fallbackHref={chatBackHref(slug)} ariaLabel="بازگشت" />}
      />

      {!room.canAccess ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <p className="text-sm leading-8 text-white/60">{room.lockedReasonFa}</p>
          <Link href="/profile/teams" className="mt-4 text-sm text-bordin-orange">
            رفتن به تیم‌های من
          </Link>
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            className="relative flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-2"
          >
            <div ref={topRef} />
            {isTodayRoom ? (
              <ChatTodayMatchesPanel
                context={context.todayKandakator}
                onDuelCreated={() => void load(true)}
                scrollToTop={scrollToTop}
              />
            ) : null}
            {slug === "competitions" ? (
              <ChatCompetitionsPanel competitions={context.activeCompetitions} />
            ) : null}

            <div className="space-y-1">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-white/40">
                  هنوز پیامی ارسال نشده. اولین نفر باشید!
                </p>
              ) : (
                messages.map((message) => (
                  <ChatMessageRenderer
                    key={message.id}
                    message={message}
                    onProfileClick={openProfile}
                    onReacted={() => void load(true)}
                    onReply={(nextReply) => {
                      setEditingMessage(null);
                      setReplyTo(nextReply);
                    }}
                    onEdit={(nextMessage) => {
                      setReplyTo(null);
                      setEditingMessage(nextMessage);
                    }}
                    onReplyQuoteClick={scrollToMessage}
                    highlightDuelId={highlightDuelId}
                    highlightMessageId={highlightMessageId}
                  />
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="sticky bottom-0 z-40 mx-auto w-full max-w-lg">
            <div className="pointer-events-none absolute -top-12 left-[2mm] flex flex-col gap-2">
              <button
                type="button"
                onClick={scrollToTop}
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/90 text-white/70 shadow-lg transition hover:border-bordin-orange/40 hover:text-bordin-orange"
                aria-label="رفتن به ابتدای چت"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={scrollToBottom}
                className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-black/90 text-white/70 shadow-lg transition hover:border-bordin-orange/40 hover:text-bordin-orange"
                aria-label="رفتن به آخرین پیام"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
            <ChatComposer
              roomSlug={slug}
              disabled={!room.canPost}
              disabledReason={room.lockedReasonFa}
              loading={sending}
              replyTo={replyTo}
              editingMessage={editingMessage}
              onCancelReply={() => setReplyTo(null)}
              onCancelEdit={() => setEditingMessage(null)}
              onSend={send}
              onEdit={editMessage}
              showDuelShortcut={isTodayRoom}
              onDuelShortcut={scrollToTop}
            />
          </div>
        </>
      )}

      {profileSlug ? (
        <ChatProfilePreviewModal
          slug={profileSlug}
          onClose={() => {
            setProfileSlug(null);
            requestAnimationFrame(() => {
              restoreChatRoomScroll(slug, scrollRef.current);
            });
          }}
        />
      ) : null}

      <ChatDisplayNameRequiredModal open={nameModalOpen} onClose={() => setNameModalOpen(false)} />
    </div>
  );
}
