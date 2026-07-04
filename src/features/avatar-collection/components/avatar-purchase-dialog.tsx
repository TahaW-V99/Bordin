"use client";

import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { AVATAR_PURCHASE_COST } from "@/shared/constants/settings";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";

type AvatarPurchaseDialogProps = {
  open: boolean;
  avatarSrc: string;
  avatarLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AvatarPurchaseDialog({
  open,
  avatarSrc,
  avatarLabel,
  loading,
  onConfirm,
  onCancel,
}: AvatarPurchaseDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <Modal
        open={open}
        onClose={onCancel}
        className={cn(
          "flex max-w-none flex-col items-center border-bordin-orange/35 bg-[#0d0d0d] p-5 shadow-[0_0_40px_rgba(255,122,0,0.18)]",
          "h-[309px] w-[326px] overflow-hidden",
        )}
      >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-bordin-orange/30",
          "h-[178px] w-[200px] shadow-[0_0_24px_rgba(255,122,0,0.2)]",
        )}
      >
        <img
          src={avatarSrc}
          alt={avatarLabel}
          className="h-full w-full object-cover"
        />
      </div>

      <p className="mt-4 text-center text-sm leading-6 text-white/85">
        آیا از خرید این تصویر پروفایل مطمئن هستید؟
      </p>

      <div className="mt-auto flex w-full gap-2 pt-4">
        <Button
          fullWidth
          size="sm"
          loading={loading}
          onClick={onConfirm}
          className="active:scale-[0.97]"
        >
          بله — {formatPersianNumber(AVATAR_PURCHASE_COST)} سکه
        </Button>
        <Button
          fullWidth
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={onCancel}
          className="active:scale-[0.97]"
        >
          انصراف
        </Button>
      </div>
    </Modal>
    </div>
  );
}
