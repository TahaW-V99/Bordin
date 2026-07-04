"use client";

import { cn } from "@/shared/lib/cn";

export type WeekDayItem = {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
};

export function WeekDayStrip({
  days,
  selectedDate,
  onSelect,
}: {
  days: WeekDayItem[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
      {days.map((day) => {
        const active = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            onClick={() => onSelect(day.date)}
            className={cn(
              "min-w-[4.75rem] shrink-0 rounded-2xl border px-3 py-3 text-center transition",
              active
                ? "border-bordin-orange bg-bordin-orange/15 text-white shadow-glow-orange"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20",
            )}
          >
            <p className="text-xs font-medium">{day.label}</p>
            <p className={cn("mt-1 text-[10px]", active ? "text-bordin-orange" : "text-white/40")}>
              {day.isToday ? "امروز" : day.shortLabel}
            </p>
          </button>
        );
      })}
    </div>
  );
}
