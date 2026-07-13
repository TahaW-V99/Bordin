"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatTehranDateTime } from "@/shared/lib/dates";
import type { WatchPartyRoomDto } from "@/server/services/watch-party-service";

export function AdminWatchPartyPanel() {
  const [rooms, setRooms] = useState<WatchPartyRoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/watch-party")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "خطا");
        return data;
      })
      .then((data) => setRooms(data.rooms ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "خطا"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Watch Party</h3>
          <p className="mt-1 text-xs text-white/45">اتاق‌های تماشای گروهی کنداکتور</p>
        </div>
        <Link href="/admin/watch-party/create">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            ایجاد اتاق
          </Button>
        </Link>
      </div>

      {loading ? <Skeleton className="h-24" /> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!loading && !error && rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">
          هنوز اتاقی منتشر نشده است.
        </div>
      ) : null}

      <div className="space-y-2">
        {rooms.map((room) => (
          <div
            key={room.id}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-right"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-white">
                  {room.match.homeTeamName} - {room.match.awayTeamName}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {room.match.leagueName ?? "سایر"} · {formatTehranDateTime(room.match.kickoffAt)}
                </p>
              </div>
              <span
                className={
                  room.isPublished
                    ? "rounded-full bg-bordin-green/15 px-2 py-0.5 text-[10px] text-bordin-green"
                    : "rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/45"
                }
              >
                {room.isPublished ? "منتشر شده" : "پیش‌نویس"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/55">
              <span>ظرفیت: {room.capacity}</span>
              <span>هزینه: {room.entryFeeCoins} سکه</span>
              <span>حاضر: {room.occupiedCount}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
