import { ProgressBar } from "@/shared/components/ui/progress-bar";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import { LEVELS } from "@/shared/constants/reward-tables";

export function LevelBadge({
  levelName,
  totalXp,
  className,
}: {
  levelName: string;
  totalXp: number;
  className?: string;
}) {
  const sorted = [...LEVELS].sort((a, b) => a.xpThreshold - b.xpThreshold);
  const currentIdx = sorted.findIndex((l) => l.nameFa === levelName);
  const current = sorted[currentIdx] ?? sorted[0];
  const next = sorted[currentIdx + 1];
  const progress = next
    ? ((totalXp - current.xpThreshold) / (next.xpThreshold - current.xpThreshold)) * 100
    : 100;

  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-bordin-orange/20 bg-bordin-orange/5 p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/50">سطح فعلی</p>
          <p className="text-lg font-bold text-bordin-orange">{levelName}</p>
        </div>
        <div className="text-left">
          <p className="text-xs text-white/50">XP</p>
          <p className="font-bold">{formatPersianNumber(totalXp)}</p>
        </div>
      </div>
      {next ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-white/40">
            <span>{current.nameFa}</span>
            <span>{next.nameFa}</span>
          </div>
          <ProgressBar value={progress} accent="orange" />
        </div>
      ) : null}
    </div>
  );
}
