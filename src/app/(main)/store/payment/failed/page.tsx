"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StorePaymentFailedPage() {
  const router = useRouter();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      router.replace("/store?tab=buy");
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [router]);

  return (
    <div className="space-y-3 px-4 py-10 text-center">
      <h1 className="text-xl font-bold text-red-400">تراکنش ناموفق</h1>
      <p className="text-sm text-white/70">
        پرداخت انجام نشد. اگر مبلغی از حساب شما کسر شده، طی چند دقیقه برگشت داده می‌شود.
      </p>
      <p className="text-xs text-white/45">تا ۶ ثانیه دیگر به فروشگاه منتقل می‌شوید...</p>
    </div>
  );
}
