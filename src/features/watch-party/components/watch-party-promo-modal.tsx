"use client";

import Image from "next/image";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { WATCH_PARTY_PROMO_DISMISS_KEY } from "@/shared/constants/watch-party";

export function WatchPartyPromoModal({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const handleDismiss = () => {
    try {
      localStorage.setItem(WATCH_PARTY_PROMO_DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    onDismiss();
  };

  return (
    <Modal open={open} onClose={handleDismiss} className="max-w-none border-0 bg-transparent p-0 shadow-none">
      <div
        className="mx-auto flex w-[354px] flex-col items-center rounded-2xl border border-white/10 bg-[#121212] p-4 shadow-2xl"
        style={{ minHeight: 580 }}
      >
        <div className="relative h-[480px] w-[300px] overflow-hidden rounded-xl">
          <Image
            src="/images/watch-party-promo.png"
            alt="ویژگی جدید تماشای گروهی"
            fill
            className="object-contain"
            sizes="300px"
            priority
          />
        </div>
        <Button fullWidth className="mt-4" onClick={handleDismiss}>
          متوجه شدم
        </Button>
      </div>
    </Modal>
  );
}

export function isWatchPartyPromoDismissed() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(WATCH_PARTY_PROMO_DISMISS_KEY) === "1";
  } catch {
    return true;
  }
}
