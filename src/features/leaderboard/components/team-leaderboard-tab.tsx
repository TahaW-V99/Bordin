"use client";

import { useCallback, useEffect, useState } from "react";
import { TeamPodium } from "@/shared/components/leaderboard/team-podium";
import { TeamLeaderboardRow } from "@/shared/components/leaderboard/team-leaderboard-row";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { TeamLeaderboardEntry } from "@/shared/types/leaderboard";

export function TeamLeaderboardTab() {
  const [rows, setRows] = useState<TeamLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/leaderboard/teams", { cache: "no-store" });
    const data = await res.json();
    setRows(data.leaderboard ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2 px-4 pb-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="px-4 pb-8 pt-6 text-center text-sm text-white/45">
        هنوز امتیازی برای تیم‌ها ثبت نشده است.
      </div>
    );
  }

  const top3 = rows.slice(0, 3);

  return (
    <>
      <TeamPodium entries={top3} />

      <div className="max-h-[calc(100vh-22rem)] space-y-2 overflow-y-auto px-4 pb-6 scrollbar-hide">
        {rows.map((row) => (
          <TeamLeaderboardRow
            key={row.teamId}
            rank={row.rank}
            teamId={row.teamId}
            name={row.teamName}
            logoUrl={row.logoUrl}
            score={row.totalPoints}
          />
        ))}
      </div>
    </>
  );
}
