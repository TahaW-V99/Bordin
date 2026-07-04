"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { cn } from "@/shared/lib/cn";
import { TEAM_INTRO_SLIDES } from "@/shared/constants/teams";

export function TeamIntroSlider({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = TEAM_INTRO_SLIDES[index];
  const isLast = index === TEAM_INTRO_SLIDES.length - 1;

  return (
    <div className="flex min-h-dvh flex-col px-6 pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
      <div className="mb-4 shrink-0">
        <div className="mb-2 flex items-center justify-between text-xs text-white/40">
          <span>آشنایی با تیم‌ها</span>
          <span>
            {index + 1} از {TEAM_INTRO_SLIDES.length}
          </span>
        </div>
        <ProgressBar value={index + 1} max={TEAM_INTRO_SLIDES.length} className="max-w-md" />
      </div>

      <div
        key={slide.id}
        className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto py-4 text-center onboarding-slide-enter"
      >
        <div className="mb-6 flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-bordin-orange/15 text-4xl">
          ⚽
        </div>
        <h2 className="mb-3 max-w-sm text-xl font-bold leading-snug">{slide.title}</h2>
        <p className="max-w-sm text-sm leading-8 text-white/60">{slide.description}</p>
      </div>

      <div className="shrink-0 space-y-4 pt-2">
        <div className="flex justify-center gap-2">
          {TEAM_INTRO_SLIDES.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-bordin-orange" : "w-1.5 bg-white/20",
              )}
            />
          ))}
        </div>
        <Button
          fullWidth
          size="lg"
          onClick={() => {
            if (isLast) onComplete();
            else setIndex((i) => i + 1);
          }}
        >
          {isLast ? (
            "بریم بسازیم"
          ) : (
            <>
              بعدی
              <ChevronLeft className="h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
