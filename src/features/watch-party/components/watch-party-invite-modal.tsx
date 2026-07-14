"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/toast";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import { WATCH_PARTY_INVITE_CAPACITY_ERROR } from "@/shared/constants/watch-party";

type InviteUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
};

export function WatchPartyInviteModal({
  open,
  onClose,
  roomId,
  maxSelectable,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  maxSelectable: number;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<InviteUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [capacityError, setCapacityError] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`/api/watch-party/users${params}`, { cache: "no-store" });
      const data = await res.json();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setQuery("");
    setCapacityError(false);
    void load("");
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => void load(query), 300);
    return () => clearTimeout(id);
  }, [query, open, load]);

  const toggle = (userId: string) => {
    setSelected((prev) => {
      if (prev.includes(userId)) {
        setCapacityError(false);
        return prev.filter((id) => id !== userId);
      }
      if (prev.length >= maxSelectable) {
        setCapacityError(true);
        return prev;
      }
      setCapacityError(false);
      return [...prev, userId];
    });
  };

  const send = async () => {
    if (selected.length === 0) {
      toast("حداقل یک کاربر انتخاب کنید", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/watch-party/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, inviteeIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      toast(`دعوت برای ${formatPersianNumber(data.pushSent ?? selected.length)} نفر ارسال شد`, "success");
      onSent();
    } catch (error) {
      toast(error instanceof Error ? error.message : "خطا", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-md">
      <div className="space-y-4 text-right">
        <h2 className="text-lg font-bold">دعوت از دوستان</h2>
        <p className="text-xs text-white/45">
          حداکثر {formatPersianNumber(maxSelectable)} نفر · انتخاب‌شده:{" "}
          {formatPersianNumber(selected.length)}
        </p>

        {capacityError ? (
          <p className="text-center text-sm font-semibold text-red-400">
            {WATCH_PARTY_INVITE_CAPACITY_ERROR}
          </p>
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جستجوی نام کاربر"
            className="pr-10"
          />
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {loading ? (
            <p className="py-6 text-center text-sm text-white/45">در حال بارگذاری...</p>
          ) : users.length === 0 ? (
            <p className="py-6 text-center text-sm text-white/45">کاربری یافت نشد</p>
          ) : (
            users.map((user) => {
              const isSelected = selected.includes(user.id);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggle(user.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-right transition",
                    isSelected
                      ? "border-bordin-orange/50 bg-bordin-orange/10"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/5",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{user.displayName}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          user.isOnline ? "bg-bordin-green" : "bg-red-500",
                        )}
                      />
                      <span className="text-white/45">{user.isOnline ? "آنلاین" : "آفلاین"}</span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "h-4 w-4 rounded border",
                      isSelected ? "border-bordin-orange bg-bordin-orange" : "border-white/25",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>

        <Button fullWidth loading={sending} onClick={() => void send()}>
          خبر بده
        </Button>
      </div>
    </Modal>
  );
}
