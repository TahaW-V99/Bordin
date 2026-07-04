"use client";

import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { cn } from "@/shared/lib/cn";

export function MissionGoldenProgressBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <ProgressBar
        value={value}
        max={max}
        accent="gold"
        className="h-2.5 border border-[#f5b942]/25 bg-black/40"
      />
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-[#ffd54a]/20" />
    </div>
  );
}
