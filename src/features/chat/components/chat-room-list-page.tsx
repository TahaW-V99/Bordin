"use client";

import Link from "next/link";
import { ChevronLeft, Lock, MessageCircle, MessageSquare, Target, Trophy, Users } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { AppBackButton } from "@/shared/components/navigation/app-back-button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { ChatRoomListItemDto } from "@/shared/types/chat";

const ICONS = {
  public: MessageCircle,
  predictions: Target,
  teams: Users,
  competitions: Trophy,
} as const;

function RoomCard({ room }: { room: ChatRoomListItemDto }) {
  const Icon = ICONS[room.icon];
  const href = room.href ?? `/chat/${room.slug}`;
  const unread = room.unreadCount ?? 0;

  const content = (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4 transition",
        room.canAccess
          ? "border-white/10 bg-white/[0.03] hover:border-bordin-orange/35 hover:bg-bordin-orange/5"
          : "border-white/8 bg-white/[0.02] opacity-75",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
          room.canAccess ? "bg-bordin-orange/15 text-bordin-orange" : "bg-white/5 text-white/35",
        )}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-start gap-2">
          <p className="font-bold text-white">{room.titleFa}</p>
          {!room.canAccess ? <Lock className="h-4 w-4 text-white/40" /> : null}
          {room.canAccess && unread > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
              <MessageSquare className="h-3 w-3" />
              {formatPersianNumber(unread)}
            </span>
          ) : room.canAccess ? (
            <MessageSquare className="h-3.5 w-3.5 text-white/25" aria-hidden />
          ) : null}
        </div>
        <p className="mt-1 text-start text-xs leading-6 text-white/50">{room.descriptionFa}</p>
        {!room.canAccess && room.lockedReasonFa ? (
          <p className="mt-2 text-start text-xs text-bordin-orange/90">{room.lockedReasonFa}</p>
        ) : null}
      </div>
      {room.canAccess ? <ChevronLeft className="h-5 w-5 shrink-0 text-white/30" /> : null}
    </div>
  );

  if (!room.canAccess) return <div>{content}</div>;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

export function ChatRoomListPage({ rooms, loading }: { rooms: ChatRoomListItemDto[]; loading: boolean }) {
  return (
    <>
      <PageHeader
        title="چت بُردین"
        subtitle="اتاق گفتگو را انتخاب کنید"
        startAction={<AppBackButton fallbackHref="/home" ariaLabel="بازگشت به خانه" />}
      />
      <div className="space-y-3 px-4 py-4 pb-24">
        {loading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : (
          rooms.map((room) => <RoomCard key={room.slug} room={room} />)
        )}
      </div>
    </>
  );
}
