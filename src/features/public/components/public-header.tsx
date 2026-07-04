"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BordinLogo } from "@/shared/components/bordin-logo";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";
import { PUBLIC_NAV_LINKS, PUBLIC_SITE } from "@/features/public/data/site-config";

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label={`${PUBLIC_SITE.name} — صفحه اصلی`}>
          <BordinLogo size={40} className="rounded-xl" />
          <span className="hidden text-lg font-bold text-white sm:inline">{PUBLIC_SITE.name}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="ناوبری اصلی">
          {PUBLIC_NAV_LINKS.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-bordin-orange" : "text-white/70 hover:text-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login">
            <Button size="sm">ورود / ثبت‌نام</Button>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white md:hidden"
          aria-expanded={menuOpen}
          aria-controls="public-mobile-nav"
          aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen ? (
        <nav
          id="public-mobile-nav"
          className="border-t border-white/8 px-4 py-4 md:hidden"
          aria-label="ناوبری موبایل"
        >
          <div className="flex flex-col gap-1">
            {PUBLIC_NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-3 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            <Link href="/login" className="mt-2">
              <Button fullWidth>ورود / ثبت‌نام</Button>
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
