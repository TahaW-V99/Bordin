"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { useAssetPayment } from "@/shared/hooks/use-asset-payment";
import { AvatarPurchaseDialog } from "@/features/avatar-collection/components/avatar-purchase-dialog";
import {
  AVATAR_PURCHASE_COST,
  PROFILE_AVATARS,
  type AvatarOption,
} from "@/shared/constants/settings";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";

type AvatarCollectionModalProps = {
  open: boolean;
  onClose: () => void;
  currentAvatarId: string | null;
  totalCoins: number;
  unlockedAvatarIds: string[];
  onAvatarUpdated: (payload: {
    avatarUrl: string;
    avatarSrc: string;
    totalCoins: number;
    unlockedAvatarIds: string[];
  }) => void;
};

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "خطا در ارتباط با سرور");
  return data as T;
}

function AvatarSlideItem({
  avatar,
  selected,
  locked,
  onSelect,
}: {
  avatar: AvatarOption;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border-2 transition-all duration-300",
        "h-[155px] w-[161px]",
        selected
          ? "scale-[1.04] border-bordin-orange shadow-[0_0_28px_rgba(255,122,0,0.45)]"
          : "border-white/10 hover:border-bordin-orange/40",
        avatar.premium && !locked && "shadow-[0_0_18px_rgba(255,122,0,0.2)]",
        avatar.premium && !locked && !selected && "hover:shadow-[0_0_24px_rgba(255,122,0,0.35)]",
      )}
      aria-label={avatar.label}
      title={avatar.label}
    >
      <img src={avatar.src} alt={avatar.label} className="h-full w-full object-cover" />

      {avatar.premium ? (
        <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-bordin-orange/40 bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-bordin-orange">
          <Sparkles className="h-3 w-3" />
          پریمیوم
        </span>
      ) : null}

      {locked ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 backdrop-blur-[1px]">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white/80">
            <Lock className="h-4 w-4" />
          </span>
          <span className="text-[10px] font-medium text-white/70">قابل جمع‌آوری</span>
        </span>
      ) : null}
    </button>
  );
}

export function AvatarCollectionModal({
  open,
  onClose,
  currentAvatarId,
  totalCoins,
  unlockedAvatarIds,
  onAvatarUpdated,
}: AvatarCollectionModalProps) {
  const { toast } = useToast();
  const { runWithAssetPayment } = useAssetPayment();
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slideKey, setSlideKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);

  const pageCount = Math.ceil(PROFILE_AVATARS.length / 2);
  const visibleAvatars = useMemo(
    () => PROFILE_AVATARS.slice(page * 2, page * 2 + 2),
    [page],
  );

  const selectedAvatar = selectedId
    ? PROFILE_AVATARS.find((avatar) => avatar.id === selectedId) ?? null
    : null;

  const isUnlocked = useCallback(
    (avatarId: string) => {
      const avatar = PROFILE_AVATARS.find((item) => item.id === avatarId);
      if (!avatar?.premium) return true;
      return unlockedAvatarIds.includes(avatarId);
    },
    [unlockedAvatarIds],
  );

  const needsPurchase =
    Boolean(selectedAvatar?.premium) && selectedId && !isUnlocked(selectedId);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setPurchaseOpen(false);
      return;
    }

    const currentIndex = PROFILE_AVATARS.findIndex((avatar) => avatar.id === currentAvatarId);
    const initialPage = currentIndex >= 0 ? Math.floor(currentIndex / 2) : 0;
    setPage(initialPage);
    setSlideKey((value) => value + 1);
  }, [open, currentAvatarId]);

  const goPrev = () => {
    setPage((value) => {
      const next = Math.max(0, value - 1);
      if (next !== value) setSlideKey((key) => key + 1);
      return next;
    });
  };

  const goNext = () => {
    setPage((value) => {
      const next = Math.min(pageCount - 1, value + 1);
      if (next !== value) setSlideKey((key) => key + 1);
      return next;
    });
  };

  const handleSelectFree = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const result = await patchJson<{ avatarUrl: string; avatarSrc: string }>(
        "/api/settings/avatar",
        { avatarId: selectedId },
      );
      onAvatarUpdated({
        avatarUrl: result.avatarUrl,
        avatarSrc: result.avatarSrc,
        totalCoins,
        unlockedAvatarIds,
      });
      toast("آواتار با موفقیت انتخاب شد", "success");
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "خطا", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await runWithAssetPayment((allowFootballCredit) =>
        fetch("/api/settings/avatar/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarId: selectedId, allowFootballCredit }),
        }),
      );
      if (!res) { setPurchaseOpen(false); return; }
      const result = (await res.json()) as {
        avatarUrl: string;
        avatarSrc: string;
        coinsDeducted: number;
        unlockedAvatarIds: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(result.error ?? "خطا در ارتباط با سرور");

      onAvatarUpdated({
        avatarUrl: result.avatarUrl,
        avatarSrc: result.avatarSrc,
        totalCoins: totalCoins - (result.coinsDeducted ?? AVATAR_PURCHASE_COST),
        unlockedAvatarIds: result.unlockedAvatarIds ?? [...unlockedAvatarIds, selectedId],
      });
      toast("آواتار با موفقیت خریداری و انتخاب شد", "success");
      setPurchaseOpen(false);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "خطا", "error");
    } finally {
      setSaving(false);
    }
  };

  const primaryLabel = needsPurchase
    ? `انتخاب • ${formatPersianNumber(AVATAR_PURCHASE_COST)} سکه`
    : "انتخاب";

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        className={cn(
          "flex max-w-none flex-col border-bordin-orange/35 bg-[#0d0d0d] p-0 shadow-[0_0_48px_rgba(255,122,0,0.2)]",
          "h-[347px] w-[374px] overflow-hidden rounded-3xl",
          "animate-[fadeInScale_0.28s_ease-out]",
        )}
      >
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-center text-sm font-bold text-bordin-orange">مجموعه آواتار</h2>
          <p className="mt-1 text-center text-[11px] text-white/45">
            هویت فوتبالی خود را انتخاب کنید
          </p>
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
          <div
            key={slideKey}
            className="mx-auto flex items-center justify-center gap-3 transition-all duration-300 animate-[slideIn_0.32s_ease-out]"
          >
            {visibleAvatars.map((avatar) => (
              <AvatarSlideItem
                key={avatar.id}
                avatar={avatar}
                selected={selectedId === avatar.id}
                locked={avatar.premium && !isUnlocked(avatar.id)}
                onSelect={() => setSelectedId(avatar.id)}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between px-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={page === 0}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70 transition",
                "hover:border-bordin-orange/40 hover:text-bordin-orange active:scale-95",
                "disabled:opacity-30 disabled:pointer-events-none",
              )}
              aria-label="قبلی"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <span className="text-[11px] text-white/40">
              {formatPersianNumber(page + 1)} / {formatPersianNumber(pageCount)}
            </span>

            <button
              type="button"
              onClick={goNext}
              disabled={page >= pageCount - 1}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70 transition",
                "hover:border-bordin-orange/40 hover:text-bordin-orange active:scale-95",
                "disabled:opacity-30 disabled:pointer-events-none",
              )}
              aria-label="بعدی"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-auto flex gap-2 pt-3">
            <Button
              fullWidth
              size="sm"
              disabled={!selectedId}
              loading={saving && !purchaseOpen}
              onClick={() => {
                if (needsPurchase) {
                  setPurchaseOpen(true);
                  return;
                }
                void handleSelectFree();
              }}
              className="active:scale-[0.97]"
            >
              {primaryLabel}
            </Button>
            <Button
              fullWidth
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={onClose}
              className="active:scale-[0.97]"
            >
              انصراف
            </Button>
          </div>
        </div>
      </Modal>

      {selectedAvatar ? (
        <AvatarPurchaseDialog
          open={purchaseOpen}
          avatarSrc={selectedAvatar.src}
          avatarLabel={selectedAvatar.label}
          loading={saving}
          onConfirm={() => void handleConfirmPurchase()}
          onCancel={() => setPurchaseOpen(false)}
        />
      ) : null}
    </>
  );
}
