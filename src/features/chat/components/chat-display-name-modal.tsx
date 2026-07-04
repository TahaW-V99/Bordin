"use client";

import Link from "next/link";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { CHAT_DISPLAY_NAME_REQUIRED_FA } from "@/shared/constants/chat";

export function ChatDisplayNameRequiredModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-3 text-lg font-bold text-white">الزام به ثبت اسم</h3>
      <p className="text-sm leading-8 text-white/75">{CHAT_DISPLAY_NAME_REQUIRED_FA}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" fullWidth onClick={onClose}>
          انصراف
        </Button>
        <Link href="/profile/settings" className="min-w-0 sm:flex-1" onClick={onClose}>
          <Button fullWidth size="sm" className="px-3">
            ثبت اسم
          </Button>
        </Link>
      </div>
    </Modal>
  );
}
