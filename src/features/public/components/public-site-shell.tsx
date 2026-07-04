import { PublicFooter } from "@/features/public/components/public-footer";
import { PublicHeader } from "@/features/public/components/public-header";

export function PublicSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
