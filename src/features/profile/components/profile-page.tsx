"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CoinsBalanceLink,
  InboxWhistleLink,
  WalletHeaderLink,
} from "@/shared/components/layout/header-toolbar";
import { LevelBadge } from "@/shared/components/profile/level-badge";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { CoinBreakdown } from "@/shared/components/profile/coin-breakdown";
import { HonorsSlider } from "@/shared/components/profile/honors-slider";
import { type EarnedMedalInput } from "@/shared/lib/honors";
import { StatBlock } from "@/shared/components/ui/stat-block";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatPersianNumber } from "@/shared/lib/dates";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { UserPlus, Share2, Settings, ClipboardList, Users, Trophy, Target } from "lucide-react";
import { PublicProfileLink } from "@/shared/components/profile/public-profile-link";
import { AvatarCollectionModal } from "@/features/avatar-collection/components/avatar-collection-modal";

export function ProfilePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionMeta, setCollectionMeta] = useState<{
    totalCoins: number;
    unlockedAvatarIds: string[];
  } | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/profile");
    const json = await res.json();
    if (!res.ok) {
      setData(null);
      setLoadError((json.error as string) ?? "خطا در بارگذاری");
      setLoading(false);
      return;
    }
    setLoadError(null);
    setData(json.profile ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAvatarCollection = async () => {
    setCollectionLoading(true);
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (!res.ok) return;
      setCollectionMeta({
        totalCoins: json.settings.totalCoins ?? 0,
        unlockedAvatarIds: json.settings.unlockedAvatarIds ?? [],
      });
      setCollectionOpen(true);
    } finally {
      setCollectionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
          <Skeleton className="ms-auto h-10 w-28" />
        </header>
        <div className="px-4">
          <Skeleton className="h-40" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
        <p className="text-sm text-white/50">{loadError ?? "خطا در بارگذاری"}</p>
      </header>
    );
  }

  const profile = data.profile as Record<string, unknown>;
  const wallet = data.wallet as Record<string, number>;
  const earnedMedals = (data.medals as EarnedMedalInput[]) ?? [];
  const stats = data.stats as Record<string, number>;
  const level = profile?.currentLevel as { nameFa: string } | null;
  const user = data.user as { phone?: string; role?: string } | null;
  const showGlobalRank =
    !userNeedsDisplayName(user?.phone ?? "", profile?.displayName as string | null) &&
    Boolean(profile?.globalRank);

  const showcaseSlug = profile?.showcaseSlug as string | null | undefined;
  const displayName = (profile?.displayName as string) ?? "پروفایل";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <Link
            href="/profile/settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="تنظیمات"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5" dir="ltr">
            <CoinsBalanceLink />
            <WalletHeaderLink className="h-9 w-9" />
            <InboxWhistleLink className="h-9 w-9" />
            {showcaseSlug ? (
              <PublicProfileLink slug={showcaseSlug} ariaLabel="اشتراک‌گذاری ویترین">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-bordin-orange/30 bg-bordin-orange/10 text-bordin-orange transition hover:bg-bordin-orange/20">
                  <Share2 className="h-4 w-4" />
                </span>
              </PublicProfileLink>
            ) : null}
          </div>
        </div>
      </header>

      <div className="space-y-6 px-4 py-4">
        <div className="flex items-start gap-4">
          <div className="flex shrink-0 flex-col items-center">
            <button
              type="button"
              onClick={() => void openAvatarCollection()}
              disabled={collectionLoading}
              className="rounded-full transition hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
              aria-label="باز کردن مجموعه آواتار"
            >
              <ProfileAvatar
                avatarUrl={profile?.avatarUrl as string | null}
                displayName={profile?.displayName as string}
                size="lg"
              />
            </button>
            <h1 className="mt-2 max-w-[9rem] truncate text-center text-base font-bold sm:max-w-[10rem] sm:text-lg">
              {displayName}
            </h1>
            {showGlobalRank ? (
              <p className="mt-1 whitespace-nowrap text-center text-xs text-white/50">
                رتبه جهانی:{" "}
                <span className="font-bold text-bordin-orange">
                  {formatPersianNumber(profile.globalRank as number)}
                </span>
              </p>
            ) : null}
          </div>
          <LevelBadge
            className="min-w-0 flex-1"
            levelName={level?.nameFa ?? "تماشاگر"}
            totalXp={profile?.totalXp as number ?? 0}
          />
        </div>

        {showcaseSlug ? (
          <PublicProfileLink
            slug={showcaseSlug}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-bordin-orange/30 bg-bordin-orange/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-bordin-orange/25"
          >
            <Trophy className="h-4 w-4 text-bordin-orange" />
            ویترین افتخارات من
          </PublicProfileLink>
        ) : null}

        <Link
          href="/profile/missions"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#f5b942]/35 bg-[#f5b942]/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#f5b942]/20"
        >
          <Target className="h-4 w-4 text-[#ffd54a]" />
          ماموریت‌ها
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/profile/predictions">
            <Button variant="outline" fullWidth className="h-auto gap-1.5 px-2 py-2.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              نتایج پیش‌بینی
            </Button>
          </Link>
          <Link href="/profile/teams">
            <Button variant="outline" fullWidth className="h-auto gap-1.5 px-2 py-2.5 text-xs">
              <Users className="h-3.5 w-3.5 shrink-0" />
              تیم‌های من
            </Button>
          </Link>
        </div>

        <CoinBreakdown
          predictionRewardCoins={wallet?.predictionRewardCoins ?? 0}
          systemRewardCoins={wallet?.systemRewardCoins ?? 0}
          purchasedCoins={wallet?.purchasedCoins ?? 0}
          cashBalanceToman={wallet?.cashBalanceToman}
        />

        <div className="grid grid-cols-3 gap-2">
          <StatBlock label="پیش‌بینی" value={stats?.totalPredictions ?? 0} />
          <StatBlock label="دقت ۱۰۰٪" value={stats?.perfectPredictions ?? 0} accent="text-bordin-green" />
          <StatBlock label="جام" value={stats?.cupsEntered ?? 0} />
        </div>

        <section>
          <h3 className="mb-3 font-bold">افتخارها</h3>
          <HonorsSlider earnedMedals={earnedMedals} />
        </section>

        <Link href="/invite">
          <Button variant="outline" fullWidth>
            <UserPlus className="h-4 w-4" />
            دعوت دوستان
          </Button>
        </Link>

        {(data.user as { role?: string })?.role === "admin" ? (
          <Link href="/admin">
            <Button variant="secondary" fullWidth>
              پنل ادمین
            </Button>
          </Link>
        ) : null}

        <Button
          variant="ghost"
          fullWidth
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
        >
          خروج از حساب
        </Button>
      </div>

      {collectionMeta ? (
        <AvatarCollectionModal
          open={collectionOpen}
          onClose={() => setCollectionOpen(false)}
          currentAvatarId={(profile?.avatarUrl as string | null) ?? null}
          totalCoins={collectionMeta.totalCoins}
          unlockedAvatarIds={collectionMeta.unlockedAvatarIds}
          onAvatarUpdated={() => {
            void load();
            setCollectionOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
