"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Wallet, Banknote } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber, formatTehranDateTime } from "@/shared/lib/dates";
import {
  SHEBA_STATUS_LABELS,
  WITHDRAWAL_STATUS_LABELS,
  shebaStatusTextClass,
  withdrawalStatusCardClass,
  withdrawalStatusTextClass,
} from "@/shared/constants/wallet";
import { cn } from "@/shared/lib/cn";

type WalletData = {
  cashBalanceToman: number;
  sheba: {
    digits: string | null;
    display: string | null;
    status: string;
    canSubmit: boolean;
    canWithdraw: boolean;
  };
  withdrawals: Array<{
    id: string;
    amountToman: number;
    status: string;
    createdAt: string;
  }>;
};

export function WalletPage() {
  const { toast } = useToast();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shebaInput, setShebaInput] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/profile/wallet");
    const json = await res.json();
    if (!res.ok) {
      toast(json.error ?? "خطا در بارگذاری", "error");
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitSheba = async () => {
    setSubmitting(true);
    const res = await fetch("/api/profile/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit-sheba", sheba: shebaInput }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast(json.error ?? "خطا", "error");
      return;
    }
    toast("شماره شبا ثبت شد و در انتظار تأیید است", "success");
    setShebaInput("");
    void load();
  };

  const requestWithdraw = async () => {
    setSubmitting(true);
    const res = await fetch("/api/profile/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw", amount: Number(withdrawAmount) }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast(json.error ?? "خطا", "error");
      return;
    }
    toast("درخواست دریافت وجه ثبت شد", "success");
    setWithdrawAmount("");
    void load();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="کیف پول" hideToolbar />
        <div className="px-4 py-4">
          <Skeleton className="h-32" />
        </div>
      </>
    );
  }

  if (!data) {
    return <PageHeader title="کیف پول" subtitle="خطا در بارگذاری" hideToolbar />;
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70"
            aria-label="بازگشت"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold">مدیریت کیف پول</h1>
            <p className="text-sm text-white/50">موجودی نقد و دریافت وجه</p>
          </div>
          <Wallet className="h-6 w-6 text-bordin-orange" />
        </div>
      </header>

      <div className="space-y-6 px-4 py-4 pb-24">
        <section className="rounded-2xl border border-bordin-orange/30 bg-bordin-orange/10 p-5 text-center">
          <p className="text-sm text-white/60">موجودی نقد</p>
          <p className="mt-1 text-3xl font-bold text-bordin-orange">
            {formatPersianNumber(data.cashBalanceToman)}
            <span className="mr-1 text-base font-normal text-white/50">تومان</span>
          </p>
        </section>

        <section className="rounded-2xl border border-white/8 p-4">
          <h3 className="mb-3 font-bold">شماره شبا</h3>
          {data.sheba.display ? (
            <p className="mb-2 text-sm text-white/70" dir="ltr">
              {data.sheba.display}
            </p>
          ) : null}
          <p
            className={cn("mb-3 text-xs font-medium", shebaStatusTextClass(data.sheba.status))}
          >
            وضعیت: {SHEBA_STATUS_LABELS[data.sheba.status] ?? data.sheba.status}
          </p>
          {data.sheba.canSubmit ? (
            <>
              {data.sheba.status === "REJECTED" ? (
                <p className="mb-3 text-xs leading-6 text-red-400">
                  شماره شبای قبلی رد شده است. لطفاً شماره صحیح را دوباره ثبت کنید.
                </p>
              ) : null}
              <Input
                label="شماره شبا (۲۴ رقم)"
                inputMode="numeric"
                dir="ltr"
                placeholder="XXXXXXXXXXXXXXXXXXXXXXXX"
                value={shebaInput}
                onChange={(e) => setShebaInput(e.target.value.replace(/\D/g, "").slice(0, 24))}
              />
              <Button
                className="mt-3"
                fullWidth
                loading={submitting}
                disabled={shebaInput.length !== 24}
                onClick={() => void submitSheba()}
              >
                ثبت شماره شبا
              </Button>
            </>
          ) : data.sheba.status === "PENDING_ADMIN" ? (
            <p className="text-xs leading-6 text-bordin-orange">
              شماره شبای شما در انتظار تأیید ادمین است.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-white/8 p-4">
          <h3 className="mb-3 font-bold">درخواست دریافت وجه</h3>
          {!data.sheba.canWithdraw ? (
            <p className="text-xs leading-6 text-white/50">
              برای فعال شدن این بخش، ابتدا شماره شبای خود را ثبت و تأیید کنید.
            </p>
          ) : (
            <>
              <Input
                label="مبلغ (تومان)"
                inputMode="numeric"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value.replace(/\D/g, ""))}
              />
              <Button
                className="mt-3"
                fullWidth
                loading={submitting}
                disabled={!withdrawAmount || Number(withdrawAmount) <= 0}
                onClick={() => void requestWithdraw()}
              >
                درخواست دریافت وجه
              </Button>
            </>
          )}
        </section>

        <section>
          <h3 className="mb-3 font-bold">تاریخچه دریافت وجه</h3>
          {data.withdrawals.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title="درخواستی ثبت نشده"
              description="درخواست‌های دریافت وجه اینجا نمایش داده می‌شوند."
            />
          ) : (
            <div className="space-y-2">
              {data.withdrawals.map((row) => (
                <div
                  key={row.id}
                  className={cn("rounded-xl border p-3 text-sm", withdrawalStatusCardClass(row.status))}
                >
                  <div className="flex justify-between">
                    <span className="text-white/50">{formatTehranDateTime(row.createdAt)}</span>
                    <span className="font-bold">{formatPersianNumber(row.amountToman)} تومان</span>
                  </div>
                  <p className={cn("mt-1 text-xs font-medium", withdrawalStatusTextClass(row.status))}>
                    وضعیت: {WITHDRAWAL_STATUS_LABELS[row.status] ?? row.status}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
