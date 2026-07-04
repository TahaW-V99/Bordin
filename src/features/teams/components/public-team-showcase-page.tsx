"use client";

import Image from "next/image";
import Link from "next/link";
import { Medal, Trophy, Users } from "lucide-react";
import { AppBackButton } from "@/shared/components/navigation/app-back-button";
import { HonorsSlider } from "@/shared/components/profile/honors-slider";
import { StatBlock } from "@/shared/components/ui/stat-block";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { PublicTeamShowcaseData } from "@/shared/types/public-team-showcase";
import { type EarnedMedalInput } from "@/shared/lib/honors";

function SectionTitle({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof Trophy;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-5 w-5 shrink-0 text-bordin-orange" />
      <h2 className="font-bold text-white">{title}</h2>
    </div>
  );
}

export function PublicTeamShowcasePage({
  team,
  backHref = "/home",
}: {
  team: PublicTeamShowcaseData;
  backHref?: string;
}) {
  const teamMedals = team.medals.filter(
    (medal) =>
      medal.medal?.slug &&
      ["team-qahraman", "team-raqib"].includes(medal.medal.slug),
  ) as EarnedMedalInput[];

  return (
    <div className="min-h-dvh bg-black text-white">
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <AppBackButton fallbackHref={backHref} ariaLabel="بازگشت" />
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] text-bordin-orange">ویترین تیم</p>
            <h1 className="truncate text-base font-bold">{team.name}</h1>
          </div>
          <div className="h-10 w-10 shrink-0" aria-hidden />
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-5 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {team.isSuspended ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
            این تیم موقتاً تعلیق شده است.
          </div>
        ) : null}

        <section className="rounded-2xl border border-bordin-orange/25 bg-gradient-to-br from-bordin-orange/10 via-white/[0.03] to-transparent p-4 text-center">
          {team.logoUrl ? (
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
              <Image
                src={team.logoUrl}
                alt=""
                width={72}
                height={72}
                className="rounded-xl object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5 text-sm text-white/35">
              تیم
            </div>
          )}
          <h2 className="text-lg font-bold">{team.name}</h2>
          <p className="mt-1 text-sm text-white/50">
            {formatPersianNumber(team.memberCount)} / {formatPersianNumber(team.capacity)} عضو
          </p>
        </section>

        <div className="grid grid-cols-3 gap-2">
          <StatBlock label="رقابت‌ها" value={team.competitionCount} />
          <StatBlock
            label="رتبه تیمی"
            value={team.leaderboardRank ? team.leaderboardRank : "—"}
            accent="text-bordin-orange"
          />
          <StatBlock
            label="امتیاز تیمی"
            value={
              team.leaderboardTotalPoints != null
                ? team.leaderboardTotalPoints
                : "—"
            }
            accent="text-bordin-green"
          />
        </div>

        <section className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
          <SectionTitle title="اعضای تیم" icon={Users} />
          <div className="space-y-2">
            {team.members.map((member) => {
              const content = (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <div className="min-w-0 text-start">
                    <p className="truncate font-semibold text-white">{member.name}</p>
                    <p className="mt-0.5 text-[11px] text-white/45">{member.roleFa}</p>
                  </div>
                  <div className="shrink-0 text-end text-[11px] text-white/45">
                    <p>
                      رتبه{" "}
                      {member.globalRank ? formatPersianNumber(member.globalRank) : "—"}
                    </p>
                    <p className="mt-0.5 text-bordin-green">
                      {formatPersianNumber(member.totalXp)} امتیاز
                    </p>
                  </div>
                </div>
              );

              if (member.showcaseSlug) {
                return (
                  <Link
                    key={member.userId}
                    href={`/showcase/${member.showcaseSlug}`}
                    className="block transition hover:opacity-90"
                  >
                    {content}
                  </Link>
                );
              }

              return <div key={member.userId}>{content}</div>;
            })}
          </div>
        </section>

        {team.competitions.length > 0 ? (
          <section className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
            <SectionTitle title="رقابت‌های تیمی" icon={Trophy} />
            <div className="space-y-2">
              {team.competitions.map((competition) => (
                <div
                  key={competition.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-white">
                    {competition.titleFa}
                  </span>
                  <span className="shrink-0 text-[11px] text-white/45">
                    {formatPersianNumber(competition.rankingScore)} امتیاز
                  </span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionTitle title="افتخارات تیم" icon={Medal} />
          {teamMedals.length > 0 ? (
            <HonorsSlider earnedMedals={teamMedals} />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-white/45">
              هنوز مدال تیمی ثبت نشده است.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
