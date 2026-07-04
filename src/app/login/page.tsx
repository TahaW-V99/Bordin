import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/features/auth/components/login-form";
import { BordinLogo } from "@/shared/components/bordin-logo";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-black">
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-6 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,161,0,0.12)_0%,_transparent_55%)]" />

        <div className="relative mx-auto w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <BordinLogo size={72} className="mb-5 rounded-2xl" />
            <h1 className="text-3xl font-bold tracking-tight text-white">بُردین</h1>
            <p className="mt-2 text-sm font-normal text-white/50">
              پیش‌بینی کن، جایگاهت را بساز
            </p>
          </div>

          <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-6 backdrop-blur-sm">
            <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>

      <footer className="border-t border-white/8 px-6 py-4 text-center text-xs text-white/40">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/" className="hover:text-white/70">
            صفحه اصلی
          </Link>
          <Link href="/privacy" className="hover:text-white/70">
            حریم خصوصی
          </Link>
          <Link href="/terms" className="hover:text-white/70">
            قوانین
          </Link>
          <Link href="/contact" className="hover:text-white/70">
            تماس با ما
          </Link>
        </div>
      </footer>
    </div>
  );
}