"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Chip } from "@/shared/components/ui/chip";
import { CoinBreakdown } from "@/shared/components/profile/coin-breakdown";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber, formatTehranDateTime } from "@/shared/lib/dates";

type StoreTab = "buy" | "sell";
type PayMethod = "gateway" | "wallet";

type BuyPackage = {
  id: string;
  nameFa: string;
  coinAmount: number;
  priceToman: number;
};

type SellPackage = {
  id: string;
  coinAmount: number;
  priceToman: number;
};

type WalletData = {
  predictionRewardCoins: number;
  systemRewardCoins: number;
  purchasedCoins: number;
  cashBalanceToman: number;
};

type PurchaseHistoryItem = {
  id: string;
  createdAt: string;
  amountToman: number;
  coinsGranted: number;
};

const BUY_PACKAGE_IMAGE: Record<string, string> = {
  "pkg-600": "/images/store/buy-12000.png",
  "pkg-1200": "/images/store/buy-1200.png",
  "pkg-3000": "/images/store/buy-600.png",
  "pkg-6000": "/images/store/buy-6000.png",
  "pkg-12000": "/images/store/buy-3000.png",
};

const SELL_PACKAGE_IMAGE: Record<string, string> = {
  "sell-3000": "/images/store/sell-3000.png",
  "sell-6000": "/images/store/sell-6000.png",
  "sell-12000": "/images/store/sell-12000.png",
};

export function StorePage({ sellTabVisible = true }: { sellTabVisible?: boolean }) {
  const params = useSearchParams();
  const { toast } = useToast();
  const [tab, setTab] = useState<StoreTab>("buy");
  const [packages, setPackages] = useState<BuyPackage[]>([]);
  const [sellPackages, setSellPackages] = useState<SellPackage[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<PayMethod>("gateway");
  const [selectedPackage, setSelectedPackage] = useState<BuyPackage | null>(null);
  const [confirmSell, setConfirmSell] = useState<SellPackage | null>(null);

  const load = useCallback(async () => {
    setPageLoading(true);
    try {
      const pRes = await fetch("/api/store/packages", { cache: "no-store" });
      const pData = await pRes.json();
      if (!pRes.ok) {
        toast(pData.error ?? "خطا در بارگذاری فروشگاه", "error");
        return;
      }
      setPackages(pData.packages ?? []);
      setSellPackages(pData.sellPackages ?? []);
      setWallet(pData.wallet ?? null);
      setPurchaseHistory(pData.purchaseHistory ?? []);
    } catch {
      toast("خطا در بارگذاری فروشگاه", "error");
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const initialTab = params.get("tab");
    if (initialTab === "sell" && sellTabVisible) {
      setTab("sell");
      return;
    }
    setTab("buy");
  }, [params, sellTabVisible]);

  const buy = async () => {
    if (!selectedPackage) return;
    setLoading(true);
    const res = await fetch("/api/store/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageId: selectedPackage.id,
        method: payMethod,
        returnOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast(data.error, "error"); return; }
    if (payMethod === "gateway" && data.paymentUrl) {
      window.location.href = data.paymentUrl as string;
      return;
    }
    toast("خرید با موفقیت انجام شد", "success");
    setSelectedPackage(null);
    load();
  };

  const sell = async (coinAmount: number) => {
    setLoading(true);
    const res = await fetch("/api/store/sell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: coinAmount }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast(data.error, "error"); return; }
    toast(`فروش انجام شد — ${formatPersianNumber(data.tomanValue)} تومان`, "success");
    setConfirmSell(null);
    load();
  };

  const sellableCoins = wallet?.predictionRewardCoins ?? 0;

  return (
    <>
      <PageHeader
        title="فروشگاه"
        subtitle={sellTabVisible ? "خرید و فروش سکه" : "خرید سکه"}
      />
      <div className="space-y-6 px-4 py-4">
        <div className="flex gap-2 overflow-x-auto">
          <Chip active={tab === "buy"} onClick={() => setTab("buy")}>خرید سکه</Chip>
          {sellTabVisible ? (
            <Chip active={tab === "sell"} onClick={() => setTab("sell")}>فروش سکه</Chip>
          ) : null}
        </div>

        {pageLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : tab === "buy" || !sellTabVisible ? (
          <>
            <section>
              <h3 className="mb-3 font-bold">پکیج‌های خرید سکه</h3>
              <div className="space-y-3">
                {packages.length === 0 ? (
                  <p className="rounded-xl border border-white/10 p-3 text-sm text-white/50">
                    پکیج خریدی در دسترس نیست.
                  </p>
                ) : null}
                {packages.map((pkg) => (
                  <Card key={pkg.id} className="relative overflow-hidden">
                    <CardContent className="relative py-3 pr-3 md:flex md:items-center md:gap-3 md:py-4 md:pl-[105px] md:pr-4">
                      <Button
                        size="sm"
                        onClick={() => setSelectedPackage(pkg)}
                        className="absolute left-1 top-[calc(50%+0.625rem)] z-10 h-[33px] w-[89px] shrink-0 -translate-y-1/2 rounded-md px-0 text-xs md:left-3 md:top-1/2"
                      >
                        انتخاب
                      </Button>

                      {/* موبایل: عنوان در ردیف بالا، هم‌تراز با گوشه چپ بالای عکس پکیج */}
                      <div className="grid grid-cols-[72px_minmax(0,1fr)_72px] grid-rows-[auto_133px] gap-x-3 gap-y-1.5 pl-[98px] md:hidden">
                        <p className="col-start-1 col-span-2 row-start-1 self-end overflow-hidden text-ellipsis whitespace-nowrap text-right text-sm font-bold leading-tight">
                          {pkg.nameFa}
                        </p>
                        <div className="col-start-1 row-start-2 relative h-[133px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10">
                          <Image
                            src={BUY_PACKAGE_IMAGE[pkg.id] ?? "/images/store/buy-coins-package.svg"}
                            alt="پکیج خرید سکه"
                            width={72}
                            height={133}
                            className="h-[133px] w-[72px] object-contain"
                          />
                        </div>
                        <div className="col-start-2 row-start-2 min-w-0 self-center">
                          <p className="text-sm font-bold text-bordin-orange">
                            {formatPersianNumber(pkg.coinAmount)} سکه
                          </p>
                          <p className="text-xs text-white/50">
                            {formatPersianNumber(pkg.priceToman)} تومان
                          </p>
                        </div>
                        <div
                          className="pointer-events-none col-start-3 row-start-2 relative flex w-[72px] shrink-0 items-center justify-center self-stretch"
                          aria-hidden
                        >
                          <Image
                            src="/images/store/coin-bordin.png"
                            alt=""
                            width={89}
                            height={100}
                            className="h-[100px] w-[89px] object-contain opacity-[0.32] [mix-blend-mode:screen]"
                          />
                        </div>
                      </div>

                      {/* دسکتاپ */}
                      <div className="hidden min-h-0 flex-1 items-center gap-3 md:flex">
                        <div className="relative h-[133px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/10">
                          <Image
                            src={BUY_PACKAGE_IMAGE[pkg.id] ?? "/images/store/buy-coins-package.svg"}
                            alt="پکیج خرید سکه"
                            width={72}
                            height={133}
                            className="h-[133px] w-[72px] object-contain"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">{pkg.nameFa}</p>
                          <p className="text-sm text-bordin-orange">
                            {formatPersianNumber(pkg.coinAmount)} سکه
                          </p>
                          <p className="text-xs text-white/50">
                            {formatPersianNumber(pkg.priceToman)} تومان
                          </p>
                        </div>
                        <div
                          className="pointer-events-none relative flex w-[72px] shrink-0 items-center justify-center self-stretch"
                          aria-hidden
                        >
                          <Image
                            src="/images/store/coin-bordin.png"
                            alt=""
                            width={89}
                            height={100}
                            className="h-[100px] w-[89px] object-contain opacity-[0.32] [mix-blend-mode:screen]"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-bold">تاریخچه خرید سکه</h3>
              {purchaseHistory.length === 0 ? (
                <p className="rounded-xl border border-white/10 p-3 text-sm text-white/50">
                  هنوز خرید موفقی ثبت نشده است.
                </p>
              ) : (
                <div className="space-y-2">
                  {purchaseHistory.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/8 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-white/50">{formatTehranDateTime(item.createdAt)}</span>
                        <span className="font-bold text-bordin-green">
                          {formatPersianNumber(item.amountToman)} تومان
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/60">
                        {formatPersianNumber(item.coinsGranted)} سکه دریافت شده
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="space-y-4">
            {wallet ? (
              <CoinBreakdown
                predictionRewardCoins={wallet.predictionRewardCoins}
                systemRewardCoins={wallet.systemRewardCoins}
                purchasedCoins={wallet.purchasedCoins}
                cashBalanceToman={wallet.cashBalanceToman}
              />
            ) : null}
            <h3 className="font-bold">پکیج‌های فروش سکه</h3>
            <div className="space-y-3">
              {sellPackages.map((pkg) => {
                const enabled = sellableCoins >= pkg.coinAmount;
                return (
                  <Card key={pkg.id}>
                    <CardContent className="flex items-center gap-3 pt-4">
                      <div className="relative h-[75px] w-[163px] overflow-hidden rounded-xl border border-white/10">
                        <Image
                          src={SELL_PACKAGE_IMAGE[pkg.id] ?? "/images/store/sell-coins-package.svg"}
                          alt="پکیج فروش سکه"
                          fill
                          className="object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="font-bold">{formatPersianNumber(pkg.coinAmount)} سکه</p>
                        <p className="text-sm text-bordin-green">{formatPersianNumber(pkg.priceToman)} تومان</p>
                        {!enabled ? (
                          <p className="text-xs text-white/55">تعداد سکه شما کافی نیست</p>
                        ) : null}
                      </div>
                      <Button
                        size="sm"
                        variant={enabled ? "primary" : "secondary"}
                        disabled={!enabled || loading}
                        onClick={() => setConfirmSell(pkg)}
                      >
                        تبدیل
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <Modal open={!!selectedPackage} onClose={() => setSelectedPackage(null)}>
        {selectedPackage ? (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">انتخاب روش پرداخت</h3>
            <p className="text-sm text-white/65">
              {selectedPackage.nameFa} — {formatPersianNumber(selectedPackage.coinAmount)} سکه
            </p>
            <p className="text-sm text-white/65">
              مبلغ: {formatPersianNumber(selectedPackage.priceToman)} تومان
            </p>
            <div className="rounded-xl border border-bordin-orange/20 bg-bordin-orange/10 p-3 text-sm">
              موجودی کیف پول: {formatPersianNumber(wallet?.cashBalanceToman ?? 0)} تومان
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={payMethod === "gateway" ? "primary" : "secondary"}
                onClick={() => setPayMethod("gateway")}
              >
                درگاه پرداخت
              </Button>
              <Button
                size="sm"
                variant={payMethod === "wallet" ? "primary" : "secondary"}
                onClick={() => setPayMethod("wallet")}
              >
                کیف پول
              </Button>
            </div>
            <div className="flex gap-2">
              <Button fullWidth loading={loading} onClick={() => void buy()}>
                پرداخت
              </Button>
              <Button fullWidth variant="ghost" onClick={() => setSelectedPackage(null)}>
                لغو
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={!!confirmSell} onClose={() => setConfirmSell(null)}>
        {confirmSell ? (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">آیا از تبدیل سکه مطمئن هستید؟</h3>
            <p className="text-sm text-white/65">
              {formatPersianNumber(confirmSell.coinAmount)} سکه به{" "}
              {formatPersianNumber(confirmSell.priceToman)} تومان تبدیل می‌شود.
            </p>
            <div className="flex gap-2">
              <Button fullWidth loading={loading} onClick={() => void sell(confirmSell.coinAmount)}>
                تایید
              </Button>
              <Button fullWidth variant="ghost" onClick={() => setConfirmSell(null)}>
                لغو
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
