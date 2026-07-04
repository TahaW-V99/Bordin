"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/shared/components/layout/page-header";
import { CompetitionTabs, CompFilter, CompTab } from "@/shared/components/competition/competition-tabs";
import { CompetitionCard } from "@/shared/components/competition/competition-card";
import {
  TeamCompetitionCard,
  type TeamCompetitionCardData,
} from "@/features/competitions/components/team-competition-card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Trophy } from "lucide-react";

export function CompetitionsPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as CompTab) || "cups";
  const initialFilter = (searchParams.get("filter") as CompFilter) || "upcoming";

  const [tab, setTab] = useState<CompTab>(
    initialTab === "teams" || initialTab === "tournaments" ? initialTab : "cups",
  );
  const [filter, setFilter] = useState<CompFilter>(
    initialFilter === "active" || initialFilter === "finished" ? initialFilter : "upcoming",
  );
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = searchParams.get("tab") as CompTab | null;
    const f = searchParams.get("filter") as CompFilter | null;
    if (t === "teams" || t === "tournaments" || t === "cups") setTab(t);
    if (f === "upcoming" || f === "active" || f === "finished" || f === "joined") setFilter(f);
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    const teamApiFilter =
      filter === "joined" || filter === "active" ? "active" : filter === "finished" ? "finished" : "upcoming";
    const endpoint =
      tab === "cups"
        ? `/api/cups?filter=${filter}`
        : tab === "tournaments"
          ? `/api/tournaments?filter=${filter}`
          : `/api/team-competitions?filter=${teamApiFilter}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    const key = tab === "cups" ? "cups" : tab === "tournaments" ? "tournaments" : "teamCompetitions";
    const rawItems = data[key];
    setItems(Array.isArray(rawItems) ? rawItems : []);
    setLoading(false);
  }, [tab, filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader title="مسابقات" subtitle="جام · تورنمنت · رقابت‌های تیمی" />
      <CompetitionTabs
        activeTab={tab}
        onTabChange={setTab}
        activeFilter={filter}
        onFilterChange={setFilter}
      />
      <div className="space-y-3 px-4 py-4">
        {loading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : items.length === 0 ? (
          <EmptyState icon={Trophy} title="موردی یافت نشد" description="در این فیلتر مسابقه‌ای نیست." />
        ) : tab === "teams" ? (
          items.map((item) => (
            <TeamCompetitionCard key={item.id as string} data={item as TeamCompetitionCardData} />
          ))
        ) : (
          items.map((item) => {
            const id = item.id as string;
            const href =
              tab === "cups"
                ? `/competitions/cups/${id}`
                : `/competitions/tournaments/${id}`;
            return (
              <CompetitionCard
                key={id}
                href={href}
                title={(item.titleFa ?? item.nameFa) as string}
                subtitle={item.description as string | undefined}
                fee={(item.entryFeeCoins ?? item.registrationFeeCoins) as number | undefined}
                status={item.status as string}
                mode={item.mode as string | undefined}
              />
            );
          })
        )}
      </div>
    </>
  );
}
