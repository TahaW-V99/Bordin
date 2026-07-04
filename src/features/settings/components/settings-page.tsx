"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, Settings2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { OtpInput } from "@/features/auth/components/otp-input";
import { useToast } from "@/shared/components/ui/toast";
import {
  DISPLAY_NAME_CHANGE_COST,
} from "@/shared/constants/settings";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_RULES_FA,
  DISPLAY_NAME_TAKEN_ERROR_FA,
  getDisplayNameValidationError,
} from "@/shared/lib/display-name";
import { HeaderToolbar } from "@/shared/components/layout/header-toolbar";
import { OTP_TTL_MS } from "@/shared/constants/auth";
import { AvatarCollectionCard } from "@/features/avatar-collection/components/avatar-collection-card";
import { AvatarCollectionModal } from "@/features/avatar-collection/components/avatar-collection-modal";

type SettingsData = {
  phone: string;
  displayName: string;
  displayNameChangeCount: number;
  nextNameChangeCost: number;
  avatarUrl: string | null;
  avatarSrc: string;
  hasPassword: boolean;
  totalCoins: number;
  unlockedAvatarIds: string[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "خطا در ارتباط با سرور");
  return data as T;
}

async function patchJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "خطا در ارتباط با سرور");
  return data as T;
}

function validateNewPasswordFields(password: string, confirmPassword: string) {
  if (!password.trim()) return "رمز عبور جدید را وارد کنید";
  if (!confirmPassword.trim()) return "تکرار رمز عبور را وارد کنید";
  if (password.length < 6) return "رمز عبور باید حداقل ۶ کاراکتر باشد";
  if (password !== confirmPassword) return "رمز عبور و تکرار آن یکسان نیست";
  return null;
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <h2 className="mb-4 text-sm font-bold text-bordin-orange">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [collectionOpen, setCollectionOpen] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [nameDuplicateError, setNameDuplicateError] = useState<string | null>(null);
  const [nameChecking, setNameChecking] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);
  const verifyInFlightRef = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "خطا در بارگذاری تنظیمات");
    setSettings({
      ...json.settings,
      unlockedAvatarIds: json.settings.unlockedAvatarIds ?? [],
    });
    setDisplayName(json.settings.displayName);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch((e) => {
      toast(e instanceof Error ? e.message : "خطا", "error");
      setLoading(false);
    });
  }, [load, toast]);

  useEffect(() => {
    if (!otpExpiresAt) return;
    const tick = () => setCountdownMs(Math.max(0, otpExpiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpExpiresAt]);

  useEffect(() => {
    if (!settings) return;

    const trimmed = displayName.trim();
    if (!trimmed || trimmed === settings.displayName) {
      setNameDuplicateError(null);
      setNameChecking(false);
      return;
    }

    if (getDisplayNameValidationError(displayName)) {
      setNameDuplicateError(null);
      setNameChecking(false);
      return;
    }

    setNameChecking(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/settings/display-name?displayName=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as { available?: boolean; error?: string };
        if (!res.ok) {
          setNameDuplicateError(data.error ?? null);
          return;
        }
        setNameDuplicateError(data.available === false ? DISPLAY_NAME_TAKEN_ERROR_FA : null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNameDuplicateError(null);
      } finally {
        if (!controller.signal.aborted) setNameChecking(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setNameChecking(false);
    };
  }, [displayName, settings]);

  const saveDisplayName = async () => {
    if (!settings) return;
    const validationError = getDisplayNameValidationError(displayName);
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    if (nameDuplicateError) {
      toast(nameDuplicateError, "error");
      return;
    }
    setNameSaving(true);
    try {
      const result = await patchJson<{
        displayName: string;
        coinsDeducted: number;
        nextNameChangeCost: number;
        displayNameChangeCount: number;
      }>("/api/settings/display-name", { displayName });

      setSettings({
        ...settings,
        displayName: result.displayName,
        displayNameChangeCount: result.displayNameChangeCount,
        nextNameChangeCost: result.nextNameChangeCost,
        totalCoins: settings.totalCoins - result.coinsDeducted,
      });
      setDisplayName(result.displayName);

      if (result.coinsDeducted > 0) {
        toast(
          `نام با موفقیت ذخیره شد. ${formatPersianNumber(result.coinsDeducted)} سکه کسر شد.`,
          "success",
        );
      } else {
        toast("نام با موفقیت ذخیره شد (رایگان)", "success");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setNameSaving(false);
    }
  };

  const handleAvatarUpdated = (payload: {
    avatarUrl: string;
    avatarSrc: string;
    totalCoins: number;
    unlockedAvatarIds: string[];
  }) => {
    setSettings((current) =>
      current
        ? {
            ...current,
            avatarUrl: payload.avatarUrl,
            avatarSrc: payload.avatarSrc,
            totalCoins: payload.totalCoins,
            unlockedAvatarIds: payload.unlockedAvatarIds,
          }
        : current,
    );
  };

  const saveInitialPassword = async () => {
    const validationError = validateNewPasswordFields(password, confirmPassword);
    if (validationError) {
      toast(validationError, "error");
      return;
    }
    setPasswordSaving(true);
    try {
      await postJson("/api/settings/password", { password });
      setSettings((s) => (s ? { ...s, hasPassword: true } : s));
      setPassword("");
      setConfirmPassword("");
      toast("رمز عبور با موفقیت تنظیم شد", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const resetPasswordChangeFlow = () => {
    setOtpStep(false);
    setOtpCode("");
    setMockCode(null);
    setOtpExpiresAt(null);
  };

  const sendPasswordOtp = async () => {
    const validationError = validateNewPasswordFields(password, confirmPassword);
    if (validationError) {
      toast(validationError, "error");
      return;
    }

    setOtpLoading(true);
    try {
      const data = await postJson<{ mockCode?: string }>(
        "/api/settings/password/send-otp",
        {},
      );
      setMockCode(data.mockCode ?? null);
      setOtpExpiresAt(Date.now() + OTP_TTL_MS);
      setOtpStep(true);
      setOtpCode("");
      toast("کد تأیید ارسال شد", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setOtpLoading(false);
    }
  };

  const changePassword = useCallback(
    async (code: string) => {
      if (code.length !== 6 || verifyInFlightRef.current) return;

      const validationError = validateNewPasswordFields(password, confirmPassword);
      if (validationError) {
        toast(validationError, "error");
        resetPasswordChangeFlow();
        return;
      }

      verifyInFlightRef.current = true;
      setPasswordSaving(true);
      try {
        await postJson("/api/settings/password/change", { code, password });
        setPassword("");
        setConfirmPassword("");
        resetPasswordChangeFlow();
        toast("رمز عبور با موفقیت تغییر کرد", "success");
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطا", "error");
        setOtpCode("");
      } finally {
        verifyInFlightRef.current = false;
        setPasswordSaving(false);
      }
    },
    [confirmPassword, password, toast],
  );

  if (loading) {
    return (
      <div className="px-4 py-4">
        <Skeleton className="mb-4 h-12" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="px-4 py-8 text-center text-white/50">تنظیمات در دسترس نیست</div>
    );
  }

  const nameCostLabel =
    settings.nextNameChangeCost === 0
      ? "اولین تغییر نام رایگان است"
      : `هزینه تغییر نام: ${formatPersianNumber(DISPLAY_NAME_CHANGE_COST)} سکه`;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/90 px-4 py-4 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/profile"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:text-white"
              aria-label="بازگشت به پروفایل"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-bordin-orange" />
              <h1 className="text-xl font-bold">تنظیمات</h1>
            </div>
          </div>
          <HeaderToolbar />
        </div>
      </header>

      <div className="space-y-5 px-4 py-4 pb-8">
        <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          <ProfileAvatar
            avatarUrl={settings.avatarUrl}
            displayName={settings.displayName}
            size="lg"
          />
          <div>
            <p className="font-bold text-white">{settings.displayName}</p>
            <p className="mt-1 text-sm text-white/50" dir="ltr">
              {settings.phone}
            </p>
            <p className="mt-2 text-xs text-bordin-orange">
              موجودی: {formatPersianNumber(settings.totalCoins)} سکه
            </p>
          </div>
        </div>

        <SettingsSection title="نام نمایشی">
          <Input
            label="نام شما در بُردین"
            value={displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="مثال: علی۱۳۷۶"
          />
          <ul className="mt-2 space-y-1 text-xs leading-5 text-white/45">
            {DISPLAY_NAME_RULES_FA.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
          {displayName.trim() && getDisplayNameValidationError(displayName) ? (
            <p className="mt-2 text-xs text-red-400">
              {getDisplayNameValidationError(displayName)}
            </p>
          ) : nameDuplicateError ? (
            <p className="mt-2 text-xs text-red-400">{nameDuplicateError}</p>
          ) : nameChecking ? (
            <p className="mt-2 text-xs text-white/45">در حال بررسی نام…</p>
          ) : null}
          <p className="mt-2 text-xs text-white/45">{nameCostLabel}</p>
          <Button
            fullWidth
            className="mt-4"
            loading={nameSaving}
            onClick={saveDisplayName}
            disabled={
              !displayName.trim() ||
              displayName.trim() === settings.displayName ||
              Boolean(getDisplayNameValidationError(displayName)) ||
              Boolean(nameDuplicateError) ||
              nameChecking
            }
          >
            ذخیره نام
          </Button>
        </SettingsSection>

        <SettingsSection title="تصویر پروفایل">
          <p className="mb-4 text-xs text-white/45">
            یکی از آواتارهای فوتبالی را انتخاب کنید
          </p>

          <AvatarCollectionCard
            avatarUrl={settings.avatarUrl}
            displayName={settings.displayName}
            onOpen={() => setCollectionOpen(true)}
          />
        </SettingsSection>

        <SettingsSection title="رمز ورود">
          {!settings.hasPassword ? (
            <div className="space-y-3">
              <p className="text-sm text-white/55">
                برای ورود سریع‌تر با رمز شخصی، یک رمز عبور تعیین کنید.
              </p>
              <Input
                label="رمز عبور جدید"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Input
                label="تکرار رمز عبور"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                className="text-xs text-white/45 hover:text-white"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
              </button>
              <Button fullWidth loading={passwordSaving} onClick={saveInitialPassword}>
                تنظیم رمز عبور
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-white/55">
                برای تغییر رمز، ابتدا کد پیامکی دریافت کنید.
              </p>

              {!otpStep ? (
                <>
                  <Input
                    label="رمز عبور جدید"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Input
                    label="تکرار رمز عبور"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-white/45 hover:text-white"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showPassword ? "مخفی کردن" : "نمایش رمز"}
                  </button>
                  <Button fullWidth loading={otpLoading} onClick={sendPasswordOtp}>
                    دریافت کد پیامکی
                  </Button>
                </>
              ) : (
                <>
                  {mockCode ? (
                    <p className="text-center font-mono text-sm text-bordin-orange">
                      کد تست: {mockCode}
                    </p>
                  ) : null}
                  <OtpInput
                    value={otpCode}
                    onChange={setOtpCode}
                    onComplete={changePassword}
                    disabled={passwordSaving}
                  />
                  {otpExpiresAt && countdownMs > 0 ? (
                    <p className="text-center text-xs text-white/45">
                      اعتبار کد: {Math.ceil(countdownMs / 1000)} ثانیه
                    </p>
                  ) : null}
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={resetPasswordChangeFlow}
                  >
                    انصراف
                  </Button>
                </>
              )}
            </div>
          )}
        </SettingsSection>
      </div>

      <AvatarCollectionModal
        open={collectionOpen}
        onClose={() => setCollectionOpen(false)}
        currentAvatarId={settings.avatarUrl}
        totalCoins={settings.totalCoins}
        unlockedAvatarIds={settings.unlockedAvatarIds ?? []}
        onAvatarUpdated={handleAvatarUpdated}
      />
    </>
  );
}
