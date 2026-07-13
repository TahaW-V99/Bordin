"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Award,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Coins,
  Flag,
  Medal,
  ScrollText,
  Target,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatPersianNumber, formatTehranDateTime, formatCountdown } from "@/shared/lib/dates";
import { resolveTeamCompetitionBannerUrl } from "@/shared/lib/team-competition-banner";
import { TeamCompetitionLeaderboard } from "@/features/competitions/components/team-competition-leaderboard";
import { TeamCompetitionBracket } from "@/features/competitions/components/team-competition-bracket";
import { TeamCompetitionChampionshipHero } from "@/features/competitions/components/team-competition-championship-hero";

type DetailTab = "info" | "ranking" | "knockout";

const stageLabel: Record<string, string> = {
  REGISTRATION: "ثبت‌نام",
  RANKING: "رده‌بندی",
  KNOCKOUT: "حذفی",
  FINISHED: "پایان‌یافته",
};

function formatRemaining(endIso: string | null | undefined) {
  if (!endIso) return null;
  const diff = new Date(endIso).getTime() - Date.now();
  if (diff <= 0) return "پایان یافته";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${formatPersianNumber(hours)} ساعت و ${formatPersianNumber(minutes)} دقیقه`;
}

export function TeamCompetitionDetail({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [comp, setComp] = useState<Record<string, unknown> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Record<string, unknown> | null>(null);
  const [bracket, setBracket] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<DetailTab>("info");
  const [loading, setLoading] = useState(true);
  const [rankingCountdown, setRankingCountdown] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [compRes, lbRes, brRes] = await Promise.all([
      fetch(`/api/team-competitions/${competitionId}`),
      fetch(`/api/team-competitions/${competitionId}/leaderboard`),
      fetch(`/api/team-competitions/${competitionId}/leaderboard?view=bracket`),
    ]);
    const compData = await compRes.json();
    const lbData = await lbRes.json();
    const brData = await brRes.json();
    setComp(compData.competition ?? null);
    setLeaderboard(lbData.leaderboard ?? null);
    setBracket(brData.bracket ?? null);
    setLoading(false);
  }, [competitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rankingEndsAt = comp?.rankingEndsAt as string | undefined;
  const compStage = comp?.stage as string | undefined;
  const showLiveRankingCountdown =
    compStage === "RANKING" &&
    rankingEndsAt &&
    new Date(rankingEndsAt).getTime() - Date.now() <= 60 * 60 * 1000 &&
    new Date(rankingEndsAt).getTime() > Date.now();

  useEffect(() => {
    if (!showLiveRankingCountdown || !rankingEndsAt) {
      setRankingCountdown("");
      return;
    }
    const tick = () => {
      const diff = new Date(rankingEndsAt).getTime() - Date.now();
      setRankingCountdown(diff > 0 ? formatCountdown(diff) : "");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [showLiveRankingCountdown, rankingEndsAt]);

  const defaultTab = useMemo((): DetailTab => {
    const q = searchParams.get("tab");
    if (q === "ranking" || q === "knockout" || q === "info") return q;
    if (!comp) return "info";
    if (comp.stage === "FINISHED") return "knockout";
    if (comp.isRegistered) return "ranking";
    return "info";
  }, [searchParams, comp]);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  const fromChat = searchParams.get("from") === "chat";

  const setDetailTab = (next: DetailTab) => {
    setTab(next);
    const fromQuery = fromChat ? "&from=chat" : "";
    router.replace(`/competitions/teams/${competitionId}?tab=${next}${fromQuery}`, {
      scroll: false,
    });
  };

  if (loading || !comp) {
    return (
      <>
        <PageHeader title="رقابت تیمی" />
        <Skeleton className="mx-4 h-48" />
      </>
    );
  }

  const stage = comp.stage as string;
  const isFinished = stage === "FINISHED";
  const isRegistration = stage === "REGISTRATION";
  const canRegister = isRegistration && !comp.isRegistered;
  const registeredTeam = comp.registeredTeam as Record<string, unknown> | null;
  const lbRows = (leaderboard?.rows ?? []) as Array<{
    rank: number;
    teamId: string;
    teamName: string;
    logoUrl: string | null;
    rankingScore: number | null;
    isMine: boolean;
  }>;

  const bracketTeams = (bracket?.teams ?? []) as Array<{
    entryId?: string;
    id: string;
    name: string;
    logoUrl: string | null;
  }>;
  const championTeam = bracket?.winnerEntryId
    ? (bracketTeams.find((team) => team.entryId === bracket.winnerEntryId) ?? null)
    : null;
  const runnerUpTeam = bracket?.runnerUpEntryId
    ? (bracketTeams.find((team) => team.entryId === bracket.runnerUpEntryId) ?? null)
    : null;

  const competitionMedals = (comp.medals ?? []) as Array<{ titleFa: string; placement: string }>;
  const winnerMedalTitles = competitionMedals
    .filter((medal) => medal.placement === "WINNER")
    .map((medal) => medal.titleFa);
  const runnerUpMedalTitles = competitionMedals
    .filter((medal) => medal.placement === "RUNNER_UP")
    .map((medal) => medal.titleFa);

  const bannerSrc = resolveTeamCompetitionBannerUrl(comp.bannerUrl as string | null | undefined);

  const rankingRemaining =
    stage === "REGISTRATION"
      ? formatRemaining(comp.rankingStartsAt as string)
      : stage === "RANKING"
        ? (() => {
            const rem = formatRemaining(comp.rankingEndsAt as string);
            return rem === "پایان یافته" ? "مرحله رده‌بندی پایان یافته" : rem;
          })()
        : null;

  return (
    <>
      <PageHeader title={comp.titleFa as string} />
      <div className="space-y-4 px-4 py-4">
        {bannerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerSrc}
            alt=""
            width={156}
            height={193}
            className="mx-auto h-[193px] w-[156px] rounded-xl object-cover"
          />
        ) : null}

        {registeredTeam ? (
          <div className="rounded-xl border border-bordin-green/20 bg-bordin-green/5 p-4">
            <p className="font-bold text-bordin-green">تیم شما: {registeredTeam.name as string}</p>
            {registeredTeam.rankingScore != null ? (
              <p className="mt-1 text-sm text-white/50">
                امتیاز رده‌بندی: {formatPersianNumber(registeredTeam.rankingScore as number)}
              </p>
            ) : null}
          </div>
        ) : null}

        {!isFinished ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <Chip active={tab === "info"} onClick={() => setDetailTab("info")}>
              اطلاعات
            </Chip>
            <Chip active={tab === "ranking"} onClick={() => setDetailTab("ranking")}>
              مرحله رده‌بندی
            </Chip>
            <Chip active={tab === "knockout"} onClick={() => setDetailTab("knockout")}>
              مرحله حذفی
            </Chip>
          </div>
        ) : null}

        {tab === "info" && !isFinished ? (
          <Card>
            <CardContent className="space-y-3 pt-4 text-sm leading-7">
              <InfoRow icon={Activity} label="وضعیت" value={stageLabel[stage] ?? stage} />
              {comp.description ? (
                <FormatAccordion title="شیوه برگزاری" content={comp.description as string} />
              ) : null}
              <InfoRow
                icon={Users}
                label="ظرفیت"
                value={`${formatPersianNumber(comp.entryCount as number)} / ${formatPersianNumber(comp.teamCapacity as number)} تیم`}
              />
              <InfoRow
                icon={UserRound}
                label="اندازه تیم"
                value={`${formatPersianNumber(comp.minTeamSize as number)} تا ${formatPersianNumber(comp.maxTeamSize as number)} نفر`}
              />
              {isRegistration ? (
                <InfoRow
                  icon={CalendarClock}
                  label="ددلاین ثبت‌نام"
                  value={formatTehranDateTime(comp.registrationDeadline as string)}
                />
              ) : null}
              <InfoRow
                icon={Coins}
                label="هزینه ثبت‌نام"
                value={`${formatPersianNumber(comp.registrationFeePerMember as number)} سکه / عضو`}
              />
              <InfoRow
                icon={Target}
                label="هزینه پیش‌بینی رده‌بندی"
                value={`${formatPersianNumber(comp.rankingPredictionFeePerMember as number)} سکه / عضو`}
              />
              <InfoRow
                icon={Trophy}
                label="جایزه قهرمان"
                value={`${formatPersianNumber(comp.winnerCoinReward as number)} سکه / عضو`}
              />
              <InfoRow
                icon={Award}
                label="جایزه نایب قهرمان"
                value={`${formatPersianNumber(comp.runnerUpCoinReward as number)} سکه / عضو`}
              />
              {(comp.medals as Array<{ titleFa: string; placement: string }>)?.length ? (
                <InfoRow
                  icon={Medal}
                  label="مدال‌ها"
                  value={(comp.medals as Array<{ titleFa: string }>).map((m) => m.titleFa).join("، ")}
                />
              ) : null}
              <InfoRow
                icon={CalendarDays}
                label="تاریخ انتشار"
                value={formatTehranDateTime(comp.createdAt as string)}
              />
              {comp.knockoutEndsAt ? (
                <InfoRow
                  icon={Flag}
                  label="پایان رقابت"
                  value={formatTehranDateTime(comp.knockoutEndsAt as string)}
                />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {isFinished ? (
          <TeamCompetitionChampionshipHero
            champion={championTeam}
            runnerUp={runnerUpTeam}
            winnerCoinReward={Number(comp.winnerCoinReward ?? 0)}
            runnerUpCoinReward={Number(comp.runnerUpCoinReward ?? 0)}
            winnerMedalTitles={winnerMedalTitles}
            runnerUpMedalTitles={runnerUpMedalTitles}
          />
        ) : null}

        {tab === "ranking" && !isFinished ? (
          <section className="space-y-4">
            <div className="rounded-xl border border-white/8 p-4 text-sm">
              <p className="font-bold">{comp.titleFa as string}</p>
              <p className="mt-2 text-white/55">
                {formatPersianNumber(lbRows.length)} تیم در این مرحله
              </p>
              <p className="mt-1 text-bordin-orange">
                {stage === "RANKING" && rankingRemaining === "پایان یافته"
                  ? "مرحله رده‌بندی پایان یافته"
                  : `زمان باقی‌مانده: ${rankingRemaining ?? "—"}`}
              </p>
              {showLiveRankingCountdown && rankingCountdown ? (
                <p className="mt-2 text-sm font-semibold text-red-500 tabular-nums">
                  {rankingCountdown}
                </p>
              ) : null}
            </div>
            <TeamCompetitionLeaderboard
              rows={lbRows}
              myTeamId={(leaderboard?.myTeamId as string) ?? null}
              stage={stage}
              competitionId={competitionId}
            />
          </section>
        ) : null}

        {tab === "knockout" || isFinished ? (
          <section className={isFinished ? "space-y-4 pt-2" : "space-y-4"}>
            {!isFinished ? (
              <div className="rounded-xl border border-white/8 p-4 text-sm">
                <p className="font-bold">{comp.titleFa as string}</p>
                <p className="mt-2 text-white/55">
                  {formatPersianNumber((bracket?.teams as unknown[])?.length ?? 0)} تیم
                </p>
                {comp.currentStageEndsAt ? (
                  <p className="mt-1 text-white/45">
                    پایان مرحله فعلی رقابت: {formatTehranDateTime(comp.currentStageEndsAt as string)}
                  </p>
                ) : null}
              </div>
            ) : null}
            <TeamCompetitionBracket
              competitionId={competitionId}
              fixtures={
                (bracket?.fixtures ?? []) as Array<{
                  id: string;
                  roundType: "ONE_SIXTEENTH" | "ONE_EIGHTH" | "ONE_QUARTER" | "FINAL";
                  waveIndex: number;
                  bracketSide: "LEFT" | "RIGHT" | null;
                  fixtureIndex: number;
                  entryAScore: number;
                  entryBScore: number;
                  resolved: boolean;
                  winnerTeamId: string | null;
                  left: {
                    id: string;
                    name: string;
                    logoUrl: string | null;
                    score: number;
                    isEliminated: boolean;
                  } | null;
                  right: {
                    id: string;
                    name: string;
                    logoUrl: string | null;
                    score: number;
                    isEliminated: boolean;
                  } | null;
                }>
              }
              teams={
                (bracket?.teams ?? []) as Array<{
                  id: string;
                  entryId?: string;
                  name: string;
                  logoUrl: string | null;
                  score: number;
                  isEliminated: boolean;
                  seedRank?: number | null;
                }>
              }
              teamCapacity={(bracket?.teamCapacity as 8 | 16 | 32) ?? 8}
              winnerTeamId={
                bracket?.winnerEntryId
                  ? (
                      (bracket?.teams as Array<{ entryId?: string; id: string }>) ?? []
                    ).find((t) => t.entryId === bracket?.winnerEntryId)?.id ?? null
                  : null
              }
            />
          </section>
        ) : null}

        {canRegister ? (
          <Link href={`/competitions/teams/${competitionId}/register`}>
            <Button fullWidth>ثبت‌نام</Button>
          </Link>
        ) : null}

        <Button
          variant="ghost"
          fullWidth
          onClick={() => router.push(fromChat ? "/chat/competitions" : "/competitions?tab=teams")}
        >
          بازگشت
        </Button>
      </div>
    </>
  );
}

function FormatAccordion({ title, content }: { title: string; content: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5 pb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-right"
      >
        <span className="flex items-center gap-1.5 text-bordin-orange">
          <ScrollText className="h-3.5 w-3.5 shrink-0" />
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-bordin-orange transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/75">{content}</p>
      ) : null}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 pb-2 last:border-0">
      <span className="flex items-center gap-1.5 text-bordin-orange">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
      <span className="text-left font-medium">{value}</span>
    </div>
  );
}
