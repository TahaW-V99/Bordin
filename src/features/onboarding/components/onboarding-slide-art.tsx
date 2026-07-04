import type { ReactNode } from "react";
import Image from "next/image";
import { BordinLogo } from "@/shared/components/bordin-logo";
import { cn } from "@/shared/lib/cn";

type SlideArtProps = {
  slideId: number;
  className?: string;
};

function PredictArt() {
  return (
    <div className="overflow-hidden rounded-[1.75rem] bg-[#080808]">
      <Image
        src="/images/onboarding/slide-2.jpg"
        alt="نمایش ثبت پیش‌بینی و دریافت جایزه"
        width={287}
        height={205}
        className="h-auto w-[287px] max-w-full object-contain"
        priority
      />
    </div>
  );
}

function LevelArt() {
  const barHeight = 32;
  const steps = [
    {
      y: 44,
      width: 140,
      label: "اسطوره",
      fill: "rgba(86,255,98,0.35)",
      stroke: "#56ff62",
      textFill: "#56ff62",
    },
    {
      y: 84,
      width: 118,
      label: null,
      fill: "rgba(255,82,200,0.22)",
      stroke: "rgba(255,255,255,0.08)",
      textFill: "#fff",
    },
    {
      y: 124,
      width: 96,
      label: null,
      fill: "rgba(255,161,0,0.22)",
      stroke: "rgba(255,255,255,0.08)",
      textFill: "#fff",
    },
    {
      y: 164,
      width: 84,
      label: "تماشاگر",
      fill: "rgba(255,255,255,0.12)",
      stroke: "rgba(255,255,255,0.18)",
      textFill: "rgba(255,255,255,0.85)",
    },
  ];

  return (
    <svg viewBox="0 0 240 240" fill="none" aria-hidden className="h-full w-full">
      {steps.map((step, i) => {
        const x = 120 - step.width / 2;
        const centerY = step.y + barHeight / 2;

        return (
          <g key={i}>
            <rect
              x={x}
              y={step.y}
              width={step.width}
              height={barHeight}
              rx={16}
              fill={step.fill}
              stroke={step.stroke}
              strokeWidth={step.label ? 1.5 : 1}
            />
            {step.label ? (
              <text
                x={120}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="central"
                fill={step.textFill}
                fontSize="12"
                fontWeight="700"
                fontFamily="Vazirmatn Variable, Vazirmatn, Tahoma, sans-serif"
              >
                {step.label}
              </text>
            ) : null}
          </g>
        );
      })}

      <path
        d="M52 180 L52 52"
        stroke="rgba(255,161,0,0.5)"
        strokeWidth="2"
        strokeDasharray="4 5"
        strokeLinecap="round"
      />
      <polygon points="52,44 44,60 60,60" fill="#ffa100" />
    </svg>
  );
}

function MedalArt() {
  return (
    <Image
      src="/images/onboarding/slide-4.png"
      alt="مدال‌های بوردین و مسیر اسطوره شدن"
      width={216}
      height={212}
      className="h-auto w-[216px] max-w-full object-contain"
      priority
    />
  );
}

function CompetitionArt() {
  return (
    <Image
      src="/images/onboarding/slide-5.png"
      alt="رقابت‌های گروهی و کاپ‌های بوردین"
      width={287}
      height={410}
      className="h-auto max-h-[24rem] w-auto max-w-full object-contain"
      priority
    />
  );
}

const artBySlide: Partial<Record<number, () => ReactNode>> = {
  2: PredictArt,
  3: LevelArt,
  4: MedalArt,
  5: CompetitionArt,
};

const accentRing: Record<number, string> = {
  1: "from-bordin-orange/20 to-transparent shadow-[0_0_40px_rgba(255,161,0,0.15)]",
  2: "from-bordin-green/20 to-transparent shadow-[0_0_40px_rgba(86,255,98,0.12)]",
  3: "from-bordin-purple/20 to-transparent shadow-[0_0_40px_rgba(255,82,200,0.12)]",
  4: "from-bordin-orange/20 to-transparent shadow-[0_0_40px_rgba(255,161,0,0.15)]",
  5: "from-bordin-green/20 to-transparent shadow-[0_0_40px_rgba(86,255,98,0.12)]",
};

export function OnboardingSlideArt({ slideId, className }: SlideArtProps) {
  if (slideId === 1) {
    return (
      <div
        className={cn(
          "relative flex h-56 w-56 items-center justify-center",
          className,
        )}
      >
        <BordinLogo size={224} className="rounded-[2rem]" />
      </div>
    );
  }

  const Art = artBySlide[slideId] ?? PredictArt;

  return (
    <div
      className={cn(
        "relative flex min-h-56 w-full max-w-[20rem] items-center justify-center rounded-[2rem] border border-white/8 bg-gradient-to-b p-4",
        accentRing[slideId],
        className,
      )}
    >
      <Art />
    </div>
  );
}
