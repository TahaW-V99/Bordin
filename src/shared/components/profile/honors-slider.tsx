"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import { buildHonorsList, type EarnedMedalInput, type HonorItem } from "@/shared/lib/honors";

const MEDAL_SIZE = 168;
const MEDAL_BOX_CLASS = "h-[168px] w-[168px] shrink-0";

const PARTICLE_LAYOUT = [
  { top: "14%", left: "22%", delay: "0s", size: 1.5 },
  { top: "22%", right: "18%", delay: "1.6s", size: 1 },
  { bottom: "18%", left: "16%", delay: "0.8s", size: 1.25 },
  { bottom: "12%", right: "20%", delay: "2.2s", size: 1 },
  { top: "48%", left: "8%", delay: "1.1s", size: 0.75 },
  { top: "44%", right: "10%", delay: "1.9s", size: 0.75 },
] as const;

function honorEffectVars(honor: HonorItem): React.CSSProperties {
  const intensity = honor.glowIntensity;
  const tierBoost =
    honor.tier === "DARK_PURPLE" ? 1.15 : honor.tier === "GOLD" ? 1.08 : honor.tier === "SILVER" ? 1 : 0.9;

  return {
    ["--honor-glow-color" as string]: honor.glowColor,
    ["--honor-glow-base" as string]: String(intensity * tierBoost),
    ["--honor-glow-outer" as string]: String(intensity * tierBoost * 0.55),
    ["--honor-pulse-duration" as string]:
      honor.tier === "BRONZE" ? "4.6s" : honor.tier === "SILVER" ? "4.2s" : "3.8s",
  };
}

function particleCount(honor: HonorItem) {
  if (!honor.hasParticles) return 0;
  if (honor.tier === "DARK_PURPLE" || honor.category === "TOURNAMENT" || honor.slug === "team-qahraman") {
    return 3;
  }
  return 2;
}

function HonorParticles({ honor }: { honor: HonorItem }) {
  const count = particleCount(honor);
  if (count === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
      {PARTICLE_LAYOUT.slice(0, count).map((pos, i) => (
        <span
          key={i}
          className="honor-particle absolute rounded-full"
          style={{
            ...("top" in pos ? { top: pos.top } : {}),
            ...("left" in pos ? { left: pos.left } : {}),
            ...("right" in pos ? { right: pos.right } : {}),
            ...("bottom" in pos ? { bottom: pos.bottom } : {}),
            width: `${pos.size}px`,
            height: `${pos.size}px`,
            backgroundColor: honor.glowColor,
            animationDelay: pos.delay,
          }}
        />
      ))}
    </div>
  );
}

function EarnedMedalEffects({
  honor,
  showShine,
}: {
  honor: HonorItem;
  showShine: boolean;
}) {
  return (
    <>
      <div
        className="honor-spotlight pointer-events-none absolute inset-[-36%] z-0"
        style={honorEffectVars(honor)}
        aria-hidden
      />
      <div
        className="honor-glow-outer pointer-events-none absolute inset-[-24%] z-0"
        style={honorEffectVars(honor)}
        aria-hidden
      />
      <div
        className="honor-glow-core pointer-events-none absolute inset-[-10%] z-[1]"
        style={honorEffectVars(honor)}
        aria-hidden
      />
      <HonorParticles honor={honor} />
      {showShine ? (
        <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden" aria-hidden>
          <div className="honor-shine absolute inset-y-[-8%] w-[38%] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
      ) : null}
    </>
  );
}

function MedalImage({
  honor,
  variant,
  showShine = false,
}: {
  honor: HonorItem;
  variant: "peek" | "active";
  showShine?: boolean;
}) {
  const isActive = variant === "active";
  const isEarned = honor.earned;
  const effectVars = isActive && isEarned ? honorEffectVars(honor) : undefined;

  return (
    <div
      className={cn(
        "honor-medal-stage relative flex items-center justify-center",
        "transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
        MEDAL_BOX_CLASS,
      )}
      style={effectVars}
    >
      {isActive && isEarned ? <EarnedMedalEffects honor={honor} showShine={showShine} /> : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={honor.imageUrl}
        alt=""
        height={MEDAL_SIZE}
        draggable={false}
        className={cn(
          "honor-medal-img relative z-[2] max-w-none object-contain object-center",
          "transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          isEarned ? "honor-medal-img--earned" : "honor-medal-img--locked",
          isActive && isEarned && "honor-medal-img--active",
        )}
      />
    </div>
  );
}

function PeekMedal({
  honor,
  side,
  onClick,
}: {
  honor: HonorItem;
  side: "start" | "end";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-[1] -translate-y-1/2 opacity-40 transition-opacity duration-[420ms] hover:opacity-65",
        side === "start" ? "start-0 translate-x-[-52%]" : "end-0 translate-x-[52%]",
      )}
      aria-label={`${honor.titleFa} — ${honor.subtitleFa}`}
    >
      <MedalImage honor={honor} variant="peek" />
    </button>
  );
}

export function HonorsSlider({
  earnedMedals = [],
  slugFilter,
}: {
  earnedMedals?: EarnedMedalInput[];
  slugFilter?: readonly string[];
}) {
  const displayHonors = useMemo(() => {
    const list = buildHonorsList(earnedMedals);
    if (slugFilter?.length) {
      return list.filter((h) => slugFilter.includes(h.slug));
    }
    return list;
  }, [earnedMedals, slugFilter]);
  const [index, setIndex] = useState(0);
  const [shine, setShine] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const pointerStartX = useRef(0);
  const pointerStartY = useRef(0);
  const shineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const earnedKey = useMemo(
    () => earnedMedals.map((m) => m.medal?.slug ?? "").join("|"),
    [earnedMedals],
  );

  const total = displayHonors.length;
  const active = displayHonors[index];
  const prev = index > 0 ? displayHonors[index - 1] : null;
  const next = index < total - 1 ? displayHonors[index + 1] : null;
  const earnedCount = displayHonors.filter((h) => h.earned).length;

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(total - 1, nextIndex));
      if (clamped === index) return;
      setIndex(clamped);
      setAnimKey((k) => k + 1);
      setShine(false);
      if (shineTimer.current) clearTimeout(shineTimer.current);
      requestAnimationFrame(() => {
        setShine(true);
        shineTimer.current = setTimeout(() => setShine(false), 480);
      });
    },
    [index, total],
  );

  useEffect(() => {
    const firstEarned = displayHonors.findIndex((h) => h.earned);
    const nextIndex = firstEarned >= 0 ? firstEarned : 0;
    setIndex(nextIndex);
    setAnimKey((k) => k + 1);
    if (firstEarned >= 0) {
      setShine(true);
      if (shineTimer.current) clearTimeout(shineTimer.current);
      shineTimer.current = setTimeout(() => setShine(false), 480);
    }
  }, [earnedKey, displayHonors]);

  useEffect(
    () => () => {
      if (shineTimer.current) clearTimeout(shineTimer.current);
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    pointerStartX.current = e.clientX;
    pointerStartY.current = e.clientY;
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const dx = e.clientX - pointerStartX.current;
    const dy = e.clientY - pointerStartY.current;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx > 0) goTo(index - 1);
    else goTo(index + 1);
  };

  if (!active) return null;

  const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

  return (
    <div className="honors-showcase overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent">
      <div className="flex items-center justify-between border-b border-white/6 px-4 py-2.5 text-[11px] text-white/45">
        <span>
          {formatPersianNumber(earnedCount)} از {formatPersianNumber(total)} افتخار
        </span>
        <span className="text-white/30">
          {formatPersianNumber(index + 1)} / {formatPersianNumber(total)}
        </span>
      </div>

      <div
        className="relative touch-pan-y overflow-x-hidden px-3 py-10 sm:px-4 sm:py-12"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-y-0 start-0 z-20 w-10 bg-gradient-to-l from-[#0a0a0a]/95 to-transparent sm:w-14" />
        <div className="pointer-events-none absolute inset-y-0 end-0 z-20 w-10 bg-gradient-to-r from-[#0a0a0a]/95 to-transparent sm:w-14" />

        <div className="relative mx-auto flex min-h-[188px] max-w-full items-center justify-center overflow-visible">
          {prev ? <PeekMedal honor={prev} side="start" onClick={() => goTo(index - 1)} /> : null}

          <div
            key={`${active.slug}-${animKey}`}
            className="honor-slide-enter relative z-[5] flex w-full flex-col items-center px-2"
          >
            <MedalImage honor={active} variant="active" showShine={shine && active.earned} />

            {!active.earned ? (
              <div className="mt-3 flex h-5 items-center justify-center">
                <Lock className="h-4 w-4 text-white/40" strokeWidth={2} aria-hidden />
              </div>
            ) : (
              <div className="mt-3 h-5" aria-hidden />
            )}

            <p
              className={cn(
                "mt-1 text-center text-sm font-bold transition-colors duration-[400ms]",
                active.earned ? "text-white" : "text-white/40",
              )}
            >
              {active.titleFa}
            </p>
            <p
              className={cn(
                "mt-0.5 text-center text-[11px] transition-colors duration-[400ms]",
                active.earned ? "text-bordin-orange/90" : "text-white/25",
              )}
            >
              {active.subtitleFa}
            </p>

            {active.earned && active.earnedReason?.trim() ? (
              <p
                className="mt-2 max-w-[220px] truncate text-center text-[10px] text-white/35"
                title={active.earnedReason}
              >
                {active.earnedReason}
              </p>
            ) : null}
          </div>

          {next ? <PeekMedal honor={next} side="end" onClick={() => goTo(index + 1)} /> : null}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-white/6 px-4 py-3">
        <button
          type="button"
          aria-label="افتخار قبلی"
          disabled={index === 0}
          onClick={() => goTo(index - 1)}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition",
            "hover:border-bordin-orange/30 hover:text-bordin-orange disabled:pointer-events-none disabled:opacity-25",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-bordin-orange to-bordin-orange/60 transition-all duration-[420ms] ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          type="button"
          aria-label="افتخار بعدی"
          disabled={index >= total - 1}
          onClick={() => goTo(index + 1)}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition",
            "hover:border-bordin-orange/30 hover:text-bordin-orange disabled:pointer-events-none disabled:opacity-25",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
