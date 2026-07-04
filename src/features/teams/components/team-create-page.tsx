"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TeamIntroSlider } from "@/features/teams/components/team-intro-slider";
import { TeamLogo } from "@/features/teams/components/team-logo";
import { TeamMemberSelection } from "@/features/teams/components/team-member-selection";
import {
  TEAM_FORMATION_FEE,
  TEAM_LOGO_COST,
  isPaidTeamLogo,
  selectableTeamLogoKeys,
  teamLogoUrl,
} from "@/shared/constants/teams";
import { validateTeamName } from "@/shared/lib/team-name";
import { formatPersianNumber } from "@/shared/lib/dates";

type Draft = {
  introCompleted: boolean;
  step: string;
  name: string | null;
  capacity: number | null;
  logoKey: number | null;
  formationFeePaid: boolean;
  formingTeamId: string | null;
};

type Config = { min: number; max: number; freeInviteLimit: number };

type WizardStep = "intro" | "name" | "capacity" | "logo" | "summary" | "members";

function StepActions({
  onBack,
  onNext,
  nextLabel = "مرحله بعد",
  loading,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  loading?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="flex gap-2">
      {showBack && onBack ? (
        <Button variant="outline" fullWidth onClick={onBack}>
          مرحله قبل
        </Button>
      ) : null}
      <Button fullWidth loading={loading} onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}

export function TeamCreatePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [config, setConfig] = useState<Config>({ min: 2, max: 3, freeInviteLimit: 20 });
  const [unlockedLogos, setUnlockedLogos] = useState<number[]>([]);
  const [step, setStep] = useState<WizardStep>("intro");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [logoKey, setLogoKey] = useState<number | null>(null);
  const [purchaseModal, setPurchaseModal] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [draftRes, configRes] = await Promise.all([
      fetch("/api/teams/draft"),
      fetch("/api/teams/config"),
    ]);
    const draftJson = await draftRes.json();
    const configJson = await configRes.json();
    const d = draftJson.draft as Draft | null;
    setConfig(configJson.config ?? { min: 2, max: 3, freeInviteLimit: 20 });
    setUnlockedLogos(configJson.unlockedLogos ?? []);
    setDraft(d);
    if (d) {
      setName(d.name ?? "");
      setCapacity(d.capacity ?? configJson.config?.max ?? 3);
      setLogoKey(d.logoKey);
      setTeamId(d.formingTeamId);
      if (!d.introCompleted) setStep("intro");
      else if (d.formationFeePaid && d.formingTeamId) setStep("members");
      else if (d.step === "summary") setStep("summary");
      else if (d.logoKey) setStep("logo");
      else if (d.capacity) setStep("capacity");
      else if (d.name) setStep("name");
      else setStep("name");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = async (data: Partial<Draft>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/teams/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      setDraft(json.draft);
      return json.draft as Draft;
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const completeIntro = async () => {
    await saveDraft({ introCompleted: true, step: "name" });
    setStep("name");
  };

  const saveName = async () => {
    const validation = validateTeamName(name);
    if (!validation.ok) {
      toast(validation.error, "error");
      return;
    }
    await saveDraft({ name: validation.value, step: "capacity" });
    setStep("capacity");
  };

  const saveCapacity = async () => {
    await saveDraft({ capacity, step: "logo" });
    setStep("logo");
  };

  const selectLogo = async (key: number) => {
    if (isPaidTeamLogo(key) && !unlockedLogos.includes(key)) {
      setPurchaseModal(key);
      return;
    }
    setLogoKey(key);
    await saveDraft({ logoKey: key, step: "summary" });
    setStep("summary");
  };

  const purchaseLogo = async () => {
    if (!purchaseModal) return;
    setSaving(true);
    try {
      const res = await fetch("/api/teams/logos/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoKey: purchaseModal }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      setUnlockedLogos((prev) => [...prev, purchaseModal]);
      setLogoKey(purchaseModal);
      await saveDraft({ logoKey: purchaseModal, step: "summary" });
      setPurchaseModal(null);
      setStep("summary");
      toast("لوگو خریداری شد", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setSaving(false);
    }
  };

  const payAndContinue = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/teams/draft/pay-formation", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      setTeamId(json.teamId);
      setDraft((prev) =>
        prev
          ? { ...prev, formationFeePaid: true, formingTeamId: json.teamId, step: "members" }
          : prev,
      );
      setStep("members");
      if (!json.alreadyPaid) {
        toast("هزینه تشکیل تیم پرداخت شد", "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setSaving(false);
    }
  };

  const continueFromSummary = () => {
    if (draft?.formationFeePaid && teamId) {
      setStep("members");
      return;
    }
    void payAndContinue();
  };

  const formationFeePaid = draft?.formationFeePaid ?? false;

  const finalize = async () => {
    if (!teamId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/finalize`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      toast("تیم با موفقیت ایجاد شد", "success");
      router.push("/profile/teams");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="ایجاد تیم" />
        <div className="px-4 py-4">
          <Skeleton className="h-40" />
        </div>
      </>
    );
  }

  if (step === "intro") {
    return <TeamIntroSlider onComplete={completeIntro} />;
  }

  return (
    <>
      <PageHeader title="ایجاد تیم" subtitle="مرحله‌به‌مرحله تیم خود را بسازید" />
      <div className="space-y-6 px-4 py-4 pb-24">
        {step === "name" ? (
          <section className="space-y-4">
            <h3 className="font-bold">۱) انتخاب نام تیم</h3>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام فارسی تیم (۳ تا ۱۰ حرف، فاصله مجاز است)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-bordin-orange"
            />
            <StepActions
              loading={saving}
              onBack={() => router.push("/profile/teams")}
              onNext={() => void saveName()}
            />
          </section>
        ) : null}

        {step === "capacity" ? (
          <section className="space-y-4">
            <h3 className="font-bold">۲) انتخاب ظرفیت تیم</h3>
            <p className="text-sm text-white/50">
              حداقل {formatPersianNumber(config.min)} و حداکثر {formatPersianNumber(config.max)} نفر
            </p>
            <div className="flex gap-2">
              {Array.from({ length: config.max - config.min + 1 }, (_, i) => config.min + i).map(
                (n) => (
                  <Button
                    key={n}
                    variant={capacity === n ? "primary" : "outline"}
                    onClick={() => setCapacity(n)}
                  >
                    {formatPersianNumber(n)} نفر
                  </Button>
                ),
              )}
            </div>
            <StepActions
              loading={saving}
              onBack={() => setStep("name")}
              onNext={() => void saveCapacity()}
            />
          </section>
        ) : null}

        {step === "logo" ? (
          <section className="space-y-4">
            <h3 className="font-bold">۳) انتخاب لوگوی تیم</h3>
            <div className="grid grid-cols-5 gap-3">
              {selectableTeamLogoKeys().map((key) => (
                <TeamLogo
                  key={key}
                  logoKey={key}
                  unlocked={!isPaidTeamLogo(key) || unlockedLogos.includes(key)}
                  selected={logoKey === key}
                  onClick={() => void selectLogo(key)}
                />
              ))}
            </div>
            <Button variant="outline" fullWidth onClick={() => setStep("capacity")}>
              مرحله قبل
            </Button>
          </section>
        ) : null}

        {step === "summary" ? (
          <section className="space-y-4">
            <h3 className="font-bold">۴) پیش‌نمایش تیم</h3>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              {logoKey ? (
                <div className="mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-white/5">
                  <Image
                    src={teamLogoUrl(logoKey)}
                    alt=""
                    width={64}
                    height={64}
                    className="rounded-xl"
                    unoptimized
                  />
                </div>
              ) : null}
              <p className="text-lg font-bold">{name}</p>
              <p className="mt-1 text-sm text-white/50">ظرفیت: {formatPersianNumber(capacity)} نفر</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setStep("logo")}>
                مرحله قبل
              </Button>
              <Button fullWidth loading={saving} onClick={continueFromSummary}>
                {formationFeePaid
                  ? "مرحله بعد"
                  : `مرحله بعد · ${formatPersianNumber(TEAM_FORMATION_FEE)} سکه`}
              </Button>
            </div>
          </section>
        ) : null}

        {step === "members" && teamId ? (
          <section className="space-y-4">
            <h3 className="font-bold">۵) انتخاب اعضای تیم</h3>
            <TeamMemberSelection teamId={teamId} freeInviteLimit={config.freeInviteLimit} />
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setStep("summary")}>
                مرحله قبل
              </Button>
              <Button fullWidth loading={saving} onClick={finalize}>
                تشکیل تیم
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <Modal open={purchaseModal != null} onClose={() => setPurchaseModal(null)}>
        {purchaseModal ? (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
                <Image
                  src={teamLogoUrl(purchaseModal)}
                  alt=""
                  width={72}
                  height={72}
                  className="rounded-xl opacity-90"
                  unoptimized
                />
              </div>
            </div>
            <p className="mb-6 text-center">آیا قصد داری لگو رو بخری؟</p>
            <div className="flex flex-col gap-2">
              <Button loading={saving} onClick={purchaseLogo}>
                آره · {formatPersianNumber(TEAM_LOGO_COST)} سکه
              </Button>
              <Button variant="ghost" onClick={() => setPurchaseModal(null)}>
                انصراف
              </Button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  );
}
