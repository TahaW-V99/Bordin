"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  WATCH_PARTY_FULL_MESSAGE,
  WATCH_PARTY_INSUFFICIENT_COINS,
  WATCH_PARTY_JOIN_DESCRIPTION,
} from "@/shared/constants/watch-party";
import { WatchPartyInviteModal } from "@/features/watch-party/components/watch-party-invite-modal";
import type { WatchPartyCardState } from "@/features/watch-party/components/watch-party-button";

type WatchPartyJoinModalProps = {
  open: boolean;
  onClose: () => void;
  watchParty: WatchPartyCardState;
  matchLabel: string;
  onJoined: (googleMeetUrl: string) => void;
  onRefresh: () => void;
};

export function WatchPartyJoinModal({
  open,
  onClose,
  watchParty,
  matchLabel,
  onJoined,
  onRefresh,
}: WatchPartyJoinModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [occupiedCount, setOccupiedCount] = useState(watchParty.occupiedCount);

  useEffect(() => {
    setOccupiedCount(watchParty.occupiedCount);
  }, [watchParty.occupiedCount]);

  const isFull = occupiedCount >= watchParty.capacity;
  const remaining = Math.max(0, watchParty.capacity - occupiedCount);

  const refreshStatus = useCallback(async () => {
    const res = await fetch(`/api/watch-party/status?matchId=${watchParty.matchId}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = await res.json();
    if (data.status?.occupiedCount != null) {
      setOccupiedCount(data.status.occupiedCount);
    }
  }, [watchParty.matchId]);

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
    const id = setInterval(() => void refreshStatus(), 15_000);
    return () => clearInterval(id);
  }, [open, refreshStatus]);

  const join = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/watch-party/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: watchParty.roomId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error?.includes("کافی نیست")) {
          onClose();
          toast(WATCH_PARTY_INSUFFICIENT_COINS, "error");
          return;
        }
        throw new Error(data.error ?? "خطا");
      }
      onJoined(data.googleMeetUrl);
      window.location.href = data.googleMeetUrl;
    } catch (error) {
      toast(error instanceof Error ? error.message : "خطا", "error");
    } finally {
      setLoading(false);
    }
  };

  const inviteCapacity = useMemo(() => remaining, [remaining]);

  return (
    <>
      <Modal open={open} onClose={onClose} className="max-w-md">
        <div className="space-y-4 text-right">
          <h2 className="text-lg font-bold text-white">تماشای گروهی</h2>
          <p className="text-xs text-white/45">{matchLabel}</p>

          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <Users className="h-5 w-5 text-bordin-orange" />
            <span className="text-sm font-semibold tabular-nums text-white">
              {formatPersianNumber(occupiedCount)} / {formatPersianNumber(watchParty.capacity)}
            </span>
          </div>

          {isFull ? (
            <p className="text-center text-sm font-semibold text-red-400">{WATCH_PARTY_FULL_MESSAGE}</p>
          ) : (
            <p className="text-sm leading-7 text-white/70">{WATCH_PARTY_JOIN_DESCRIPTION}</p>
          )}

          <div className="flex flex-col gap-2">
            <Button fullWidth loading={loading} disabled={isFull} onClick={() => void join()}>
              {watchParty.entryFeeCoins > 0
                ? `بزن بریم · ${formatPersianNumber(watchParty.entryFeeCoins)} سکه`
                : "بزن بریم"}
            </Button>
            <Button fullWidth variant="secondary" onClick={onClose}>
              بعدا میام
            </Button>
            <Button
              fullWidth
              variant="secondary"
              disabled={isFull || inviteCapacity === 0}
              onClick={() => setInviteOpen(true)}
            >
              دعوت از دوستان
            </Button>
          </div>
        </div>
      </Modal>

      <WatchPartyInviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        roomId={watchParty.roomId}
        maxSelectable={inviteCapacity}
        onSent={() => {
          setInviteOpen(false);
          void refreshStatus();
          onRefresh();
        }}
      />
    </>
  );
}
