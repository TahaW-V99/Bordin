"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Chip } from "@/shared/components/ui/chip";
import { useToast } from "@/shared/components/ui/toast";
import { TehranDateTimeField } from "@/features/admin/components/tehran-datetime-field";
import { AdminCompetitionCategoryPicker } from "@/features/admin/components/admin-competition-category-picker";
import {
  AdminMatchPicker,
  type AdminMatchOption,
} from "@/features/admin/components/admin-match-picker";
import {
  KNOCKOUT_ROUND_LABELS_FA,
  TEAM_COMPETITION_CAPACITY_OPTIONS,
  knockoutRoundsForCapacity,
  type TeamCompetitionCapacity,
} from "@/shared/constants/team-competitions";
import { formatTehranDateTime, formatPersianNumber } from "@/shared/lib/dates";
import { resolveTeamCompetitionBannerUrl } from "@/shared/lib/team-competition-banner";
import type { TeamCompetitionKnockoutRoundType } from "@prisma/client";

type MedalOption = {
  id: string;
  slug: string;
  titleFa: string;
  tier: string;
  category: string;
};

type KnockoutRoundForm = {
  roundType: TeamCompetitionKnockoutRoundType;
  startsAt: string;
  endsAt: string;
  predictionFeePerMember: string;
  footballCompetitionIds: number[];
  matchExternalIds?: string[];
};

function parseFeeInput(value: string, label: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error(`${label} نامعتبر است`);
  }
  return parsed;
}

const STEPS = ["نوع رقابت", "اطلاعات پایه", "مرحله رده‌بندی", "مراحل حذفی", "بازبینی نهایی"];

const BANNER_WIDTH = 156;
const BANNER_HEIGHT = 193;
const BANNER_SIZE_ERROR = "سایز تصویر مجاز نیست.";

function validateBannerDimensions(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalWidth === BANNER_WIDTH && img.naturalHeight === BANNER_HEIGHT);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}

export function TeamCompetitionBuilder({ competitionId }: { competitionId?: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = Boolean(competitionId);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(isEdit);
  const [usesRuleBasedStages, setUsesRuleBasedStages] = useState(!isEdit);
  const [knockoutSubIndex, setKnockoutSubIndex] = useState(0);
  const [medals, setMedals] = useState<MedalOption[]>([]);
  const [matchMeta, setMatchMeta] = useState<Record<string, AdminMatchOption>>({});

  const [titleFa, setTitleFa] = useState("");
  const [description, setDescription] = useState("");
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerLocalPreview, setBannerLocalPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerSizeError, setBannerSizeError] = useState<string | null>(null);
  const [teamCapacity, setTeamCapacity] = useState<TeamCompetitionCapacity>(16);
  const [minTeamSize, setMinTeamSize] = useState("3");
  const [maxTeamSize, setMaxTeamSize] = useState("5");
  const [registrationDeadline, setRegistrationDeadline] = useState("");
  const [registrationFeePerMember, setRegistrationFeePerMember] = useState("100");
  const [rankingStartsAt, setRankingStartsAt] = useState("");
  const [rankingEndsAt, setRankingEndsAt] = useState("");
  const [rankingFootballCompetitionIds, setRankingFootballCompetitionIds] = useState<number[]>([]);
  const [rankingMatchExternalIds, setRankingMatchExternalIds] = useState<string[]>([]);
  const [rankingPredictionFeePerMember, setRankingPredictionFeePerMember] = useState("50");
  const [knockoutRounds, setKnockoutRounds] = useState<KnockoutRoundForm[]>(() =>
    knockoutRoundsForCapacity(16).map((roundType) => ({
      roundType,
      startsAt: "",
      endsAt: "",
      predictionFeePerMember: "50",
      footballCompetitionIds: [],
    })),
  );
  const [winnerCoinReward, setWinnerCoinReward] = useState(8000);
  const [runnerUpCoinReward, setRunnerUpCoinReward] = useState(5000);
  const [winnerMedalIds, setWinnerMedalIds] = useState<string[]>([]);
  const [runnerUpMedalIds, setRunnerUpMedalIds] = useState<string[]>([]);

  const handleCapacityChange = (capacity: TeamCompetitionCapacity) => {
    setTeamCapacity(capacity);
    setKnockoutRounds(
      knockoutRoundsForCapacity(capacity).map((roundType) => ({
        roundType,
        startsAt: "",
        endsAt: "",
        predictionFeePerMember: "50",
        footballCompetitionIds: [],
        ...(usesRuleBasedStages ? {} : { matchExternalIds: [] }),
      })),
    );
    setKnockoutSubIndex(0);
  };

  useEffect(() => {
    if (!competitionId) return;
    setLoadingExisting(true);
    fetch(`/api/admin/team-competitions/${competitionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.competition) {
          toast(data.error ?? "رقابت یافت نشد", "error");
          return;
        }
        const c = data.competition;
        const ruleBased = Boolean(c.usesRuleBasedStages);
        setUsesRuleBasedStages(ruleBased);

        setTitleFa(c.titleFa ?? "");
        setDescription(c.description ?? "");
        setBannerUrl(c.bannerUrl ?? null);
        setTeamCapacity(c.teamCapacity as TeamCompetitionCapacity);
        setMinTeamSize(String(c.minTeamSize));
        setMaxTeamSize(String(c.maxTeamSize));
        setRegistrationDeadline(c.registrationDeadline ?? "");
        setRegistrationFeePerMember(String(c.registrationFeePerMember ?? ""));
        setRankingStartsAt(c.rankingStartsAt ?? "");
        setRankingEndsAt(c.rankingEndsAt ?? "");
        setRankingFootballCompetitionIds(c.rankingFootballCompetitionIds ?? []);
        setRankingPredictionFeePerMember(String(c.rankingPredictionFeePerMember ?? ""));
        setWinnerCoinReward(c.winnerCoinReward ?? 8000);
        setRunnerUpCoinReward(c.runnerUpCoinReward ?? 5000);
        setWinnerMedalIds(
          (c.medalRewards ?? [])
            .filter((m: { placement: string }) => m.placement === "WINNER")
            .map((m: { medalId: string }) => m.medalId),
        );
        setRunnerUpMedalIds(
          (c.medalRewards ?? [])
            .filter((m: { placement: string }) => m.placement === "RUNNER_UP")
            .map((m: { medalId: string }) => m.medalId),
        );

        if (!ruleBased) {
          const rankingIds = (c.rankingMatches ?? [])
            .map((m: { externalId?: string | null }) => m.externalId)
            .filter((id: string | null | undefined): id is string => Boolean(id));
          setRankingMatchExternalIds(rankingIds);

          const meta: Record<string, AdminMatchOption> = {};
          for (const m of c.rankingMatches ?? []) {
            if (m.externalId) {
              meta[m.externalId] = {
                externalId: m.externalId,
                apiMatchId: 0,
                homeTeamName: m.homeTeamName,
                awayTeamName: m.awayTeamName,
                leagueName: m.leagueName ?? "",
                kickoffAt: m.kickoffAt,
                status: "SCHEDULED",
                matchId: m.matchId,
              };
            }
          }
          for (const round of c.knockoutRounds ?? []) {
            for (const m of round.matches ?? []) {
              if (m.externalId) {
                meta[m.externalId] = {
                  externalId: m.externalId,
                  apiMatchId: 0,
                  homeTeamName: m.homeTeamName,
                  awayTeamName: m.awayTeamName,
                  leagueName: m.leagueName ?? "",
                  kickoffAt: m.kickoffAt,
                  status: "SCHEDULED",
                  matchId: m.matchId,
                };
              }
            }
          }
          setMatchMeta(meta);
        }

        setKnockoutRounds(
          (c.knockoutRounds ?? []).map(
            (round: {
              roundType: TeamCompetitionKnockoutRoundType;
              startsAt?: string | null;
              endsAt?: string | null;
              predictionFeePerMember: number;
              footballCompetitionIds?: number[];
              matches: Array<{ externalId?: string | null }>;
            }) => ({
              roundType: round.roundType,
              startsAt: round.startsAt ?? "",
              endsAt: round.endsAt ?? "",
              predictionFeePerMember: String(round.predictionFeePerMember ?? ""),
              footballCompetitionIds: round.footballCompetitionIds ?? [],
              matchExternalIds: round.matches
                .map((m) => m.externalId)
                .filter((id): id is string => Boolean(id)),
            }),
          ),
        );
      })
      .finally(() => setLoadingExisting(false));
  }, [competitionId, toast]);

  const loadMedalsOnce = async () => {
    if (medals.length > 0) return;
    const res = await fetch("/api/admin/medals");
    const data = await res.json();
    if (res.ok) setMedals(data.medals ?? []);
  };

  const handleMatchMeta = (match: AdminMatchOption, selected: boolean) => {
    setMatchMeta((prev) => {
      const next = { ...prev };
      if (selected) next[match.externalId] = match;
      else delete next[match.externalId];
      return next;
    });
  };

  const uploadBanner = async (file: File) => {
    const validSize = await validateBannerDimensions(file);
    if (!validSize) {
      setBannerSizeError(BANNER_SIZE_ERROR);
      return;
    }
    setBannerSizeError(null);

    const localPreview = URL.createObjectURL(file);
    setBannerLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return localPreview;
    });
    setBannerUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    try {
      const res = await fetch("/api/admin/team-competitions/upload-banner", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error ?? "خطا در آپلود بنر";
        if (msg === BANNER_SIZE_ERROR) setBannerSizeError(BANNER_SIZE_ERROR);
        toast(msg, "error");
        URL.revokeObjectURL(localPreview);
        setBannerLocalPreview(null);
        return;
      }
      setBannerUrl(data.bannerUrl);
      toast("بنر آپلود شد", "success");
    } catch {
      toast("خطا در آپلود بنر", "error");
      URL.revokeObjectURL(localPreview);
      setBannerLocalPreview(null);
    } finally {
      setBannerUploading(false);
    }
  };

  const clearBannerLocalPreview = () => {
    setBannerLocalPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const parsedMinTeamSize = Number(minTeamSize);
  const parsedMaxTeamSize = Number(maxTeamSize);

  const currentKnockoutRound = knockoutRounds[knockoutSubIndex];

  const goNext = async () => {
    if (step === 1) {
      if (!titleFa.trim()) {
        toast("نام رقابت الزامی است", "error");
        return;
      }
      if (!bannerUrl) {
        toast("بنر رقابت الزامی است", "error");
        return;
      }
      if (bannerSizeError) {
        toast(BANNER_SIZE_ERROR, "error");
        return;
      }
      if (!registrationDeadline) {
        toast("ددلاین ثبت‌نام الزامی است", "error");
        return;
      }
      if (!minTeamSize.trim() || !maxTeamSize.trim()) {
        toast("حداقل و حداکثر اعضای تیم الزامی است", "error");
        return;
      }
      if (!Number.isFinite(parsedMinTeamSize) || !Number.isFinite(parsedMaxTeamSize)) {
        toast("تعداد اعضای تیم نامعتبر است", "error");
        return;
      }
      if (parsedMinTeamSize > parsedMaxTeamSize) {
        toast("حداقل اعضا نمی‌تواند بیشتر از حداکثر باشد", "error");
        return;
      }
      try {
        if (parseFeeInput(registrationFeePerMember, "هزینه ثبت‌نام") === null) {
          toast("هزینه ثبت‌نام الزامی است", "error");
          return;
        }
      } catch {
        toast("هزینه ثبت‌نام نامعتبر است", "error");
        return;
      }
    }
    if (step === 2) {
      if (!rankingStartsAt) {
        toast("تاریخ شروع رده‌بندی الزامی است", "error");
        return;
      }
      if (usesRuleBasedStages) {
        if (!rankingEndsAt) {
          toast("تاریخ پایان رده‌بندی الزامی است", "error");
          return;
        }
        if (rankingFootballCompetitionIds.length === 0) {
          toast("حداقل یک دسته مسابقات برای رده‌بندی انتخاب کنید", "error");
          return;
        }
      } else if (rankingMatchExternalIds.length === 0) {
        toast("حداقل یک مسابقه برای رده‌بندی انتخاب کنید", "error");
        return;
      }
      try {
        if (parseFeeInput(rankingPredictionFeePerMember, "هزینه پیش‌بینی رده‌بندی") === null) {
          toast("هزینه پیش‌بینی رده‌بندی الزامی است", "error");
          return;
        }
      } catch {
        toast("هزینه پیش‌بینی رده‌بندی نامعتبر است", "error");
        return;
      }
    }
    if (step === 3) {
      await loadMedalsOnce();
      const round = knockoutRounds[knockoutSubIndex];
      if (!round) return;
      if (usesRuleBasedStages) {
        if (!round.startsAt || !round.endsAt) {
          toast("تاریخ شروع و پایان این مرحله حذفی الزامی است", "error");
          return;
        }
        if (round.footballCompetitionIds.length === 0) {
          toast("حداقل یک دسته مسابقات برای این مرحله حذفی انتخاب کنید", "error");
          return;
        }
      } else if (!round.matchExternalIds || round.matchExternalIds.length === 0) {
        toast("حداقل یک مسابقه برای این مرحله حذفی انتخاب کنید", "error");
        return;
      }
      try {
        if (parseFeeInput(round.predictionFeePerMember, "هزینه پیش‌بینی") === null) {
          toast("هزینه پیش‌بینی الزامی است", "error");
          return;
        }
      } catch {
        toast("هزینه پیش‌بینی نامعتبر است", "error");
        return;
      }
      if (knockoutSubIndex < knockoutRounds.length - 1) {
        setKnockoutSubIndex((v) => v + 1);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    if (step === 3 && knockoutSubIndex > 0) {
      setKnockoutSubIndex((v) => v - 1);
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    let parsedRegistrationFee: number;
    let parsedRankingFee: number;

    try {
      const regFee = parseFeeInput(registrationFeePerMember, "هزینه ثبت‌نام");
      const rankFee = parseFeeInput(rankingPredictionFeePerMember, "هزینه پیش‌بینی رده‌بندی");
      if (regFee === null || rankFee === null) {
        toast("هزینه‌ها را تکمیل کنید", "error");
        return;
      }
      parsedRegistrationFee = regFee;
      parsedRankingFee = rankFee;
    } catch (error) {
      toast(error instanceof Error ? error.message : "مقادیر نامعتبر", "error");
      return;
    }

    const basePayload = {
      titleFa,
      description: description || null,
      bannerUrl,
      competitionType: "ELIMINATION" as const,
      teamCapacity,
      minTeamSize: parsedMinTeamSize,
      maxTeamSize: parsedMaxTeamSize,
      registrationDeadline,
      registrationFeePerMember: parsedRegistrationFee,
      rankingStartsAt,
      rankingPredictionFeePerMember: parsedRankingFee,
      winnerCoinReward,
      runnerUpCoinReward,
      winnerMedalIds,
      runnerUpMedalIds,
      publish: false,
    };

    let payload: Record<string, unknown>;

    if (usesRuleBasedStages) {
      let parsedKnockoutRounds: Array<{
        roundType: TeamCompetitionKnockoutRoundType;
        startsAt: string;
        endsAt: string;
        predictionFeePerMember: number;
        footballCompetitionIds: number[];
      }>;
      try {
        parsedKnockoutRounds = knockoutRounds.map((round) => {
          const fee = parseFeeInput(round.predictionFeePerMember, "هزینه پیش‌بینی");
          if (fee === null) throw new Error("هزینه پیش‌بینی الزامی است");
          if (!round.startsAt || !round.endsAt) {
            throw new Error("تاریخ شروع و پایان مراحل حذفی الزامی است");
          }
          if (round.footballCompetitionIds.length === 0) {
            throw new Error("انتخاب دسته مسابقات برای مراحل حذفی الزامی است");
          }
          return {
            roundType: round.roundType,
            startsAt: round.startsAt,
            endsAt: round.endsAt,
            predictionFeePerMember: fee,
            footballCompetitionIds: round.footballCompetitionIds,
          };
        });
      } catch (error) {
        toast(error instanceof Error ? error.message : "مقادیر نامعتبر", "error");
        return;
      }

      if (!rankingEndsAt) {
        toast("تاریخ پایان رده‌بندی الزامی است", "error");
        return;
      }
      if (rankingFootballCompetitionIds.length === 0) {
        toast("حداقل یک دسته مسابقات برای رده‌بندی انتخاب کنید", "error");
        return;
      }

      payload = {
        ...basePayload,
        rankingEndsAt,
        rankingFootballCompetitionIds,
        knockoutRounds: parsedKnockoutRounds,
      };
    } else {
      let parsedKnockoutRounds: Array<{
        roundType: TeamCompetitionKnockoutRoundType;
        predictionFeePerMember: number;
        matchExternalIds: string[];
      }>;
      try {
        parsedKnockoutRounds = knockoutRounds.map((round) => {
          const fee = parseFeeInput(round.predictionFeePerMember, "هزینه پیش‌بینی");
          if (fee === null) throw new Error("هزینه پیش‌بینی الزامی است");
          if (!round.matchExternalIds || round.matchExternalIds.length === 0) {
            throw new Error("انتخاب مسابقات برای مراحل حذفی الزامی است");
          }
          return {
            roundType: round.roundType,
            predictionFeePerMember: fee,
            matchExternalIds: round.matchExternalIds,
          };
        });
      } catch (error) {
        toast(error instanceof Error ? error.message : "مقادیر نامعتبر", "error");
        return;
      }

      if (rankingMatchExternalIds.length === 0) {
        toast("حداقل یک مسابقه برای رده‌بندی انتخاب کنید", "error");
        return;
      }

      payload = {
        ...basePayload,
        rankingMatchExternalIds,
        knockoutRounds: parsedKnockoutRounds,
      };
    }

    setSubmitting(true);
    const url = isEdit
      ? `/api/admin/team-competitions/${competitionId}`
      : "/api/admin/team-competitions";
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast(data.error ?? (isEdit ? "خطا در ویرایش رقابت" : "خطا در ایجاد رقابت"), "error");
      return;
    }
    toast(isEdit ? "رقابت تیمی به‌روزرسانی شد" : "رقابت تیمی ایجاد شد", "success");
    router.push("/admin?tab=competitions");
  };

  if (loadingExisting) {
    return (
      <>
        <PageHeader title={isEdit ? "ویرایش رقابت تیمی" : "ایجاد رقابت تیمی"} subtitle="در حال بارگذاری..." />
        <div className="px-4 py-8 text-center text-sm text-white/40">در حال بارگذاری اطلاعات...</div>
      </>
    );
  }

  const bannerPreviewSrc =
    bannerLocalPreview ?? resolveTeamCompetitionBannerUrl(bannerUrl) ?? bannerUrl ?? "";

  return (
    <>
      <PageHeader title={isEdit ? "ویرایش رقابت تیمی" : "ایجاد رقابت تیمی"} subtitle={STEPS[step]} />
      <div className="space-y-4 px-4 py-4">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((label, index) => (
            <Chip key={label} active={index === step} onClick={() => index < step && setStep(index)}>
              {index + 1}. {label}
            </Chip>
          ))}
        </div>

        {step === 0 ? (
          <section className="space-y-3 rounded-2xl border border-white/8 p-4">
            <p className="text-sm text-white/60">نوع رقابت تیمی را انتخاب کنید:</p>
            <button
              type="button"
              className="w-full rounded-xl border border-bordin-orange/50 bg-bordin-orange/10 p-4 text-right"
            >
              <p className="font-bold">رقابت‌های حذفی</p>
              <p className="mt-1 text-xs text-white/50">ثبت‌نام، رده‌بندی، حذفی و فینال</p>
            </button>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4 rounded-2xl border border-white/8 p-4">
            <Input label="نام فارسی رقابت" value={titleFa} onChange={(e) => setTitleFa(e.target.value)} />
            <div className="space-y-2">
              <p className="text-sm font-medium text-white/80">بنر مربعی رقابت</p>
              <p className="text-xs text-white/40">
                سایز مجاز جهت آپلود برابر با w=156, h=193 پیکسل است.
              </p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBanner(file);
                  e.target.value = "";
                }}
              />
              {bannerUploading ? <p className="text-xs text-white/40">در حال آپلود...</p> : null}
              {bannerSizeError ? <p className="text-xs text-red-400">{bannerSizeError}</p> : null}
              {bannerLocalPreview || bannerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerPreviewSrc}
                  alt="بنر"
                  width={BANNER_WIDTH}
                  height={BANNER_HEIGHT}
                  className="mx-auto h-[193px] w-[156px] rounded-xl border border-white/10 object-cover"
                  onLoad={() => {
                    if (bannerUrl && bannerLocalPreview) clearBannerLocalPreview();
                  }}
                />
              ) : null}
            </div>
            <Textarea
              label="توضیحات (اختیاری)"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات رقابت تیمی..."
            />
            <div>
              <p className="mb-2 text-sm font-medium text-white/80">ظرفیت کل رقابت (تعداد تیم)</p>
              <div className="flex gap-2">
                {TEAM_COMPETITION_CAPACITY_OPTIONS.map((cap) => (
                  <Chip
                    key={cap}
                    active={teamCapacity === cap}
                    onClick={() => handleCapacityChange(cap)}
                  >
                    {formatPersianNumber(cap)}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                min={1}
                label="حداقل اعضای تیم"
                value={minTeamSize}
                onChange={(e) => setMinTeamSize(e.target.value)}
              />
              <Input
                type="number"
                min={1}
                label="حداکثر اعضای تیم"
                value={maxTeamSize}
                onChange={(e) => setMaxTeamSize(e.target.value)}
              />
            </div>
            <TehranDateTimeField
              label="ددلاین تشکیل تیم و ثبت‌نام (تهران)"
              value={registrationDeadline}
              onChange={setRegistrationDeadline}
            />
            <Input
              type="text"
              inputMode="numeric"
              label="هزینه ثبت‌نام (سکه به ازای هر عضو)"
              value={registrationFeePerMember}
              onChange={(e) => setRegistrationFeePerMember(e.target.value.replace(/[^\d]/g, ""))}
            />
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4 rounded-2xl border border-white/8 p-4">
            <TehranDateTimeField
              label="شروع مرحله رده‌بندی (تهران)"
              value={rankingStartsAt}
              onChange={setRankingStartsAt}
            />
            {usesRuleBasedStages ? (
              <>
                <TehranDateTimeField
                  label="پایان بازه رده‌بندی (تهران)"
                  value={rankingEndsAt}
                  onChange={setRankingEndsAt}
                />
                <p className="text-xs text-white/40">
                  پایان واقعی مرحله پس از اتمام آخرین مسابقه واجد شرایط در این بازه و دسته‌های انتخاب‌شده
                  تعیین می‌شود.
                </p>
                <AdminCompetitionCategoryPicker
                  label="دسته‌های مسابقات فوتبال (مرحله رده‌بندی)"
                  selectedCompetitionIds={rankingFootballCompetitionIds}
                  onChange={setRankingFootballCompetitionIds}
                />
              </>
            ) : (
              <AdminMatchPicker
                label="مسابقات مرحله رده‌بندی"
                selectedExternalIds={rankingMatchExternalIds}
                onChange={setRankingMatchExternalIds}
                onMatchMeta={handleMatchMeta}
              />
            )}
            <Input
              type="text"
              inputMode="numeric"
              label="هزینه پیش‌بینی رده‌بندی (سکه به ازای هر عضو)"
              value={rankingPredictionFeePerMember}
              onChange={(e) =>
                setRankingPredictionFeePerMember(e.target.value.replace(/[^\d]/g, ""))
              }
            />
          </section>
        ) : null}

        {step === 3 && currentKnockoutRound ? (
          <section className="space-y-4 rounded-2xl border border-white/8 p-4">
            <p className="text-sm font-bold text-bordin-orange">
              {KNOCKOUT_ROUND_LABELS_FA[currentKnockoutRound.roundType]} ({formatPersianNumber(knockoutSubIndex + 1)} از{" "}
              {formatPersianNumber(knockoutRounds.length)})
            </p>
            {usesRuleBasedStages ? (
              <>
                <TehranDateTimeField
                  label="شروع بازه این مرحله (تهران)"
                  value={currentKnockoutRound.startsAt}
                  onChange={(value) => {
                    setKnockoutRounds((prev) =>
                      prev.map((round, index) =>
                        index === knockoutSubIndex ? { ...round, startsAt: value } : round,
                      ),
                    );
                  }}
                />
                <TehranDateTimeField
                  label="پایان بازه این مرحله (تهران)"
                  value={currentKnockoutRound.endsAt}
                  onChange={(value) => {
                    setKnockoutRounds((prev) =>
                      prev.map((round, index) =>
                        index === knockoutSubIndex ? { ...round, endsAt: value } : round,
                      ),
                    );
                  }}
                />
                <p className="text-xs text-white/40">
                  پایان واقعی مرحله پس از اتمام آخرین مسابقه واجد شرایط در این بازه و دسته‌های انتخاب‌شده
                  تعیین می‌شود.
                </p>
                <AdminCompetitionCategoryPicker
                  label={`دسته‌های مسابقات فوتبال (${KNOCKOUT_ROUND_LABELS_FA[currentKnockoutRound.roundType]})`}
                  selectedCompetitionIds={currentKnockoutRound.footballCompetitionIds}
                  onChange={(ids) => {
                    setKnockoutRounds((prev) =>
                      prev.map((round, index) =>
                        index === knockoutSubIndex ? { ...round, footballCompetitionIds: ids } : round,
                      ),
                    );
                  }}
                />
              </>
            ) : (
              <AdminMatchPicker
                label={`مسابقات ${KNOCKOUT_ROUND_LABELS_FA[currentKnockoutRound.roundType]}`}
                selectedExternalIds={currentKnockoutRound.matchExternalIds ?? []}
                onChange={(ids) => {
                  setKnockoutRounds((prev) =>
                    prev.map((round, index) =>
                      index === knockoutSubIndex ? { ...round, matchExternalIds: ids } : round,
                    ),
                  );
                }}
                onMatchMeta={handleMatchMeta}
              />
            )}
            <Input
              type="text"
              inputMode="numeric"
              label="هزینه پیش‌بینی (سکه به ازای هر عضو)"
              value={currentKnockoutRound.predictionFeePerMember}
              onChange={(e) => {
                const value = e.target.value.replace(/[^\d]/g, "");
                setKnockoutRounds((prev) =>
                  prev.map((round, index) =>
                    index === knockoutSubIndex ? { ...round, predictionFeePerMember: value } : round,
                  ),
                );
              }}
            />
            {knockoutSubIndex === knockoutRounds.length - 1 ? (
              <div className="space-y-3 border-t border-white/8 pt-4">
                <p className="font-semibold">جایزه قهرمان و نایب‌قهرمان</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    label="سکه قهرمان"
                    value={winnerCoinReward}
                    onChange={(e) => setWinnerCoinReward(Number(e.target.value))}
                  />
                  <Input
                    type="number"
                    label="سکه نایب‌قهرمان"
                    value={runnerUpCoinReward}
                    onChange={(e) => setRunnerUpCoinReward(Number(e.target.value))}
                  />
                </div>
                <MedalMultiSelect
                  label="مدال‌های قهرمان"
                  medals={medals}
                  selectedIds={winnerMedalIds}
                  onChange={setWinnerMedalIds}
                />
                <MedalMultiSelect
                  label="مدال‌های نایب‌قهرمان"
                  medals={medals}
                  selectedIds={runnerUpMedalIds}
                  onChange={setRunnerUpMedalIds}
                />
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-3 rounded-2xl border border-white/8 p-4 text-sm">
            <ReviewRow label="نام" value={titleFa} />
            <ReviewRow label="ظرفیت تیم" value={formatPersianNumber(teamCapacity)} />
            <ReviewRow
              label="اعضای تیم"
              value={`${formatPersianNumber(parsedMinTeamSize)} تا ${formatPersianNumber(parsedMaxTeamSize)}`}
            />
            <ReviewRow label="ددلاین ثبت‌نام" value={formatTehranDateTime(registrationDeadline)} />
            <ReviewRow
              label="هزینه ثبت‌نام"
              value={`${formatPersianNumber(Number(registrationFeePerMember) || 0)} سکه / عضو`}
            />
            <ReviewRow label="شروع رده‌بندی" value={formatTehranDateTime(rankingStartsAt)} />
            {usesRuleBasedStages ? (
              <>
                <ReviewRow label="پایان بازه رده‌بندی" value={formatTehranDateTime(rankingEndsAt)} />
                <ReviewRow
                  label="دسته‌های مسابقات رده‌بندی"
                  value={formatPersianNumber(rankingFootballCompetitionIds.length)}
                />
              </>
            ) : (
              <ReviewRow
                label="مسابقات رده‌بندی"
                value={formatPersianNumber(rankingMatchExternalIds.length)}
              />
            )}
            {knockoutRounds.map((round) => (
              <div key={round.roundType} className="space-y-1 border-b border-white/5 py-2">
                {usesRuleBasedStages ? (
                  <>
                    <ReviewRow
                      label={`شروع ${KNOCKOUT_ROUND_LABELS_FA[round.roundType]}`}
                      value={round.startsAt ? formatTehranDateTime(round.startsAt) : "—"}
                    />
                    <ReviewRow
                      label={`پایان بازه ${KNOCKOUT_ROUND_LABELS_FA[round.roundType]}`}
                      value={round.endsAt ? formatTehranDateTime(round.endsAt) : "—"}
                    />
                    <ReviewRow
                      label={KNOCKOUT_ROUND_LABELS_FA[round.roundType]}
                      value={`${formatPersianNumber(round.footballCompetitionIds.length)} دسته — ${formatPersianNumber(
                        Number(round.predictionFeePerMember || 0),
                      )} سکه`}
                    />
                  </>
                ) : (
                  <ReviewRow
                    label={KNOCKOUT_ROUND_LABELS_FA[round.roundType]}
                    value={`${formatPersianNumber(round.matchExternalIds?.length ?? 0)} مسابقه — ${formatPersianNumber(
                      Number(round.predictionFeePerMember || 0),
                    )} سکه`}
                  />
                )}
              </div>
            ))}
            <ReviewRow label="جایزه قهرمان" value={`${formatPersianNumber(winnerCoinReward)} سکه`} />
            <ReviewRow label="جایزه نایب‌قهرمان" value={`${formatPersianNumber(runnerUpCoinReward)} سکه`} />
          </section>
        ) : null}

        <div className="flex gap-2">
          {step > 0 ? (
            <Button variant="secondary" onClick={goBack}>
              قبلی
            </Button>
          ) : (
            <Link href="/admin?tab=competitions" className="flex-1">
              <Button variant="secondary" className="w-full">
                انصراف
              </Button>
            </Link>
          )}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1" onClick={() => void goNext()}>
              بعدی
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => void submit()} disabled={submitting}>
              {submitting ? "در حال ذخیره..." : isEdit ? "ذخیره تغییرات" : "تایید نهایی"}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 py-2">
      <span className="text-white/50">{label}</span>
      <span className="text-left font-medium">{value}</span>
    </div>
  );
}

function MedalMultiSelect({
  label,
  medals,
  selectedIds,
  onChange,
}: {
  label: string;
  medals: MedalOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white/80">{label}</p>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-white/8 p-2">
        {medals.map((medal) => {
          const checked = selectedIds.includes(medal.id);
          return (
            <label
              key={medal.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  if (checked) onChange(selectedIds.filter((id) => id !== medal.id));
                  else onChange([...selectedIds, medal.id]);
                }}
              />
              <span>{medal.titleFa}</span>
              <span className="text-xs text-white/40">({medal.tier})</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
