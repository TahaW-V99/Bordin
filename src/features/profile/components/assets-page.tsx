"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatPersianNumber } from "@/shared/lib/dates";
import { TICKET_ASSETS } from "@/shared/constants/tickets";

type AssetCard = {
  id: string;
  title: string;
  value: number;
  color: string;
  image: string;
};

export function AssetsPage() {
  const [wallet, setWallet] = useState<{
    footballCredits: number;
    predictionRewardCoins: number;
    systemRewardCoins: number;
    purchasedCoins: number;
    legendsCupTickets: number;
    normalCupTickets: number;
    tournamentTickets: number;
    teamCompetitionTickets: number;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    const json = await res.json();
    if (!res.ok) {
      setWallet(null);
      setLoadError((json.error as string) ?? "خطا در بارگذاری");
      setLoading(false);
      return;
    }
    const profileWallet = (json.profile as { wallet?: Record<string, number> } | null)?.wallet;
    setWallet({
      footballCredits: profileWallet?.footballCredits ?? 0,
      predictionRewardCoins: profileWallet?.predictionRewardCoins ?? 0,
      systemRewardCoins: profileWallet?.systemRewardCoins ?? 0,
      purchasedCoins: profileWallet?.purchasedCoins ?? 0,
      legendsCupTickets: profileWallet?.legendsCupTickets ?? 0,
      normalCupTickets: profileWallet?.normalCupTickets ?? 0,
      tournamentTickets: profileWallet?.tournamentTickets ?? 0,
      teamCompetitionTickets: profileWallet?.teamCompetitionTickets ?? 0,
    });
    setLoadError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Legacy predictionRewardCoins is part of "سکه جایزه" in the product model
  // (Purchased / Reward / Football Credit). Include it so the row matches مجموع سکه.
  const rewardCoins =
    (wallet?.systemRewardCoins ?? 0) + (wallet?.predictionRewardCoins ?? 0);
  const totalCoins = rewardCoins + (wallet?.purchasedCoins ?? 0);

  const assets: AssetCard[] = wallet
    ? [
        {
          id: "football-credit",
          title: "اعتبار فوتبالی",
          value: wallet.footballCredits,
          color: "text-bordin-orange",
          image: "/images/store/football-credit.png",
        },
        {
          id: "reward-coin",
          title: "سکه جایزه",
          value: rewardCoins,
          color: "text-bordin-blue",
          image: "/images/store/coin-system-reward.png",
        },
        {
          id: "purchased-coin",
          title: "سکه خریداری شده",
          value: wallet.purchasedCoins,
          color: "text-bordin-orange",
          image: "/images/store/coin-bordin.png",
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="دارایی‌ها"
        startAction={
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت به پروفایل"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        {loading ? (
          <>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </>
        ) : loadError ? (
          <p className="rounded-xl border border-white/10 p-3 text-sm text-white/50">{loadError}</p>
        ) : (
          <>
            <div className="space-y-3">
              {assets.map((asset) => (
                <Card key={asset.id}>
                  <CardContent className="flex items-center justify-between gap-3 pt-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Image
                        src={asset.image}
                        alt={asset.title}
                        width={63}
                        height={62}
                        className="h-[62px] w-[63px] shrink-0 object-contain [mix-blend-mode:screen]"
                      />
                      <span className="text-sm font-medium text-white/70">{asset.title}</span>
                    </div>
                    <span className={`shrink-0 text-lg font-semibold ${asset.color}`}>
                      {formatPersianNumber(asset.value)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-baseline justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <span className="text-sm text-white/50">مجموع سکه</span>
              <span className="text-2xl font-bold text-bordin-orange">
                {formatPersianNumber(totalCoins)}
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="font-bold">بلیط‌ها</h3>

              <div className="space-y-3">
                {TICKET_ASSETS.map((ticket) => (
                  <Card key={ticket.id}>
                    <CardContent className="space-y-2 pt-4">
                      <div className="flex justify-center">
                        <Image
                          src={ticket.image}
                          alt={ticket.title}
                          width={340}
                          height={110}
                          className="h-[110px] w-[340px] object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-white/80">
                          {ticket.title}
                        </span>
                        <span className="text-base font-bold text-bordin-orange">
                          ×{formatPersianNumber(wallet?.[ticket.walletField] ?? 0)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
