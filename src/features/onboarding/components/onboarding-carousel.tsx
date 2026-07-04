"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { useToast } from "@/shared/components/ui/toast";
import { cn } from "@/shared/lib/cn";
import { ONBOARDING_SLIDES } from "@/features/onboarding/data/slides";
import { OnboardingSlideArt } from "@/features/onboarding/components/onboarding-slide-art";

export function OnboardingCarousel() {
  const router = useRouter();
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const slide = ONBOARDING_SLIDES[index];
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const finish = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/onboarding-complete", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? "خطا در تکمیل آشنایی");
      }

      router.refresh();
      window.location.assign("/home");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا در ورود به بُردین", "error");
      setLoading(false);
    }
  };

  const next = () => {
    if (isLast) {
      void finish();
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden px-6 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,161,0,0.1)_0%,_transparent_55%)]" />

      <div className="relative mb-6 flex flex-col items-center">
        <div className="mb-2 flex w-full max-w-md items-center justify-between text-xs text-white/40">
          <span>آشنایی با بُردین</span>
          <span>
            {index + 1} از {ONBOARDING_SLIDES.length}
          </span>
        </div>
        <ProgressBar
          value={index + 1}
          max={ONBOARDING_SLIDES.length}
          accent={slide.accent === "green" ? "green" : slide.accent === "purple" ? "purple" : "orange"}
          className="max-w-md"
        />
      </div>

      <div
        key={slide.id}
        className="relative flex flex-1 flex-col items-center justify-center text-center onboarding-slide-enter"
      >
        <OnboardingSlideArt slideId={slide.id} className="mb-8" />

        <h2 className="mb-4 max-w-sm text-2xl font-bold leading-snug text-white">
          {slide.title}
        </h2>
        <p className="max-w-sm text-base leading-8 text-white/60">{slide.description}</p>
      </div>

      <div className="relative mt-8 space-y-4 pb-4 safe-bottom">
        <div className="flex justify-center gap-2">
          {ONBOARDING_SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-6 bg-bordin-orange" : "w-1.5 bg-white/20",
              )}
              aria-hidden
            />
          ))}
        </div>

        <Button fullWidth size="lg" loading={loading} onClick={next}>
          {isLast ? (
            "بزن بریم"
          ) : (
            <>
              بعدی
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
