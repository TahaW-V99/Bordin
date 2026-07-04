"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import type { ChatShareTargetDto } from "@/shared/types/chat";

export function ChatShareRoomModal({
  rooms,
  predictionId,
  onClose,
  onShared,
}: {
  rooms: ChatShareTargetDto[];
  predictionId: string;
  onClose: () => void;
  onShared: (roomSlug: string) => void;
}) {
  const { toast } = useToast();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const share = async (slug: string) => {
    setLoadingSlug(slug);
    try {
      const res = await fetch("/api/chat/share-prediction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictionId, roomSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "اشتراک‌گذاری ناموفق بود");
      toast("نتیجه در چت منتشر شد ⚽", "success");
      onShared(slug);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoadingSlug(null);
    }
  };

  const postable = rooms.filter((r) => r.canAccess && r.canPost);
  const generalRooms = postable.filter((room) => room.group === "general");
  const teamRooms = postable.filter((room) => room.group === "team");

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="بستن" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-4 sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">اشتراک در چت</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-4 text-xs leading-6 text-white/50">
          اتاقی را انتخاب کنید تا کارت نتیجه پیش‌بینی‌تان منتشر شود.
        </p>
        <div className="space-y-4">
          {generalRooms.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/45">چت‌های عمومی</p>
              {generalRooms.map((room) => (
                <Button
                  key={room.slug}
                  variant="outline"
                  className="h-auto w-full justify-between py-3"
                  loading={loadingSlug === room.slug}
                  onClick={() => void share(room.slug)}
                >
                  <span>{room.titleFa}</span>
                  <span className="text-xs text-white/40">{room.descriptionFa}</span>
                </Button>
              ))}
            </div>
          ) : null}
          {teamRooms.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-white/45">چت‌های تیمی</p>
              {teamRooms.map((room) => (
                <Button
                  key={room.slug}
                  variant="outline"
                  className="h-auto w-full justify-between py-3"
                  loading={loadingSlug === room.slug}
                  onClick={() => void share(room.slug)}
                >
                  <span>{room.titleFa}</span>
                  <span className="text-xs text-white/40">{room.descriptionFa}</span>
                </Button>
              ))}
            </div>
          ) : null}
          {postable.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/45">اتاق قابل ارسالی در دسترس نیست.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
