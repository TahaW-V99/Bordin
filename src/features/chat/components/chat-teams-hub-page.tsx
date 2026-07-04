"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Users } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { AppBackButton } from "@/shared/components/navigation/app-back-button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { ChatTeamRoomListItemDto } from "@/shared/types/chat";
import { useEffect, useState } from "react";

function TeamRoomCard({ room }: { room: ChatTeamRoomListItemDto }) {
  return (
    <Link href={room.href} className="block">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-bordin-orange/35 hover:bg-bordin-orange/5">
        {room.logoUrl ? (
          <Image
            src={room.logoUrl}
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-2xl object-contain"
            unoptimized
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-bordin-orange/15 text-bordin-orange">
            <Users className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-start">
          <div className="flex items-center justify-start gap-2">
            <p className="font-bold text-white">{room.titleFa}</p>
            {room.unreadCount > 0 ? (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {formatPersianNumber(room.unreadCount)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-start text-xs leading-6 text-white/50">{room.descriptionFa}</p>
        </div>
        <ChevronLeft className="h-5 w-5 shrink-0 text-white/30" />
      </div>
    </Link>
  );
}

export function ChatTeamsHubPage() {
  const [rooms, setRooms] = useState<ChatTeamRoomListItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/chat/teams", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setRooms(data.rooms ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="تیم‌ها"
        subtitle="انتخاب چت روم تیمی"
        startAction={<AppBackButton fallbackHref="/chat" ariaLabel="بازگشت به چت‌ها" />}
      />
      <div className={cn("space-y-3 px-4 py-4 pb-24")}>
        {loading ? (
          <>
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </>
        ) : rooms.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/50">
            برای دسترسی به چت تیم‌ها باید عضو یک تیم باشید.
          </p>
        ) : (
          rooms.map((room) => <TeamRoomCard key={room.slug} room={room} />)
        )}
      </div>
    </>
  );
}
