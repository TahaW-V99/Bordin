"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useToast } from "@/shared/components/ui/toast";
import { isValidIranMobile, normalizePhone } from "@/shared/lib/phone";
import { OtpInput } from "@/features/auth/components/otp-input";
import { OTP_TTL_MS } from "@/shared/constants/auth";

type AuthMethod = "sms" | "password";
type Step = "phone" | "otp" | "password";

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

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [method, setMethod] = useState<AuthMethod>("sms");
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);
  const [otpError, setOtpError] = useState(false);
  const [showReferralField, setShowReferralField] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    const ref = searchParams.get("ref")?.trim();
    if (ref) {
      setReferralCode(ref);
      setShowReferralField(true);
    }
  }, [searchParams]);

  useEffect(() => {
    void fetch("/api/health?warm=1", { cache: "no-store" });
  }, []);

  const warmAuthPath = useCallback(() => {
    void fetch("/api/health?warm=1", { cache: "no-store" });
  }, []);

  useEffect(() => {
    if (!otpExpiresAt) return;
    const tick = () => setCountdownMs(Math.max(0, otpExpiresAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [otpExpiresAt]);

  const normalizedPhone = normalizePhone(phone);
  const canResend = otpExpiresAt !== null && countdownMs === 0;

  const redirectAfterLogin = (needsOnboarding: boolean) => {
    router.push(needsOnboarding ? "/onboarding" : "/home");
  };

  const switchMethod = (next: AuthMethod) => {
    setMethod(next);
    setStep("phone");
    setCode("");
    setPassword("");
    setOtpError(false);
    setMockCode(null);
    setOtpExpiresAt(null);
  };

  const sendOtp = async (isResend = false) => {
    if (!isValidIranMobile(normalizedPhone)) {
      toast("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۳۴۵۶۷۸۹", "error");
      return;
    }

    setLoading(true);
    setOtpError(false);
    try {
      const data = await postJson<{
        mockCode?: string;
        expiresAt?: string;
      }>(isResend ? "/api/auth/resend-otp" : "/api/auth/send-otp", {
        phone: normalizedPhone,
        ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
      });
      setMockCode(data.mockCode ?? null);
      setOtpExpiresAt(Date.now() + OTP_TTL_MS);
      setCode("");
      setStep("otp");
      toast(isResend ? "کد جدید ارسال شد" : "کد تأیید ارسال شد", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در ارسال کد", "error");
    } finally {
      setLoading(false);
    }
  };

  const editPhone = async () => {
    if (normalizedPhone) {
      try {
        await postJson("/api/auth/invalidate-otp", { phone: normalizedPhone });
      } catch {
        /* ignore — session may already be gone */
      }
    }
    setStep("phone");
    setCode("");
    setOtpError(false);
    setMockCode(null);
    setOtpExpiresAt(null);
  };

  const verifyOtp = useCallback(
    async (otpCode: string) => {
      if (otpCode.length !== 6 || verifyInFlightRef.current) return;
      verifyInFlightRef.current = true;
      setLoading(true);
      setOtpError(false);
      try {
        const data = await postJson<{ needsOnboarding: boolean }>(
          "/api/auth/verify-otp",
          { phone: normalizedPhone, code: otpCode },
        );
        router.push(data.needsOnboarding ? "/onboarding" : "/home");
      } catch (e) {
        setOtpError(true);
        toast(e instanceof Error ? e.message : "خطا در تأیید کد", "error");
      } finally {
        verifyInFlightRef.current = false;
        setLoading(false);
      }
    },
    [normalizedPhone, router, toast],
  );

  const continueWithPassword = async () => {
    if (!isValidIranMobile(normalizedPhone)) {
      toast("شماره موبایل معتبر نیست", "error");
      return;
    }
    setLoading(true);
    try {
      const data = await postJson<{ hasPassword: boolean }>(
        "/api/auth/check-phone",
        { phone: normalizedPhone },
      );
      if (!data.hasPassword) {
        toast("برای این شماره رمز عبور تنظیم نشده. با کد پیامکی وارد شوید.", "error");
        return;
      }
      setStep("password");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async () => {
    if (!password.trim()) {
      toast("رمز عبور را وارد کنید", "error");
      return;
    }
    setLoading(true);
    try {
      const data = await postJson<{ needsOnboarding: boolean }>(
        "/api/auth/login-password",
        { phone: normalizedPhone, password },
      );
      redirectAfterLogin(data.needsOnboarding);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در ورود", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Method toggle */}
      <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => switchMethod("sms")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
            method === "sms"
              ? "bg-bordin-orange text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          ورود با پیامک
        </button>
        <button
          type="button"
          onClick={() => switchMethod("password")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition ${
            method === "password"
              ? "bg-bordin-orange text-black"
              : "text-white/60 hover:text-white"
          }`}
        >
          ورود با رمز
        </button>
      </div>

      {step === "phone" && (
        <>
          <Input
            label="شماره موبایل"
            placeholder="۰۹۱۲۳۴۵۶۷۸۹"
            inputMode="tel"
            dir="ltr"
            className="text-left"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onFocus={warmAuthPath}
          />
          {showReferralField ? (
            <Input
              label="کد معرف"
              placeholder="کد دعوت دوست خود را وارد کنید"
              dir="ltr"
              className="text-left"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowReferralField(true)}
              className="text-sm text-bordin-orange hover:underline"
            >
              کد معرف دارید؟
            </button>
          )}
          {method === "sms" ? (
            <Button fullWidth loading={loading} onClick={() => sendOtp(false)}>
              دریافت کد تأیید
            </Button>
          ) : (
            <Button fullWidth loading={loading} onClick={continueWithPassword}>
              ادامه
            </Button>
          )}
        </>
      )}

      {step === "otp" && method === "sms" && (
        <>
          <p className="text-center text-sm text-white/60">
            کد ۶ رقمی به{" "}
            <span className="font-medium text-white" dir="ltr">
              {phone}
            </span>{" "}
            ارسال شد
          </p>
          {mockCode ? (
            <p className="text-center font-mono text-sm text-bordin-orange">
              کد تست: {mockCode}
            </p>
          ) : null}

          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={verifyOtp}
            disabled={loading}
            error={otpError}
          />

          {otpExpiresAt !== null && countdownMs > 0 ? (
            <p className="text-center text-sm text-white/50">
              ارسال مجدد تا{" "}
              <span className="font-mono text-bordin-orange">
                {formatCountdown(countdownMs)}
              </span>
            </p>
          ) : (
            <Button
              variant="ghost"
              fullWidth
              disabled={!canResend || loading}
              onClick={() => sendOtp(true)}
            >
              ارسال مجدد کد
            </Button>
          )}

          {loading ? (
            <p className="text-center text-xs text-white/40">در حال تأیید...</p>
          ) : null}

          <Button variant="ghost" fullWidth onClick={editPhone}>
            ویرایش شماره
          </Button>
        </>
      )}

      {step === "password" && method === "password" && (
        <>
          <p className="text-sm text-white/60">
            ورود با رمز برای{" "}
            <span className="text-white" dir="ltr">
              {phone}
            </span>
          </p>
          <div className="relative">
            <Input
              label="رمز عبور"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loginWithPassword()}
            />
            <button
              type="button"
              aria-label={showPassword ? "مخفی کردن رمز" : "نمایش رمز"}
              className="absolute left-3 top-[2.35rem] text-white/40 hover:text-white"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <Button fullWidth loading={loading} onClick={loginWithPassword}>
            ورود به بُردین
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setStep("phone")}>
            بازگشت
          </Button>
        </>
      )}
    </div>
  );
}
