"use client";

import Link from "next/link";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";

export function LeaderboardDisplayNameModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <h3 className="mb-3 text-lg font-bold text-white">نام نمایشی لازم است</h3>
        <p className="mb-6 text-sm leading-7 text-white/60">
          برای نمایش جایگاه شما در لیدر بُرد، میبایست نام خود را وارد کنید.
        </p>
        <div className="flex w-full flex-col gap-2">
          <Link href="/profile/settings" className="w-full" onClick={onClose}>
            <Button fullWidth>تغییر نام</Button>
          </Link>
          <Button fullWidth variant="secondary" onClick={onClose}>
            انصراف
          </Button>
        </div>
      </div>
    </Modal>
  );
}
