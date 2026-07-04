import Link from "next/link";
import { Home, Search } from "lucide-react";
import { BordinLogo } from "@/shared/components/bordin-logo";
import { Button } from "@/shared/components/ui/button";
import { PUBLIC_NAV_LINKS } from "@/features/public/data/site-config";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-black text-white">
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,161,0,0.1)_0%,_transparent_55%)]" />
        <div className="relative max-w-lg">
          <BordinLogo size={72} className="mx-auto rounded-2xl" />
          <p className="mt-8 text-7xl font-bold text-bordin-orange">۴۰۴</p>
          <h1 className="mt-4 text-2xl font-bold">صفحه پیدا نشد</h1>
          <p className="mt-4 text-sm leading-7 text-white/60">
            صفحه‌ای که دنبال آن هستید وجود ندارد، جابه‌جا شده یا آدرس آن اشتباه است.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/">
              <Button>
                <Home className="h-4 w-4" />
                بازگشت به خانه
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">ورود به حساب</Button>
            </Link>
          </div>

          <div className="mt-12 rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-right">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <Search className="h-4 w-4 text-bordin-orange" />
              صفحات پرکاربرد
            </div>
            <ul className="space-y-2">
              {PUBLIC_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-white/60 hover:text-bordin-orange">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/privacy" className="text-sm text-white/60 hover:text-bordin-orange">
                  حریم خصوصی
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-white/60 hover:text-bordin-orange">
                  قوانین و مقررات
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
