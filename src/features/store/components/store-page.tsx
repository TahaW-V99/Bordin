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
import {
  STORE_SELL_UI_ENABLED,
  type StoreAssetGrant,
  type StoreBadgeTone,
  type StoreProduct,
  type StoreProductCategory,
} from "@/shared/constants/store";
import { getTicketAssetByWalletField } from "@/shared/constants/tickets";
import { dispatchEnergyUpdated } from "@/shared/lib/energy-client";

type StoreTab = "buy" | "sell";
type PayMethod = "gateway" | "wallet";

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
  packageNameFa?: string | null;
  category?: StoreProductCategory | null;
};

type StoreCatalog = {
  bundles: StoreProduct[];
  coins: StoreProduct[];
  tickets: StoreProduct[];
  energy: StoreProduct[];
};

const SELL_PACKAGE_IMAGE: Record<string, string> = {
  "sell-3000": "/images/store/sell-3000.png",
  "sell-6000": "/images/store/sell-6000.png",
  "sell-12000": "/images/store/sell-12000.png",
};

const BADGE_CLASS: Record<StoreBadgeTone, string> = {
  blue: "bg-bordin-blue/90 text-white",
  green: "bg-bordin-green/90 text-black",
  gold: "bg-bordin-orange/90 text-black",
};

const BUNDLE_BADGE_OVERRIDE: Record<string, string> = {
  // پیشنهاد شروع → بنفش
  "bundle-soot-aghaz": "bg-purple-600/90 text-white",
};

function grantSummaryLines(grants: StoreAssetGrant[]): string[] {
  return grants.map((grant) => {
    if (grant.kind === "purchasedCoins") {
      return `${formatPersianNumber(grant.amount)} سکه`;
    }
    if (grant.kind === "ticket") {
      const ticket = getTicketAssetByWalletField(grant.ticketType);
      return `×${formatPersianNumber(grant.quantity)} ${ticket?.title ?? "بلیط"}`;
    }
    return `${formatPersianNumber(grant.percent)}٪ انرژی`;
  });
}

function ProductPriceBlock({
  product,
  lines,
  maxLines,
  lineClassName = "text-sm font-bold text-bordin-orange",
  priceClassName = "text-xs text-white/50",
  originalPriceClassName = "text-xs text-white/40 line-through",
}: {
  product: StoreProduct;
  lines: string[];
  maxLines?: number;
  lineClassName?: string;
  priceClassName?: string;
  originalPriceClassName?: string;
}) {
  const visible = maxLines != null ? lines.slice(0, maxLines) : lines;
  return (
    <>
      {visible.map((line) => (
        <p key={line} className={lineClassName}>
          {line}
        </p>
      ))}
      {product.originalPriceToman != null ? (
        <p className={originalPriceClassName}>
          {formatPersianNumber(product.originalPriceToman)} تومان
        </p>
      ) : null}
      <p className={priceClassName}>
        {formatPersianNumber(product.priceToman)} تومان
      </p>
    </>
  );
}

function StoreProductCard({
  product,
  onSelect,
}: {
  product: StoreProduct;
  onSelect: (product: StoreProduct) => void;
}) {
  const lines = grantSummaryLines(product.grants);
  const isCoinCard = product.category === "coins";
  const isBundleCard = product.category === "bundle";
  const isTicketCard = product.category === "tickets";

  if (isBundleCard) {
    return (
      <Card className="relative mx-auto w-[364px] overflow-hidden">
        {product.badge ? (
          <span
            className={`absolute right-2 top-2 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold ${
              BUNDLE_BADGE_OVERRIDE[product.id] ?? BADGE_CLASS[product.badge.tone]
            }`}
          >
            {product.badge.text}
          </span>
        ) : null}

        <CardContent className="relative flex flex-col gap-2 px-3 pb-3 pt-3">
          <div
            className="relative mx-auto shrink-0 overflow-hidden rounded-xl border border-white/10"
            style={{ width: product.imageWidth, height: product.imageHeight }}
          >
            <Image
              src={product.image}
              alt={product.nameFa}
              width={product.imageWidth}
              height={product.imageHeight}
              className="object-contain"
              style={{ width: product.imageWidth, height: product.imageHeight }}
            />
          </div>

          <p className="text-right text-sm font-bold leading-tight">{product.nameFa}</p>

          <div className="space-y-0.5 text-right">
            {lines.map((line) => (
              <p key={line} className="text-xs font-bold leading-snug text-bordin-orange">
                {line}
              </p>
            ))}
          </div>

          <div className="space-y-0.5 text-right">
            {product.originalPriceToman != null ? (
              <p className="text-xs text-white/40 line-through">
                {formatPersianNumber(product.originalPriceToman)} تومان
              </p>
            ) : null}
            <p className="text-sm font-bold text-bordin-green">
              {formatPersianNumber(product.priceToman)} تومان
            </p>
          </div>

          <div className="flex justify-start" dir="ltr">
            <Button
              size="sm"
              onClick={() => onSelect(product)}
              className="h-[33px] w-[89px] shrink-0 rounded-md px-0 text-xs"
            >
              انتخاب
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isTicketCard) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="relative py-3 pr-3" dir="ltr">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => onSelect(product)}
              className="h-[33px] w-[89px] shrink-0 self-center rounded-md px-0 text-xs"
            >
              انتخاب
            </Button>

            <div
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2"
              dir="rtl"
            >
              <p className="w-full text-center text-sm font-bold leading-tight">
                {product.nameFa}
              </p>

              <div
                className="relative shrink-0 overflow-hidden rounded-xl border border-white/10"
                style={{
                  width: product.imageWidth,
                  height: product.imageHeight,
                }}
              >
                <Image
                  src={product.image}
                  alt={product.nameFa}
                  width={product.imageWidth}
                  height={product.imageHeight}
                  className="object-contain"
                  style={{ width: product.imageWidth, height: product.imageHeight }}
                />
              </div>

              <div className="w-full space-y-0.5 text-center">
                <ProductPriceBlock
                  product={product}
                  lines={[]}
                  priceClassName="text-sm font-semibold text-white/70"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {product.badge ? (
        <span
          className={`absolute right-2 top-2 z-20 rounded-full px-2.5 py-1 text-[10px] font-bold ${BADGE_CLASS[product.badge.tone]}`}
        >
          {product.badge.text}
        </span>
      ) : null}

      <CardContent className="relative py-3 pr-3 md:flex md:items-center md:gap-3 md:py-4 md:pl-[105px] md:pr-4">
        <Button
          size="sm"
          onClick={() => onSelect(product)}
          className="absolute left-1 top-[calc(50%+0.625rem)] z-10 h-[33px] w-[89px] shrink-0 -translate-y-1/2 rounded-md px-0 text-xs md:left-3 md:top-1/2"
        >
          انتخاب
        </Button>

        {/* موبایل */}
        <div
          className={`grid gap-x-3 gap-y-1.5 pl-[98px] md:hidden ${
            isCoinCard
              ? "grid-cols-[72px_minmax(0,1fr)_72px] grid-rows-[auto_133px]"
              : "grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto]"
          }`}
        >
          <p
            className={`self-end overflow-hidden text-ellipsis whitespace-nowrap text-right text-sm font-bold leading-tight ${
              isCoinCard ? "col-span-2 col-start-1 row-start-1" : "col-span-2 row-start-1"
            }`}
          >
            {product.nameFa}
          </p>

          <div
            className={`relative shrink-0 overflow-hidden rounded-xl border border-white/10 ${
              isCoinCard ? "col-start-1 row-start-2 h-[133px] w-[72px]" : "col-start-1 row-start-2"
            }`}
            style={
              isCoinCard
                ? undefined
                : { width: product.imageWidth, height: product.imageHeight }
            }
          >
            <Image
              src={product.image}
              alt={product.nameFa}
              width={product.imageWidth}
              height={product.imageHeight}
              className="object-contain"
              style={{ width: product.imageWidth, height: product.imageHeight }}
            />
          </div>

          <div
            className={`min-w-0 self-center ${
              isCoinCard ? "col-start-2 row-start-2" : "col-start-2 row-start-2"
            }`}
          >
            <ProductPriceBlock product={product} lines={lines} maxLines={2} />
          </div>

          {isCoinCard ? (
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
          ) : null}
        </div>

        {/* دسکتاپ */}
        <div className="hidden min-h-0 flex-1 items-center gap-3 md:flex">
          <div
            className="relative shrink-0 overflow-hidden rounded-xl border border-white/10"
            style={{ width: product.imageWidth, height: product.imageHeight }}
          >
            <Image
              src={product.image}
              alt={product.nameFa}
              width={product.imageWidth}
              height={product.imageHeight}
              className="object-contain"
              style={{ width: product.imageWidth, height: product.imageHeight }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{product.nameFa}</p>
            <ProductPriceBlock
              product={product}
              lines={lines}
              lineClassName="text-sm text-bordin-orange"
            />
          </div>
          {isCoinCard ? (
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
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function StorePage({ sellTabVisible = false }: { sellTabVisible?: boolean }) {
  const params = useSearchParams();
  const { toast } = useToast();
  const [tab, setTab] = useState<StoreTab>("buy");
  const [catalog, setCatalog] = useState<StoreCatalog>({
    bundles: [],
    coins: [],
    tickets: [],
    energy: [],
  });
  const [sellPackages, setSellPackages] = useState<SellPackage[]>([]);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [payMethod, setPayMethod] = useState<PayMethod>("gateway");
  const [selectedPackage, setSelectedPackage] = useState<StoreProduct | null>(null);
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
      setCatalog({
        bundles: pData.catalog?.bundles ?? [],
        coins: pData.catalog?.coins ?? pData.packages ?? [],
        tickets: pData.catalog?.tickets ?? [],
        energy: pData.catalog?.energy ?? [],
      });
      setSellPackages(pData.sellPackages ?? []);
      setWallet(pData.wallet ?? null);
      setPurchaseHistory(pData.purchaseHistory ?? []);
    } catch {
      toast("خطا در بارگذاری فروشگاه", "error");
    } finally {
      setPageLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

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
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    if (payMethod === "gateway" && data.paymentUrl) {
      window.location.href = data.paymentUrl as string;
      return;
    }
    toast("خرید با موفقیت انجام شد", "success");
    dispatchEnergyUpdated();
    setSelectedPackage(null);
    void load();
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
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    toast(`فروش انجام شد — ${formatPersianNumber(data.tomanValue)} تومان`, "success");
    setConfirmSell(null);
    void load();
  };

  const sellableCoins = wallet?.predictionRewardCoins ?? 0;

  return (
    <>
      <PageHeader
        title="فروشگاه"
        subtitle={sellTabVisible ? "خرید دارایی و فروش سکه" : "خرید دارایی"}
      />
      <div className="space-y-6 px-4 py-4">
        <div className="flex gap-2 overflow-x-auto">
          <Chip active={tab === "buy"} onClick={() => setTab("buy")}>
            خرید
          </Chip>
          {sellTabVisible ? (
            <Chip active={tab === "sell"} onClick={() => setTab("sell")}>
              فروش سکه
            </Chip>
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
              <h3 className="mb-3 font-bold">پکیج‌های ویژه</h3>
              <div className="space-y-3">
                {catalog.bundles.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    product={product}
                    onSelect={setSelectedPackage}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-bold">پکیج‌های خرید سکه</h3>
              <div className="space-y-3">
                {catalog.coins.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    product={product}
                    onSelect={setSelectedPackage}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-bold">بلیط‌ها</h3>
              <div className="space-y-3">
                {catalog.tickets.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    product={product}
                    onSelect={setSelectedPackage}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-bold">انرژی فوتبالی</h3>
              <div className="space-y-3">
                {catalog.energy.map((product) => (
                  <StoreProductCard
                    key={product.id}
                    product={product}
                    onSelect={setSelectedPackage}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-3 font-bold">تاریخچه خرید</h3>
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
                        {item.packageNameFa
                          ? item.packageNameFa
                          : item.coinsGranted > 0
                            ? `${formatPersianNumber(item.coinsGranted)} سکه دریافت شده`
                            : "خرید دارایی"}
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
                        <p className="text-sm text-bordin-green">
                          {formatPersianNumber(pkg.priceToman)} تومان
                        </p>
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
            <p className="text-sm text-white/65">{selectedPackage.nameFa}</p>
            <div className="space-y-1 text-sm text-white/65">
              {grantSummaryLines(selectedPackage.grants).map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
            {selectedPackage.originalPriceToman != null ? (
              <p className="text-sm text-white/40 line-through">
                {formatPersianNumber(selectedPackage.originalPriceToman)} تومان
              </p>
            ) : null}
            <p className="text-sm text-white/65">
              مبلغ: {formatPersianNumber(selectedPackage.priceToman)} تومان
            </p>
            {STORE_SELL_UI_ENABLED ? (
              <div className="rounded-xl border border-bordin-orange/20 bg-bordin-orange/10 p-3 text-sm">
                موجودی کیف پول: {formatPersianNumber(wallet?.cashBalanceToman ?? 0)} تومان
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={payMethod === "gateway" ? "primary" : "secondary"}
                onClick={() => setPayMethod("gateway")}
              >
                درگاه پرداخت
              </Button>
              {STORE_SELL_UI_ENABLED ? (
                <Button
                  size="sm"
                  variant={payMethod === "wallet" ? "primary" : "secondary"}
                  onClick={() => setPayMethod("wallet")}
                >
                  کیف پول
                </Button>
              ) : null}
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
