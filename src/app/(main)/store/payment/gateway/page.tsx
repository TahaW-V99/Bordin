"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/components/ui/button";

export default function StoreGatewayPage() {
  const router = useRouter();
  const params = useSearchParams();
  const paymentId = params.get("paymentId") ?? "";
  const [loading, setLoading] = useState(false);

  const gatewayMock = useMemo(
    () => process.env.NEXT_PUBLIC_PAYMENT_GATEWAY_MOCK !== "false",
    [],
  );

  useEffect(() => {
    if (!paymentId) {
      router.replace("/store?tab=buy");
    }
  }, [paymentId, router]);

  const verify = async (success: boolean) => {
    if (!paymentId) return;
    setLoading(true);
    const res = await fetch("/api/store/gateway/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, success }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      router.replace("/store/payment/failed");
      return;
    }
    if (success && data.success) {
      router.replace(`/store/payment/success?coins=${data.packageCoins ?? 0}`);
      return;
    }
    router.replace("/store/payment/failed");
  };

  if (!gatewayMock) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-lg font-bold">درگاه پرداخت زیبال در حال بارگذاری است</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-10 text-center">
      <h1 className="text-xl font-bold">درگاه پرداخت زیبال (حالت تست)</h1>
      <p className="text-sm text-white/60">
        تراکنش واقعی بانکی انجام نمی‌شود. تأیید نهایی همچنان از طریق سرور انجام می‌شود.
      </p>
      <div className="mx-auto flex max-w-sm gap-2">
        <Button fullWidth loading={loading} onClick={() => void verify(true)}>
          پرداخت موفق
        </Button>
        <Button fullWidth variant="secondary" loading={loading} onClick={() => void verify(false)}>
          پرداخت ناموفق
        </Button>
      </div>
    </div>
  );
}
