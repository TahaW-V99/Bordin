"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { formatTehranDateTime } from "@/shared/lib/dates";
import { Skeleton } from "@/shared/components/ui/skeleton";

export type AdminMatchOption = {
  externalId: string;
  apiMatchId: number;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string;
  kickoffAt: string;
  status: string;
  matchId?: string;
};

type CompetitionGroup = {
  competitionId: number;
  competitionName: string;
  matchCount: number;
};

type AdminMatchPickerProps = {
  selectedExternalIds: string[];
  onChange: (externalIds: string[]) => void;
  onMatchMeta?: (match: AdminMatchOption, selected: boolean) => void;
  label?: string;
};

export function AdminMatchPicker({
  selectedExternalIds,
  onChange,
  onMatchMeta,
  label = "انتخاب مسابقات",
}: AdminMatchPickerProps) {
  const [competitions, setCompetitions] = useState<CompetitionGroup[]>([]);
  const [matchesByCompetition, setMatchesByCompetition] = useState<
    Record<number, AdminMatchOption[]>
  >({});
  const [openCompetitionId, setOpenCompetitionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch("/api/admin/football/competitions")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) {
          throw new Error(data.error ?? "خطا در دریافت لیگ‌ها");
        }
        return data;
      })
      .then((data) => {
        setCompetitions(data.competitions ?? []);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "خطا در دریافت لیگ‌ها"),
      )
      .finally(() => setLoading(false));
  }, []);

  const loadMatches = async (competitionId: number) => {
    if (matchesByCompetition[competitionId]) {
      setOpenCompetitionId((current) => (current === competitionId ? null : competitionId));
      return;
    }
    setLoadingMatches(competitionId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/football/competitions/${competitionId}/matches`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "خطا در دریافت مسابقات");
        return;
      }
      setMatchesByCompetition((prev) => ({ ...prev, [competitionId]: data.matches ?? [] }));
      setOpenCompetitionId(competitionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت مسابقات");
    } finally {
      setLoadingMatches(null);
    }
  };

  const toggleMatch = (match: AdminMatchOption) => {
    const externalId = match.externalId;
    if (selectedExternalIds.includes(externalId)) {
      onChange(selectedExternalIds.filter((id) => id !== externalId));
      onMatchMeta?.(match, false);
    } else {
      onChange([...selectedExternalIds, externalId]);
      onMatchMeta?.(match, true);
    }
  };

  if (loading) return <Skeleton className="h-32" />;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <span className="text-xs text-white/40">{selectedExternalIds.length} مسابقه انتخاب شده</span>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-white/8 p-2">
        {competitions.length === 0 ? (
          <p className="p-3 text-center text-sm text-white/40">مسابقه‌ای در یک ماه آینده یافت نشد</p>
        ) : (
          competitions.map((group) => {
            const open = openCompetitionId === group.competitionId;
            const matches = matchesByCompetition[group.competitionId] ?? [];
            return (
              <div key={group.competitionId} className="overflow-hidden rounded-xl border border-white/8">
                <button
                  type="button"
                  onClick={() => loadMatches(group.competitionId)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right"
                >
                  <span className="text-sm font-semibold">{group.competitionName}</span>
                  <div className="flex items-center gap-2 text-xs text-white/45">
                    <span>{group.matchCount} بازی</span>
                    {loadingMatches === group.competitionId ? (
                      <span>...</span>
                    ) : (
                      <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
                    )}
                  </div>
                </button>
                {open && matches.length > 0 ? (
                  <div className="space-y-1 border-t border-white/8 p-2">
                    {matches.map((match) => {
                      const checked = selectedExternalIds.includes(match.externalId);
                      return (
                        <label
                          key={match.externalId}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm",
                            checked ? "bg-bordin-orange/10" : "hover:bg-white/5",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMatch(match)}
                            className="mt-1"
                          />
                          <span>
                            <span className="font-medium">
                              {match.homeTeamName} - {match.awayTeamName}
                            </span>
                            <span className="mt-0.5 block text-xs text-white/45">
                              {formatTehranDateTime(match.kickoffAt)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function computeAutoEndDateIso(selectedExternalIds: string[], allMatches: AdminMatchOption[]) {
  const kickoffs = allMatches
    .filter((m) => selectedExternalIds.includes(m.externalId))
    .map((m) => m.kickoffAt);
  if (kickoffs.length === 0) return null;
  return kickoffs.reduce((latest, current) =>
    new Date(current).getTime() > new Date(latest).getTime() ? current : latest,
  );
}
