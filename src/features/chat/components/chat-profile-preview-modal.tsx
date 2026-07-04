"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { LevelBadge } from "@/shared/components/profile/level-badge";
import { HonorsSlider } from "@/shared/components/profile/honors-slider";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { PublicProfileData } from "@/shared/types/public-profile";

export function ChatProfilePreviewModal({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/profile/${slug}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "خطا");
        setProfile(data.profile as PublicProfileData);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطا"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="بستن"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0a0a] shadow-2xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/8 bg-[#0a0a0a]/95 px-4 py-3 backdrop-blur">
          <h2 className="text-sm font-bold text-white">پروفایل بازیکن</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="mx-auto h-20 w-20 rounded-2xl" />
              <Skeleton className="h-8" />
              <Skeleton className="h-24" />
            </div>
          ) : error || !profile ? (
            <p className="py-8 text-center text-sm text-white/50">{error ?? "پروفایل یافت نشد"}</p>
          ) : (
            <div className="space-y-4 text-center">
              <ProfileAvatar
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName}
                size="lg"
                className="mx-auto"
              />
              <div>
                <h3 className="text-lg font-bold text-white">{profile.displayName}</h3>
                {profile.level ? (
                  <LevelBadge
                    levelName={profile.level}
                    totalXp={profile.totalXp}
                    className="mt-2"
                  />
                ) : null}
                {profile.globalRank ? (
                  <p className="mt-2 text-xs text-yellow-300">
                    رتبه جهانی {formatPersianNumber(profile.globalRank)}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2 py-2">
                  <p className="font-bold text-white">
                    {formatPersianNumber(profile.stats.totalPredictions)}
                  </p>
                  <p className="text-white/40">پیش‌بینی</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2 py-2">
                  <p className="font-bold text-bordin-green">
                    {formatPersianNumber(profile.stats.perfectPredictions)}
                  </p>
                  <p className="text-white/40">۱۰۰٪</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-2 py-2">
                  <p className="font-bold text-bordin-orange">
                    {profile.stats.accuracyPercent != null
                      ? `${formatPersianNumber(profile.stats.accuracyPercent)}٪`
                      : "—"}
                  </p>
                  <p className="text-white/40">دقت</p>
                </div>
              </div>

              {profile.medals.length > 0 ? (
                <HonorsSlider earnedMedals={profile.medals} />
              ) : null}

              <Link href={`/showcase/${slug}`} className="block">
                <Button variant="outline" className="w-full">
                  مشاهده ویترین کامل
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
