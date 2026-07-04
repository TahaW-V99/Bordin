"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPersianNumber } from "@/shared/lib/dates";
import { useToast } from "@/shared/components/ui/toast";

export default function StorePaymentSuccessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const coins = Number(params.get("coins") ?? 0);

  useEffect(() => {
    toast(
      coins > 0
        ? `${formatPersianNumber(coins)} سکه با موفقیت به حساب شما اضافه شد.`
        : "پرداخت با موفقیت انجام شد.",
      "success",
    );
    const timeout = window.setTimeout(() => {
      router.replace("/store?tab=buy");
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [coins, router, toast]);

  return (
    <div className="space-y-3 px-4 py-10 text-center">
      <h1 className="text-xl font-bold text-bordin-green">پرداخت موفقیت آمیز بود</h1>
      <p className="text-sm text-white/70">
        {formatPersianNumber(coins)} سکه دریافت کردید.
      </p>
      <p className="text-xs text-white/45">تا ۵ ثانیه دیگر به فروشگاه منتقل می‌شوید...</p>
    </div>
  );
}
