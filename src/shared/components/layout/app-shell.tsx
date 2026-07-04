import { BottomNav } from "./bottom-nav";
import { ScrollRestore } from "./scroll-restore";
import { TeamInvitePushBanner } from "@/features/teams/components/team-invite-push-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-black text-white">
      <ScrollRestore />
      <TeamInvitePushBanner />
      <main className="mx-auto min-h-dvh max-w-lg pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
