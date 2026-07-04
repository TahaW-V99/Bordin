"use client";

import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { formatPersianNumber } from "@/shared/lib/dates";

export function WheelSpinCostModal({
  open,
  calculatedCost,
  totalCoins,
  canApply,
  onConfirm,
  onClose,
}: {
  open: boolean;
  calculatedCost: number;
  totalCoins: number;
  canApply: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center">
        <h3 className="mb-2 text-lg font-bold text-white">هزینه چرخش</h3>
        <p className="mb-4 text-sm leading-7 text-white/60">
          هزینه این چرخش{" "}
          <span className="font-bold text-bordin-orange">
            {formatPersianNumber(calculatedCost)}
          </span>{" "}
          سکه از موجودی شما کسر می‌شود.
        </p>
        {!canApply ? (
          <p className="mb-4 rounded-xl bg-white/5 px-3 py-2 text-xs leading-6 text-white/50">
            {totalCoins <= 0
              ? "موجودی سکه شما صفر است؛ چرخش بدون هزینه انجام می‌شود."
              : totalCoins <= calculatedCost
                ? "با کسر این هزینه مجموع سکه‌های شما صفر می‌شد؛ چرخش بدون هزینه انجام می‌شود."
                : "موجودی سکه برای کسر این هزینه کافی نیست؛ چرخش بدون هزینه انجام می‌شود."}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button fullWidth onClick={onConfirm}>
            چرخش
          </Button>
          <Button fullWidth variant="secondary" onClick={onClose}>
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
}
