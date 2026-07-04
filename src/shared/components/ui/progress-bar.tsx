import { cn } from "@/shared/lib/cn";

export function ProgressBar({
  value,
  max = 100,
  className,
  accent = "orange",
}: {
  value: number;
  max?: number;
  className?: string;
  accent?: "orange" | "green" | "purple" | "gold";
}) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const accents = {
    orange: "bg-bordin-orange",
    green: "bg-bordin-green",
    purple: "bg-bordin-purple",
    gold: "bg-gradient-to-l from-[#ffd54a] via-[#f5b942] to-[#c8962e] shadow-[0_0_12px_rgba(245,185,66,0.45)]",
  };

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/10", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", accents[accent])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
