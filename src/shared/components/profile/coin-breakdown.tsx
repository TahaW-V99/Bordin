import { formatPersianNumber } from "@/shared/lib/dates";
import Image from "next/image";

export function CoinBreakdown({
  predictionRewardCoins,
  systemRewardCoins,
  purchasedCoins,
  cashBalanceToman,
}: {
  predictionRewardCoins: number;
  systemRewardCoins: number;
  purchasedCoins: number;
  cashBalanceToman?: number;
}) {
  const items = [
    {
      label: "سکه‌ جایزه پیش‌بینی",
      value: predictionRewardCoins,
      color: "text-bordin-green",
      sellable: true,
      image: "/images/store/coin-prediction-reward.png",
    },
    {
      label: "پاداش سیستم",
      value: systemRewardCoins,
      color: "text-bordin-blue",
      image: "/images/store/coin-system-reward.png",
    },
    {
      label: "خریداری شده",
      value: purchasedCoins,
      color: "text-bordin-orange",
      image: "/images/store/coin-bordin.png",
    },
  ];
  const total = predictionRewardCoins + systemRewardCoins + purchasedCoins;

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-white/50">مجموع سکه</span>
        <span className="text-2xl font-bold text-bordin-orange">{formatPersianNumber(total)}</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <Image
                src={item.image}
                alt={item.label}
                width={63}
                height={62}
                className="h-[62px] w-[63px] object-contain [mix-blend-mode:screen]"
              />
              <span className="text-sm text-white/60">
                {item.label}
                {item.sellable ? <span className="mr-1 text-[10px] text-bordin-green">(قابل فروش)</span> : null}
              </span>
            </div>
            <span className={`font-semibold ${item.color}`}>{formatPersianNumber(item.value)}</span>
          </div>
        ))}
      </div>
      {cashBalanceToman !== undefined ? (
        <div className="flex justify-between rounded-lg border border-white/8 px-3 py-2">
          <span className="text-sm text-white/60">موجودی نقدی (تومان)</span>
          <span className="font-semibold">{formatPersianNumber(cashBalanceToman)}</span>
        </div>
      ) : null}
    </div>
  );
}
