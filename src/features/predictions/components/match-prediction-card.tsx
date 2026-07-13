"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import {
  formatTehranTime,
  formatCountdown,
  effectivePredictionCutoffMinutes,
  getPredictionDeadlineInstant,
  getRemainingMs,
  getRemainingMsUntilPredictionDeadline,
  formatPersianNumber,
} from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { isMatchFinishedForDisplay, isMatchResultKnown, hasKickoffPassed } from "@/shared/lib/match-result";
import { calculatePredictionAccuracy } from "@/shared/lib/prediction-accuracy";
import { Clock, Minus, Plus, Users } from "lucide-react";
import {
  WatchPartyButton,
  type WatchPartyCardState,
} from "@/features/watch-party/components/watch-party-button";
import { WatchPartyJoinModal } from "@/features/watch-party/components/watch-party-join-modal";

interface MatchData {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string | null;
  kickoffAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}

interface PredictionData {
  homePrediction: number;
  awayPrediction: number;
  accuracyPercent: number | null;
  coinsEarned: number | null;
  xpEarned: number | null;
}

type TeamCompetitionBadge = {
  id: string;
  titleFa: string;
  label: string;
};

type KnockoutUiState = {
  role: "captain" | "member";
  message: string | null;
  canSubmit: boolean;
};

type KnockoutCoverPreview = {
  shortfallMembers: Array<{ userId: string; name: string }>;
  feePerMember: number;
};

function PredictionResultGrid({
  prediction,
  homeScore,
  awayScore,
  resultKnown,
}: {
  prediction: PredictionData;
  homeScore: number | null;
  awayScore: number | null;
  resultKnown: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-xl border border-bordin-green/20 bg-bordin-green/5 px-3 py-3 text-center">
        <p className="text-bordin-green/80">پیش‌بینی شما</p>
        <p className="mt-1 text-lg font-bold tabular-nums">
          {formatPersianNumber(prediction.homePrediction)} -{" "}
          {formatPersianNumber(prediction.awayPrediction)}
        </p>
      </div>
      <div
        className={cn(
          "rounded-xl px-3 py-3 text-center",
          resultKnown
            ? "border border-bordin-orange/35 bg-bordin-orange/10"
            : "border border-white/10 bg-white/5",
        )}
      >
        <p className={resultKnown ? "text-white/55" : "text-white/45"}>نتیجه بازی</p>
        <p
          className={cn(
            "mt-1 text-lg font-bold tabular-nums",
            resultKnown ? "text-bordin-orange" : "text-white/40",
          )}
        >
          {resultKnown
            ? `${formatPersianNumber(homeScore!)} - ${formatPersianNumber(awayScore!)}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

export function MatchPredictionCard({
  matchId,
  kandakatorId,
  match,
  entryFeeCoins,
  teamCompetitionBadges,
  knockoutUiState,
  watchParty,
  predictionCutoffMinutes,
  existingPrediction,
  perfectReward,
  needsDisplayName,
  onDisplayNameRequired,
  onSubmitted,
  autoOpenWatchParty,
  onWatchPartyAutoOpened,
}: {
  matchId: string;
  kandakatorId: string;
  match: MatchData;
  entryFeeCoins: number;
  teamCompetitionBadges?: TeamCompetitionBadge[];
  knockoutUiState?: KnockoutUiState | null;
  watchParty?: WatchPartyCardState | null;
  predictionCutoffMinutes: number;
  existingPrediction: PredictionData | null;
  perfectReward?: { coins: number; xp: number };
  needsDisplayName?: boolean;
  onDisplayNameRequired?: () => void;
  onSubmitted: () => void;
  autoOpenWatchParty?: boolean;
  onWatchPartyAutoOpened?: () => void;
}) {
  const { toast } = useToast();
  const [home, setHome] = useState(existingPrediction?.homePrediction ?? 0);
  const [away, setAway] = useState(existingPrediction?.awayPrediction ?? 0);
  const [localPrediction, setLocalPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [coverModal, setCoverModal] = useState<KnockoutCoverPreview | null>(null);
  const [watchPartyOpen, setWatchPartyOpen] = useState(false);
  const [watchPartyState, setWatchPartyState] = useState<WatchPartyCardState | null>(
    watchParty ?? null,
  );
  const [kickoffCountdown, setKickoffCountdown] = useState("");
  const [deadlineCountdown, setDeadlineCountdown] = useState("");

  const activePrediction = existingPrediction ?? localPrediction;

  useEffect(() => {
    if (existingPrediction) {
      setLocalPrediction(null);
      setHome(existingPrediction.homePrediction);
      setAway(existingPrediction.awayPrediction);
    }
  }, [existingPrediction]);

  useEffect(() => {
    setWatchPartyState(watchParty ?? null);
  }, [watchParty]);

  useEffect(() => {
    if (!autoOpenWatchParty || !watchPartyState) return;
    setWatchPartyOpen(true);
    onWatchPartyAutoOpened?.();
  }, [autoOpenWatchParty, watchPartyState, onWatchPartyAutoOpened]);

  const cutoff = effectivePredictionCutoffMinutes(predictionCutoffMinutes);
  const cutoffMs = getPredictionDeadlineInstant(match.kickoffAt, cutoff);
  const hasFinalScore = isMatchResultKnown(match);
  const kickoffPassed = hasKickoffPassed(match.kickoffAt);
  const gameEnded = isMatchFinishedForDisplay(match, predictionCutoffMinutes);
  const hasPrediction = !!activePrediction;
  const isClosed = Date.now() >= cutoffMs || gameEnded;
  const showPredictionAndResult = hasPrediction && (hasFinalScore || kickoffPassed || gameEnded);
  const displayedAccuracy =
    hasFinalScore && activePrediction
      ? (activePrediction.accuracyPercent ??
        calculatePredictionAccuracy(
          activePrediction.homePrediction,
          activePrediction.awayPrediction,
          match.homeScore!,
          match.awayScore!,
        ))
      : null;

  useEffect(() => {
    const tick = () => {
      const cutoff = effectivePredictionCutoffMinutes(predictionCutoffMinutes);
      const toKickoff = getRemainingMs(match.kickoffAt);
      const toDeadline = getRemainingMsUntilPredictionDeadline(match.kickoffAt, cutoff);
      setKickoffCountdown(toKickoff > 0 ? formatCountdown(toKickoff) : "شروع شده");
      setDeadlineCountdown(toDeadline > 0 ? formatCountdown(toDeadline) : "پایان مهلت");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [match.kickoffAt, predictionCutoffMinutes]);

  const isKnockoutCaptain = knockoutUiState?.role === "captain";
  const isKnockoutMember = knockoutUiState?.role === "member";
  const knockoutMessage = knockoutUiState?.message;
  const canSubmitPrediction =
    !hasPrediction && !isClosed && !gameEnded && (!knockoutUiState || knockoutUiState.canSubmit);

  const submitKnockout = async (options?: { confirmCover?: boolean; cancelCover?: boolean }) => {
    const res = await fetch("/api/predictions/knockout-submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        kandakatorId,
        homePrediction: home,
        awayPrediction: away,
        ...options,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.code === "DISPLAY_NAME_REQUIRED") {
        onDisplayNameRequired?.();
        return;
      }
      if (options?.cancelCover) {
        setCoverModal(null);
      }
      throw new Error(data.error);
    }
    if (data.needsCoverConfirmation) {
      setCoverModal({
        shortfallMembers: data.shortfallMembers,
        feePerMember: entryFeeCoins,
      });
      return;
    }
    if (data.submitted) {
      toast(`پیش‌بینی تیمی ثبت شد!`, "success");
      setLocalPrediction({
        homePrediction: home,
        awayPrediction: away,
        accuracyPercent: null,
        coinsEarned: null,
        xpEarned: null,
      });
      setCoverModal(null);
      onSubmitted();
    }
  };

  const submit = async () => {
    if (needsDisplayName) {
      onDisplayNameRequired?.();
      return;
    }

    setLoading(true);
    try {
      if (isKnockoutCaptain) {
        await submitKnockout();
        return;
      }

      const res = await fetch("/api/predictions/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId,
          kandakatorId,
          homePrediction: home,
          awayPrediction: away,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "DISPLAY_NAME_REQUIRED") {
          onDisplayNameRequired?.();
          return;
        }
        throw new Error(data.error);
      }
      toast(`پیش‌بینی ثبت شد! ${formatPersianNumber(entryFeeCoins)} سکه کسر شد.`, "success");
      setLocalPrediction({
        homePrediction: home,
        awayPrediction: away,
        accuracyPercent: null,
        coinsEarned: null,
        xpEarned: null,
      });
      onSubmitted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoading(false);
    }
  };

  const ScoreInput = ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (v: number) => void;
  }) => (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isClosed || hasPrediction}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-8 text-center text-2xl font-bold tabular-nums">
          {formatPersianNumber(value)}
        </span>
        <button
          type="button"
          disabled={isClosed || hasPrediction}
          onClick={() => onChange(Math.min(20, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {match.leagueName ? (
              <Badge variant="blue">{match.leagueName}</Badge>
            ) : null}
            {teamCompetitionBadges?.map((badge) => (
              <Badge
                key={badge.id}
                variant="purple"
                className="max-w-full gap-1"
                title={badge.label}
              >
                <Users className="h-3 w-3 shrink-0" />
                <span className="truncate">{badge.label}</span>
              </Badge>
            ))}
          </div>
          <div
            className="flex items-center gap-1 text-xs text-white/50"
            title="ساعت شروع بازی به وقت تهران"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>شروع {formatTehranTime(match.kickoffAt)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="text-center">
            <p className="text-sm font-semibold leading-tight">{match.homeTeamName}</p>
          </div>
          <div className="text-xs text-white/30">VS</div>
          <div className="text-center">
            <p className="text-sm font-semibold leading-tight">{match.awayTeamName}</p>
          </div>
        </div>

        {showPredictionAndResult ? (
          <div className="space-y-3">
            <PredictionResultGrid
              prediction={activePrediction!}
              homeScore={match.homeScore}
              awayScore={match.awayScore}
              resultKnown={hasFinalScore}
            />
            {!hasFinalScore ? (
              <p className="text-center text-xs text-white/45">
                نتیجه رسمی بازی در حال بروزرسانی است
              </p>
            ) : null}
            {hasFinalScore && displayedAccuracy !== null ? (
              <div className="flex flex-wrap justify-center gap-3 text-xs">
                <Badge variant="orange">
                  دقت {formatPersianNumber(displayedAccuracy)}٪
                </Badge>
                {activePrediction.coinsEarned ? (
                  <Badge variant="green">
                    +{formatPersianNumber(activePrediction.coinsEarned)} سکه
                  </Badge>
                ) : null}
                {activePrediction.xpEarned ? (
                  <Badge variant="green">
                    +{formatPersianNumber(activePrediction.xpEarned)} امتیاز
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : hasFinalScore ? (
          <div className="rounded-xl border border-bordin-orange/35 bg-bordin-orange/10 py-4 text-center">
            <p className="mb-1 text-xs text-white/55">نتیجه بازی</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatPersianNumber(match.homeScore!)} - {formatPersianNumber(match.awayScore!)}
            </p>
          </div>
        ) : gameEnded ? (
          <p className="rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm text-white/55">
            نتیجه رسمی بازی در حال بروزرسانی است
          </p>
        ) : hasPrediction ? (
          <div className="rounded-xl border border-bordin-green/20 bg-bordin-green/5 py-3 text-center">
            <p className="text-sm text-bordin-green">
              {isKnockoutMember && knockoutMessage ? knockoutMessage : "پیش‌بینی شما"}
            </p>
            <p className="mt-1 text-xl font-bold">
              {formatPersianNumber(activePrediction!.homePrediction)} -{" "}
              {formatPersianNumber(activePrediction!.awayPrediction)}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-8 py-2">
            <ScoreInput value={home} onChange={setHome} />
            <span className="text-2xl text-white/20">-</span>
            <ScoreInput value={away} onChange={setAway} />
          </div>
        )}

        {knockoutMessage && !hasPrediction ? (
          <p
            className={cn(
              "rounded-xl border px-3 py-2.5 text-center text-sm",
              isKnockoutCaptain
                ? "border-bordin-orange/30 bg-bordin-orange/10 text-bordin-orange"
                : "border-white/10 bg-white/5 text-white/60",
            )}
          >
            {knockoutMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="inline-flex animate-pulse items-center rounded-full border border-bordin-orange/35 bg-bordin-orange/12 px-2.5 py-1 text-[11px] font-semibold text-bordin-orange shadow-[0_0_18px_rgba(255,138,76,0.14)]">
              هزینه ورودی: {formatPersianNumber(entryFeeCoins)} سکه
            </span>
            {!gameEnded ? (
              <span
                className={isClosed ? "text-red-400" : "text-bordin-orange"}
                title={
                  isClosed
                    ? "مهلت ثبت پیش‌بینی تمام شده"
                    : `شروع بازی ${formatTehranTime(match.kickoffAt)} — مهلت پیش‌بینی تا ${formatTehranTime(
                        new Date(getPredictionDeadlineInstant(match.kickoffAt, cutoff)),
                      )}`
                }
              >
                {kickoffCountdown === "شروع شده"
                  ? deadlineCountdown === "پایان مهلت"
                    ? deadlineCountdown
                    : `مهلت: ${deadlineCountdown}`
                  : `تا شروع: ${kickoffCountdown}`}
              </span>
            ) : null}
          </div>
          {perfectReward || watchPartyState ? (
            <div className="flex items-start justify-between gap-2">
              {watchPartyState ? (
                <WatchPartyButton
                  kickoffAt={match.kickoffAt}
                  watchParty={watchPartyState}
                  onOpen={() => setWatchPartyOpen(true)}
                />
              ) : (
                <span />
              )}
              {perfectReward ? (
                <span className="inline-flex animate-pulse items-center rounded-full border border-bordin-green/35 bg-bordin-green/12 px-2.5 py-1 text-[11px] font-semibold text-bordin-green shadow-[0_0_18px_rgba(34,197,94,0.14)]">
                  جایزه ۱۰۰٪ صحت: {formatPersianNumber(perfectReward.coins)} سکه +{" "}
                  {formatPersianNumber(perfectReward.xp)} امتیاز
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {canSubmitPrediction ? (
          <Button fullWidth loading={loading} onClick={submit}>
            {isKnockoutCaptain ? "ثبت پیش‌بینی تیمی" : "ثبت پیش‌بینی"}
          </Button>
        ) : null}
      </CardContent>

      <Modal
        open={Boolean(coverModal)}
        onClose={() => setCoverModal(null)}
        className="max-w-md"
      >
        {coverModal ? (
          <>
            <p className="mb-4 text-sm leading-8 text-white/80">
              با توجه به اینکه هزینه ثبت پیش‌بینی در مرحله حذفی از اعضای تیم دریافت میشه، لازمه که
              همه افراد موجودی سکه کافی برای پرداخت این هزینه رو داشته باشند. این افراد سکه کافی در
              اختیار ندارند:
            </p>
            <ul className="mb-4 list-inside list-decimal text-sm text-white/70">
              {coverModal.shortfallMembers.map((m) => (
                <li key={m.userId}>{m.name}</li>
              ))}
            </ul>
            <p className="mb-6 text-sm leading-8 text-white/80">
              آیا قبول میکنید هزینه پیش‌بینی افرادی که سکه کافی ندارند از موجودی سکه اعضایی که سکه
              کافی دارند کسر بشه؟ در صورت لغو، پیش‌بینی تیمی شما ثبت نمیشه، تیم شما امتیاز دریافت
              نمیکنه و ممکنه از رقابت حذف بشه!
            </p>
            <div className="flex flex-col gap-2">
              <Button
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await submitKnockout({ confirmCover: true });
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "خطا", "error");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                قبول میکنم
              </Button>
              <Button
                variant="secondary"
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await submitKnockout({ cancelCover: true });
                  } catch (e) {
                    toast(e instanceof Error ? e.message : "خطا", "error");
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                لغو پیش‌بینی
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      {watchPartyState ? (
        <WatchPartyJoinModal
          open={watchPartyOpen}
          onClose={() => setWatchPartyOpen(false)}
          watchParty={watchPartyState}
          matchLabel={`${match.homeTeamName} - ${match.awayTeamName}`}
          onJoined={(googleMeetUrl) => {
            setWatchPartyState((prev) =>
              prev ? { ...prev, hasJoined: true, googleMeetUrl } : prev,
            );
          }}
          onRefresh={onSubmitted}
        />
      ) : null}
    </Card>
  );
}
