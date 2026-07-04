"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { formatPersianNumber } from "@/shared/lib/dates";
import { Skeleton } from "@/shared/components/ui/skeleton";

type CompetitionGroup = {
  competitionId: number;
  competitionName: string;
  matchCount: number;
};

type AdminCompetitionCategoryPickerProps = {
  selectedCompetitionIds: number[];
  onChange: (competitionIds: number[]) => void;
  label?: string;
};

export function AdminCompetitionCategoryPicker({
  selectedCompetitionIds,
  onChange,
  label = "دسته‌بندی مسابقات",
}: AdminCompetitionCategoryPickerProps) {
  const [competitions, setCompetitions] = useState<CompetitionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/football/competitions")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "خطا در دریافت دسته‌بندی‌ها");
        return data;
      })
      .then((data) => setCompetitions(data.competitions ?? []))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "خطا در دریافت دسته‌بندی‌ها"),
      )
      .finally(() => setLoading(false));
  }, []);

  const toggle = (competitionId: number) => {
    if (selectedCompetitionIds.includes(competitionId)) {
      onChange(selectedCompetitionIds.filter((id) => id !== competitionId));
    } else {
      onChange([...selectedCompetitionIds, competitionId]);
    }
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <span className="text-xs text-white/40">
          {formatPersianNumber(selectedCompetitionIds.length)} دسته انتخاب شده
        </span>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="max-h-80 space-y-1 overflow-y-auto rounded-xl border border-white/8 p-2">
        {competitions.length === 0 ? (
          <p className="p-3 text-center text-sm text-white/40">
            دسته‌بندی مسابقه‌ای در یک ماه آینده یافت نشد
          </p>
        ) : (
          competitions.map((group) => {
            const checked = selectedCompetitionIds.includes(group.competitionId);
            return (
              <label
                key={group.competitionId}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm",
                  checked ? "bg-bordin-orange/10" : "hover:bg-white/5",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(group.competitionId)}
                  />
                  <span className="font-semibold">{group.competitionName}</span>
                </span>
                <span className="text-xs text-white/45">
                  {formatPersianNumber(group.matchCount)} بازی
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
