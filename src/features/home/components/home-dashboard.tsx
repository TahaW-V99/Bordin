"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { CompetitionCard } from "@/shared/components/competition/competition-card";
import { TeamCompetitionHomeSlider } from "@/features/home/components/team-competition-home-slider";
import { WeekDayStrip, type WeekDayItem } from "@/features/home/components/week-day-strip";
import { LeagueAccordionGroup } from "@/features/home/components/league-accordion-group";
import { DisplayNameRequiredModal } from "@/features/predictions/components/display-name-required-modal";
import {
  isWatchPartyPromoDismissed,
  WatchPartyPromoModal,
} from "@/features/watch-party/components/watch-party-promo-modal";
import {
  WATCH_PARTY_PROMO_START_MS,
  WATCH_PARTY_PROMO_WINDOW_MS,
} from "@/shared/constants/watch-party";
import { translateTeamNameToFa } from "@/shared/lib/football-names-fa";
import { isMatchResultKnown } from "@/shared/lib/match-result";
import Link from "next/link";
import { groupMatchesByLeague, userNeedsDisplayName } from "@/shared/lib/kandakator-utils";

type KandakatorDto = {
  id: string;
  title: string | null;
  date: string;
  entryFeeCoins: number;
  perfectReward: { coins: number; xp: number };
  matches: Array<{
    id: string;
    matchId: string;
    sortOrder: number;
    predictionCutoffMinutes: number;
    entryFeeCoins?: number;
    teamCompetitionBadges?: Array<{ id: string; titleFa: string; label: string }>;
    watchParty?: {
      roomId: string;
      matchId: string;
      capacity: number;
      entryFeeCoins: number;
      occupiedCount: number;
      hasJoined: boolean;
      buttonForceActive: boolean;
      uiPhase: "upcoming" | "active";
      googleMeetUrl: string | null;
    } | null;
    match: {
      id: string;
      homeTeamName: string;
      awayTeamName: string;
      leagueName: string | null;
      kickoffAt: string;
      status: string;
      homeScore: number | null;
      awayScore: number | null;
    };
    prediction: {
      homePrediction: number;
      awayPrediction: number;
      accuracyPercent: number | null;
      coinsEarned: number | null;
      xpEarned: number | null;
    } | null;
  }>;
};

export function HomeDashboard() {
  const searchParams = useSearchParams();
  const pendingWatchPartyMatchId = searchParams.get("watchParty");
  const highlightWatchParty = searchParams.get("highlightWatchParty") === "1";
  const [weekDays, setWeekDays] = useState<WeekDayItem[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [kandakator, setKandakator] = useState<KandakatorDto | null>(null);
  const [user, setUser] = useState<{
    phone: string;
    profile: { displayName: string | null; currentLevel: { nameFa: string } | null } | null;
    wallet: { predictionRewardCoins: number; systemRewardCoins: number; purchasedCoins: number } | null;
  } | null>(null);
  const [sliders, setSliders] = useState<{
    cups: Array<Record<string, unknown>>;
    tournaments: Array<Record<string, unknown>>;
    teamCompetitions: Array<Record<string, unknown>>;
  }>({ cups: [], tournaments: [], teamCompetitions: [] });
  const [loading, setLoading] = useState(true);
  const [kandakatorLoading, setKandakatorLoading] = useState(false);
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [autoOpenWatchPartyMatchId, setAutoOpenWatchPartyMatchId] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);

  useEffect(() => {
    if (highlightWatchParty || pendingWatchPartyMatchId) return;
    if (isWatchPartyPromoDismissed()) return;

    const now = Date.now();
    const promoEnd = WATCH_PARTY_PROMO_START_MS + WATCH_PARTY_PROMO_WINDOW_MS;
    if (now < WATCH_PARTY_PROMO_START_MS || now > promoEnd) return;

    setPromoOpen(true);
  }, [highlightWatchParty, pendingWatchPartyMatchId]);

  useEffect(() => {
    if (pendingWatchPartyMatchId) {
      setAutoOpenWatchPartyMatchId(pendingWatchPartyMatchId);
    }
  }, [pendingWatchPartyMatchId]);

  const loadKandakator = useCallback(async (date: string) => {
    setKandakatorLoading(true);
    const res = await fetch(`/api/kandakator?date=${date}`, { cache: "no-store" });
    const data = await res.json();
    setKandakator(data.kandakator ?? null);
    setKandakatorLoading(false);
  }, []);

  const needsScorePolling = useMemo(() => {
    if (!kandakator) return false;
    const now = Date.now();
    return kandakator.matches.some((row) => {
      const kickoffPassed = new Date(row.match.kickoffAt).getTime() <= now;
      const missingScore = !isMatchResultKnown(row.match);
      const active =
        row.match.status !== "POSTPONED" && row.match.status !== "CANCELLED";
      return kickoffPassed && missingScore && active;
    });
  }, [kandakator]);

  useEffect(() => {
    if (!needsScorePolling || !selectedDate) return;

    const pollId = setInterval(() => {
      void loadKandakator(selectedDate);
    }, 30_000);

    return () => clearInterval(pollId);
  }, [needsScorePolling, selectedDate, loadKandakator]);

  const load = useCallback(async () => {
    setLoading(true);
    setKandakatorLoading(true);

    const [weekRes, uRes, sRes, kRes] = await Promise.all([
      fetch("/api/kandakator/week", { cache: "no-store" }),
      fetch("/api/user/me", { cache: "no-store" }),
      fetch("/api/competitions/home", { cache: "no-store" }),
      fetch("/api/kandakator/today", { cache: "no-store" }),
    ]);

    const weekData = await weekRes.json();
    const days = weekData.days as WeekDayItem[];
    const initialDate = days.find((day) => day.isToday)?.date ?? days[0]?.date ?? "";

    const uData = await uRes.json();
    const sData = await sRes.json();
    const kData = await kRes.json();

    setWeekDays(days);
    setSelectedDate(initialDate);
    setUser(uData.user);
    setSliders({
      cups: Array.isArray(sData.cups) ? sData.cups : [],
      tournaments: Array.isArray(sData.tournaments) ? sData.tournaments : [],
      teamCompetitions: Array.isArray(sData.teamCompetitions) ? sData.teamCompetitions : [],
    });
    setKandakator(kData.kandakator ?? null);
    setLoading(false);
    setKandakatorLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSelectDay = async (date: string) => {
    setSelectedDate(date);
    await loadKandakator(date);
  };

  const needsDisplayName = user
    ? userNeedsDisplayName(user.phone, user.profile?.displayName)
    : false;

  const leagueGroups = kandakator ? groupMatchesByLeague(kandakator.matches) : [];

  return (
    <>
      <PageHeader
        title="بُردین"
        subtitle={
          user?.profile?.currentLevel
            ? `${user.profile.displayName ?? user.phone} · ${user.profile.currentLevel.nameFa}`
            : "پیش‌بینی فوتبال"
        }
      />

      <div className="space-y-6 px-4 py-4">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-bordin-orange" />
            <h2 className="text-base font-bold">کنداکتور پیش‌بینی روزانه</h2>
          </div>

          {loading ? (
            <Skeleton className="h-16" />
          ) : (
            <WeekDayStrip
              days={weekDays}
              selectedDate={selectedDate}
              onSelect={onSelectDay}
            />
          )}

          {kandakatorLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          ) : !kandakator ? (
            <EmptyState
              icon={CalendarDays}
              title="برای این روز مسابقه‌ای ثبت نشده"
              description="روز دیگری را انتخاب کنید یا بعداً سر بزنید."
            />
          ) : (
            <>
              <div className="space-y-3">
                {leagueGroups.map((group, index) => (
                  <LeagueAccordionGroup
                    key={group.leagueName}
                    leagueName={group.leagueName}
                    matches={group.matches}
                    kandakatorId={kandakator.id}
                    entryFeeCoins={kandakator.entryFeeCoins}
                    perfectReward={kandakator.perfectReward}
                    needsDisplayName={needsDisplayName}
                    onDisplayNameRequired={() => setNameModalOpen(true)}
                    onSubmitted={() => {
                      if (selectedDate) {
                        void loadKandakator(selectedDate);
                      } else {
                        void load();
                      }
                    }}
                    autoOpenWatchPartyMatchId={autoOpenWatchPartyMatchId}
                    onWatchPartyAutoOpened={() => setAutoOpenWatchPartyMatchId(null)}
                    highlightWatchParty={highlightWatchParty}
                    defaultOpen={index === 0}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {sliders.cups.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">جام‌های ویژه</h2>
              <Link href="/competitions" className="text-xs text-bordin-orange">
                همه
              </Link>
            </div>
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {sliders.cups.map((cup) => (
                <CompetitionCard
                  key={cup.id as string}
                  href={`/competitions/cups/${cup.id}`}
                  title={cup.titleFa as string}
                  subtitle={
                    (cup.match as { homeTeamName: string; awayTeamName: string })?.homeTeamName
                      ? `${translateTeamNameToFa((cup.match as { homeTeamName: string }).homeTeamName)} vs ${translateTeamNameToFa((cup.match as { awayTeamName: string }).awayTeamName)}`
                      : undefined
                  }
                  fee={cup.entryFeeCoins as number}
                  mode={cup.mode as string}
                />
              ))}
            </div>
          </section>
        )}

        {sliders.tournaments.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">تورنمنت‌ها</h2>
              <Link href="/competitions" className="text-xs text-bordin-orange">
                همه
              </Link>
            </div>
            <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
              {sliders.tournaments.map((t) => (
                <CompetitionCard
                  key={t.id as string}
                  href={`/competitions/tournaments/${t.id}`}
                  title={t.nameFa as string}
                  subtitle={t.description as string}
                  fee={t.registrationFeeCoins as number}
                />
              ))}
            </div>
          </section>
        )}

        {sliders.teamCompetitions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">رقابت‌های تیمی</h2>
              <Link href="/competitions?tab=teams&filter=upcoming" className="text-xs text-bordin-orange">
                مشاهده همه
              </Link>
            </div>
            <TeamCompetitionHomeSlider items={sliders.teamCompetitions} />
          </section>
        )}
      </div>

      <DisplayNameRequiredModal
        open={nameModalOpen}
        onClose={() => setNameModalOpen(false)}
      />

      <WatchPartyPromoModal open={promoOpen} onDismiss={() => setPromoOpen(false)} />
    </>
  );
}
