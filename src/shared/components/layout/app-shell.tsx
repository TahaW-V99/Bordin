"use client";

import { useEffect } from "react";
import { BottomNav } from "./bottom-nav";
import { ScrollRestore } from "./scroll-restore";
import { TeamInvitePushBanner } from "@/features/teams/components/team-invite-push-banner";
import { WatchPartyInvitePushBanner } from "@/features/watch-party/components/watch-party-invite-push-banner";
import { EnergyDepletedHost } from "@/shared/components/energy/energy-depleted-modal";

export function AppShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const ping = () => {
      void fetch("/api/user/presence", { method: "POST" }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-dvh bg-black text-white">
      <ScrollRestore />
      <TeamInvitePushBanner />
      <WatchPartyInvitePushBanner />
      <EnergyDepletedHost />
      <main className="mx-auto min-h-dvh max-w-lg pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
