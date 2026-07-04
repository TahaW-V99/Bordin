"use client";

import { Chip } from "@/shared/components/ui/chip";

const tabs = [
  { id: "cups", label: "جام‌ها" },
  { id: "tournaments", label: "تورنمنت" },
  { id: "teams", label: "رقابت‌های تیمی" },
] as const;

const defaultFilters = [
  { id: "upcoming", label: "آینده" },
  { id: "joined", label: "عضو شده" },
  { id: "finished", label: "پایان‌یافته" },
] as const;

const teamFilters = [
  { id: "upcoming", label: "رقابت‌های آینده" },
  { id: "active", label: "رقابت‌های فعال" },
  { id: "finished", label: "رقابت‌های پایان یافته" },
] as const;

export type CompTab = (typeof tabs)[number]["id"];
export type CompFilter = "upcoming" | "joined" | "active" | "finished";

export function CompetitionTabs({
  activeTab,
  onTabChange,
  activeFilter,
  onFilterChange,
}: {
  activeTab: CompTab;
  onTabChange: (t: CompTab) => void;
  activeFilter: CompFilter;
  onFilterChange: (f: CompFilter) => void;
}) {
  const filters = activeTab === "teams" ? teamFilters : defaultFilters;

  return (
    <div className="space-y-3 px-4">
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {tabs.map((t) => (
          <Chip key={t.id} active={activeTab === t.id} onClick={() => onTabChange(t.id)}>
            {t.label}
          </Chip>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {filters.map((f) => (
          <Chip key={f.id} active={activeFilter === f.id} onClick={() => onFilterChange(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
