"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";

export function DisplayNameRequiredModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bordin-orange/15 text-bordin-orange">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-white">تعیین نام لازم است</h3>
        <p className="mb-6 text-sm leading-7 text-white/60">
          شما اسم خود را تعیین نکرده‌اید. لطفاً روی دکمه زیر کلیک کنید و اسم خود را مشخص کنید.
        </p>
        <Link href="/profile/settings" className="w-full" onClick={onClose}>
          <Button fullWidth>تعیین نام</Button>
        </Link>
      </div>
    </Modal>
  );
}
