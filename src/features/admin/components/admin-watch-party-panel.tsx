"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { formatTehranDateTime } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import type { WatchPartyRoomDto } from "@/server/services/watch-party-service";

type EditForm = {
  googleMeetUrl: string;
  capacity: string;
  entryFeeCoins: string;
};

export function AdminWatchPartyPanel() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<WatchPartyRoomDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editRoom, setEditRoom] = useState<WatchPartyRoomDto | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<WatchPartyRoomDto | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    googleMeetUrl: "",
    capacity: "",
    entryFeeCoins: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/watch-party");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      setRooms(data.rooms ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const openEdit = (room: WatchPartyRoomDto) => {
    setEditRoom(room);
    setEditForm({
      googleMeetUrl: room.googleMeetUrl,
      capacity: String(room.capacity),
      entryFeeCoins: String(room.entryFeeCoins),
    });
  };

  const saveEdit = async () => {
    if (!editRoom) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/watch-party/${editRoom.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleMeetUrl: editForm.googleMeetUrl.trim(),
          capacity: Number(editForm.capacity),
          entryFeeCoins: Number(editForm.entryFeeCoins),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      setRooms((prev) => prev.map((room) => (room.id === editRoom.id ? data.room : room)));
      setEditRoom(null);
      toast("اتاق ویرایش شد", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "خطا", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRoom) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/watch-party/${deleteRoom.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      setRooms((prev) => prev.filter((room) => room.id !== deleteRoom.id));
      setDeleteRoom(null);
      toast("اتاق حذف شد", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "خطا", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleForceActive = async (room: WatchPartyRoomDto) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/watch-party/${room.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buttonForceActive: !room.buttonForceActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      setRooms((prev) => prev.map((item) => (item.id === room.id ? data.room : item)));
      toast(
        data.room.buttonForceActive ? "دکمه تماشای گروهی فعال شد" : "حالت پیش‌فرض (۳۰ دقیقه قبل) فعال شد",
        "success",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "خطا", "error");
    } finally {
      setSubmitting(false);
    }
  };

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

            {room.isPublished ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/55">فعال/غیرفعال</span>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void toggleForceActive(room)}
                    className={cn(
                      "relative h-7 w-14 rounded-full border transition-colors",
                      room.buttonForceActive
                        ? "border-bordin-green/40 bg-bordin-green/20"
                        : "border-white/15 bg-white/5",
                    )}
                    aria-label={room.buttonForceActive ? "فعال" : "غیرفعال"}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                        room.buttonForceActive ? "right-1" : "right-8",
                      )}
                    />
                  </button>
                  <span className="text-[10px] text-white/45">
                    {room.buttonForceActive ? "فعال (بدون انتظار ۳۰ دقیقه)" : "غیرفعال (پیش‌فرض)"}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(room)}>
                    <Pencil className="h-3.5 w-3.5" />
                    ویرایش
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setDeleteRoom(room)}>
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <Modal open={Boolean(editRoom)} onClose={() => setEditRoom(null)} className="max-w-md">
        {editRoom ? (
          <div className="space-y-4 text-right">
            <h4 className="font-bold">ویرایش اتاق</h4>
            <p className="text-xs text-white/45">
              {editRoom.match.homeTeamName} - {editRoom.match.awayTeamName}
            </p>
            <label className="block space-y-1 text-sm">
              <span className="text-white/60">لینک گوگل میت</span>
              <input
                value={editForm.googleMeetUrl}
                onChange={(e) => setEditForm((prev) => ({ ...prev, googleMeetUrl: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-white/60">ظرفیت</span>
              <input
                type="number"
                min={1}
                max={500}
                value={editForm.capacity}
                onChange={(e) => setEditForm((prev) => ({ ...prev, capacity: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-white/60">هزینه ورود (سکه)</span>
              <input
                type="number"
                min={0}
                value={editForm.entryFeeCoins}
                onChange={(e) => setEditForm((prev) => ({ ...prev, entryFeeCoins: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <Button className="flex-1" loading={submitting} onClick={() => void saveEdit()}>
                ذخیره
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => setEditRoom(null)}>
                انصراف
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(deleteRoom)} onClose={() => setDeleteRoom(null)} className="max-w-md">
        {deleteRoom ? (
          <div className="space-y-4 text-right">
            <h4 className="font-bold">حذف اتاق</h4>
            <p className="text-sm leading-7 text-white/70">
              آیا از حذف اتاق تماشای گروهی برای مسابقه{" "}
              <span className="font-semibold text-white">
                {deleteRoom.match.homeTeamName} - {deleteRoom.match.awayTeamName}
              </span>{" "}
              مطمئن هستید؟
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" loading={submitting} onClick={() => void confirmDelete()}>
                حذف
              </Button>
              <Button className="flex-1" variant="secondary" onClick={() => setDeleteRoom(null)}>
                انصراف
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
