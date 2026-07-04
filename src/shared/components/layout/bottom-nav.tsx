"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, Home, Trophy, Medal, ShoppingBag, User, Sparkles, MessagesSquare } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { CHAT_UNREAD_UPDATED_EVENT } from "@/shared/constants/chat";

const items = [
  { href: "/home", label: "خانه", icon: Home },
  { href: "/competitions", label: "مسابقات", icon: Trophy },
  { href: "/leaderboard", label: "لیدر بُرد", icon: Medal },
  { href: "/chat", label: "چت", icon: MessagesSquare, showUnreadBell: true },
  { href: "/wheel", label: "گردونه", icon: Sparkles },
  { href: "/store", label: "فروشگاه", icon: ShoppingBag },
  { href: "/profile", label: "پروفایل", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  const [chatUnread, setChatUnread] = useState(0);

  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/unread", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setChatUnread(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshUnread();
    const onUpdate = () => void refreshUnread();
    window.addEventListener(CHAT_UNREAD_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);
    const intervalId = window.setInterval(() => void refreshUnread(), 15000);
    return () => {
      window.removeEventListener(CHAT_UNREAD_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
      window.clearInterval(intervalId);
    };
  }, [refreshUnread, pathname]);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-white/8 bg-black/95 backdrop-blur-lg safe-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 py-2">
        {items.map(({ href, label, icon: Icon, showUnreadBell }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 text-[10px] font-medium transition",
                active ? "text-bordin-orange" : "text-white/45 hover:text-white/70",
              )}
            >
              <span className="relative inline-flex">
                <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(255,161,0,0.6)]")} />
                {showUnreadBell && chatUnread > 0 ? (
                  <Bell
                    className="pointer-events-none absolute -left-2 -top-1.5 h-3 w-3 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.9)] animate-chat-bell-shake"
                    aria-hidden
                  />
                ) : null}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
