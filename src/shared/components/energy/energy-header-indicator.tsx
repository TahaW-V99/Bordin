"use client";

import { useCallback, useEffect, useState } from "react";
import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { ENERGY_UPDATED_EVENT } from "@/shared/constants/energy";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";

export function EnergyHeaderIndicator({ className }: { className?: string }) {
  const [energyPercent, setEnergyPercent] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/user/energy", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const value = data.energy?.energyPercent;
      if (typeof value === "number") {
        setEnergyPercent(Math.round(value));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ energyPercent?: number }>).detail;
      if (typeof detail?.energyPercent === "number") {
        setEnergyPercent(Math.round(detail.energyPercent));
        return;
      }
      void load();
    };
    window.addEventListener(ENERGY_UPDATED_EVENT, onUpdate);
    window.addEventListener("focus", onUpdate);
    return () => {
      window.removeEventListener(ENERGY_UPDATED_EVENT, onUpdate);
      window.removeEventListener("focus", onUpdate);
    };
  }, [load]);

  return (
    <div
      className={cn(
        "flex min-w-[72px] max-w-[120px] items-center rounded-xl border border-white/10 bg-white/5 px-2 py-1.5",
        className,
      )}
      aria-label="سطح انرژی فوتبالی"
      title="سطح انرژی فوتبالی"
    >
      <div className="min-w-0 flex-1">
        <ProgressBar
          value={energyPercent ?? 0}
          max={100}
          accent="green"
          className="h-1.5"
        />
        <p className="mt-0.5 text-[10px] leading-none text-white/60">
          {energyPercent === null ? "—" : `${formatPersianNumber(energyPercent)}٪`}
        </p>
      </div>
    </div>
  );
}
