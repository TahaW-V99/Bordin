"use client";

import { useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Copy, Medal, Share2, Swords, Trophy, Users } from "lucide-react";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { LevelBadge } from "@/shared/components/profile/level-badge";
import { HonorsSlider } from "@/shared/components/profile/honors-slider";
import { StatBlock } from "@/shared/components/ui/stat-block";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { useScrollRestore } from "@/shared/hooks/use-scroll-restore";
import { formatPersianNumber, formatTehranDate } from "@/shared/lib/dates";
import { buildPublicProfileUrl, saveScrollPosition } from "@/shared/lib/public-profile-navigation";
import {
  PUBLIC_PROFILE_SHARE_MESSAGE,
  publicTeamShowcaseHref,
  type PublicProfileData,
} from "@/shared/types/public-profile";
import { type EarnedMedalInput } from "@/shared/lib/honors";

function ShowcaseStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
      <p className={`text-lg font-bold tabular-nums ${accent ?? "text-white"}`}>
        {typeof value === "number" ? formatPersianNumber(value) : value}
      </p>
      <p className="mt-1 text-[11px] text-white/45">{label}</p>
    </div>
  );
}

function SectionTitle({
  title,
  icon: Icon,
  trailing,
}: {
  title: string;
  icon: typeof Trophy;
  trailing?: React.ReactNode;
}) {
  return (
    <div className={`mb-3 flex items-center gap-2 ${trailing ? "justify-between" : ""}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-bordin-orange" />
        <h2 className="font-bold text-white">{title}</h2>
      </div>
      {trailing}
    </div>
  );
}

export function PublicProfilePage({
  profile,
  slug,
}: {
  profile: PublicProfileData;
  slug: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  useScrollRestore();
  const shareUrl = buildPublicProfileUrl(slug);
  const teams = profile.teams ?? [];

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/home");
  };

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("لینک پروفایل کپی شد", "success");
    } catch {
      toast("کپی لینک ممکن نشد", "error");
    }
  }, [shareUrl, toast]);

  const shareProfile = useCallback(async () => {
    const payload = {
      title: `پروفایل ${profile.displayName} | بُردین`,
      text: PUBLIC_PROFILE_SHARE_MESSAGE,
      url: shareUrl,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(payload);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${PUBLIC_PROFILE_SHARE_MESSAGE}\n${shareUrl}`);
      toast("متن و لینک اشتراک‌گذاری کپی شد", "success");
    } catch {
      toast("اشتراک‌گذاری ممکن نشد", "error");
    }
  }, [profile.displayName, shareUrl, toast]);

  const { stats } = profile;

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="flex min-h-10 min-w-0 flex-1 items-center justify-center text-center">
            <p className="text-lg font-bold text-bordin-orange sm:text-xl">ویترین افتخارات</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
              aria-label="کپی لینک"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void shareProfile()}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-bordin-orange/30 bg-bordin-orange/10 text-bordin-orange transition hover:bg-bordin-orange/20"
              aria-label="اشتراک‌گذاری"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <section className="relative overflow-hidden rounded-2xl border border-bordin-orange/25 bg-gradient-to-br from-bordin-orange/10 via-white/[0.03] to-transparent p-4">
          <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-bordin-orange/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex shrink-0 flex-col items-start">
              <ProfileAvatar
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName}
                size="lg"
                className="ring-2 ring-bordin-orange/30"
              />
              <p className="mt-2 max-w-[7.5rem] truncate text-start text-sm font-bold text-white sm:max-w-[9rem]">
                {profile.displayName}
              </p>
              <p className="mt-1 whitespace-nowrap text-start text-[11px] leading-5 text-white/50">
                تاریخ عضویت:{" "}
                <span className="font-semibold text-white/80">
                  {formatTehranDate(profile.joinedAt)}
                </span>
              </p>
            </div>
            <LevelBadge
              className="min-w-0 flex-1 border-bordin-orange/30 bg-black/20"
              levelName={profile.level ?? "تماشاگر"}
              totalXp={profile.totalXp}
            />
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <ShowcaseStat label="امتیاز کل" value={profile.totalXp} accent="text-bordin-green" />
            <ShowcaseStat
              label="رتبه جهانی"
              value={profile.globalRank ? profile.globalRank : "—"}
              accent="text-bordin-orange"
            />
          </div>
        </section>

        {teams.length > 0 ? (
          <section className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <SectionTitle title="تیم" icon={Users} />
            <div className="space-y-2">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  href={publicTeamShowcaseHref(team)}
                  scroll={false}
                  onClick={() => saveScrollPosition()}
                  className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 transition hover:border-bordin-orange/30 hover:bg-bordin-orange/5"
                >
                  {team.logoUrl ? (
                    <Image
                      src={team.logoUrl}
                      alt=""
                      width={36}
                      height={36}
                      className="h-9 w-9 shrink-0 rounded-lg object-contain"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-white/35">
                      تیم
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-semibold text-white">{team.name}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle title="کارنامه پیش‌بینی" icon={Trophy} />
          <div className="grid grid-cols-3 gap-2">
            <StatBlock label="پیش‌بینی" value={stats.totalPredictions} />
            <StatBlock label="دقت ۱۰۰٪" value={stats.perfectPredictions} accent="text-bordin-green" />
            <StatBlock
              label="دقت کلی"
              value={stats.accuracyPercent != null ? `${formatPersianNumber(stats.accuracyPercent)}٪` : "—"}
              accent="text-bordin-orange"
            />
          </div>
        </section>

        <section>
          <SectionTitle title="رقابت‌ها" icon={Swords} />
          <div className="grid grid-cols-3 gap-2">
            <StatBlock label="جام" value={stats.cupsEntered} />
            <StatBlock label="تورنمنت" value={stats.tournamentsEntered} />
            <StatBlock label="تیمی" value={stats.teamCompetitionsEntered} />
          </div>
        </section>

        <section>
          <SectionTitle
            title="ویترین مدال‌ها"
            icon={Medal}
            trailing={
              <span className="rounded-full bg-bordin-orange/15 px-2.5 py-1 text-[11px] text-bordin-orange">
                {formatPersianNumber(profile.medals.length)} مدال
              </span>
            }
          />
          {profile.medals.length > 0 ? (
            <HonorsSlider earnedMedals={profile.medals as EarnedMedalInput[]} />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/45">
              هنوز مدالی ثبت نشده است.
            </div>
          )}
        </section>

        <Button variant="outline" fullWidth onClick={() => void shareProfile()}>
          <Share2 className="h-4 w-4" />
          اشتراک‌گذاری پروفایل
        </Button>
      </div>
    </div>
  );
}
