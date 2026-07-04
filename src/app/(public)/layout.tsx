import { PublicSiteShell } from "@/features/public/components/public-site-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}
