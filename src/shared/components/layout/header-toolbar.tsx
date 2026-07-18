"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, Wallet } from "lucide-react";
import { RefereeWhistleIcon } from "@/shared/components/notifications/referee-whistle-icon";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  NOTIFICATIONS_UPDATED_EVENT,
  messagesHrefFromPathname,
  readStoredUnreadCount,
} from "@/shared/constants/notifications";
import { cn } from "@/shared/lib/cn";
import { STORE_SELL_UI_ENABLED } from "@/shared/constants/store";

export function InboxWhistleLink({ className }: { className?: string }) {
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setHasUnread((data.unreadCount ?? 0) > 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const stored = readStoredUnreadCount();
    if (stored !== null) {
      setHasUnread(stored > 0);
    }
    void refresh();
    const onUpdate = (event: Event) => {
      const count = (event as CustomEvent<{ unreadCount?: number }>).detail?.unreadCount;
      if (typeof count === "number") {
        setHasUnread(count > 0);
        return;
      }
      void refresh();
    };
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [pathname, refresh]);

  return (
    <Link
      href={messagesHrefFromPathname(pathname)}
      aria-label="صندوق پیغام‌ها"
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-bordin-orange transition hover:border-bordin-orange/40 hover:bg-bordin-orange/10",
        className,
      )}
    >
      <RefereeWhistleIcon animated={hasUnread} />
      {hasUnread ? (
        <span className="absolute -left-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-bordin-orange ring-2 ring-black" />
      ) : null}
    </Link>
  );
}

export function WalletHeaderLink({ className }: { className?: string }) {
  return (
    <Link
      href="/profile/wallet"
      aria-label="کیف پول"
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange",
        className,
      )}
    >
      <Wallet className="h-5 w-5" />
    </Link>
  );
}

function useTotalCoins() {
  const [totalCoins, setTotalCoins] = useState<number | null>(null);

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/user/me");
      if (!res.ok) return;
      const data = await res.json();
      const wallet = data.user?.wallet;
      if (!wallet) {
        setTotalCoins(0);
        return;
      }
      setTotalCoins(
        (wallet.predictionRewardCoins ?? 0) +
          (wallet.systemRewardCoins ?? 0) +
          (wallet.purchasedCoins ?? 0),
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadWallet();
    window.addEventListener("focus", loadWallet);
    return () => window.removeEventListener("focus", loadWallet);
  }, [loadWallet]);

  return totalCoins;
}

export function CoinsBalanceLink({ className }: { className?: string }) {
  const totalCoins = useTotalCoins();

  return (
    <Link
      href="/store"
      className={cn(
        "flex items-center gap-1.5 rounded-xl bg-white/5 px-3 py-2 text-sm font-medium",
        className,
      )}
      aria-label="موجودی سکه"
    >
      <Coins className="h-4 w-4 text-bordin-orange" />
      {totalCoins === null ? "—" : formatPersianNumber(totalCoins)}
    </Link>
  );
}

export function HeaderToolbar() {
  return (
    <div className="flex items-center gap-2">
      <InboxWhistleLink />
      {STORE_SELL_UI_ENABLED ? <WalletHeaderLink /> : null}
      <CoinsBalanceLink />
    </div>
  );
}
