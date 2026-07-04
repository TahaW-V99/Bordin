"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Chip } from "@/shared/components/ui/chip";
import { GlobalLeaderboardTab } from "@/features/leaderboard/components/global-leaderboard-tab";
import { TeamLeaderboardTab } from "@/features/leaderboard/components/team-leaderboard-tab";
import { LeaderboardComingSoonTab } from "@/features/leaderboard/components/leaderboard-coming-soon-tab";
import { parseLeaderboardTab, type LeaderboardTab } from "@/shared/types/leaderboard";

const TABS: Array<{ key: LeaderboardTab; label: string }> = [
  { key: "global", label: "عمومی" },
  { key: "teams", label: "تیم‌ها" },
  { key: "tournament", label: "تورنومنت" },
];

export function LeaderboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = parseLeaderboardTab(searchParams.get("tab"));
  const [tab, setTab] = useState<LeaderboardTab>(initialTab);
  const [autoHighlight, setAutoHighlight] = useState(searchParams.get("highlight") === "1");

  useEffect(() => {
    setTab(parseLeaderboardTab(searchParams.get("tab")));
    setAutoHighlight(searchParams.get("highlight") === "1");
  }, [searchParams]);

  const changeTab = (next: LeaderboardTab) => {
    setTab(next);
    setAutoHighlight(false);
    const params = new URLSearchParams();
    if (next !== "global") params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/leaderboard?${qs}` : "/leaderboard", { scroll: false });
  };

  return (
    <>
      <PageHeader title="لیدر بُرد" />

      <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-2 scrollbar-hide">
        {TABS.map((item) => (
          <Chip key={item.key} active={tab === item.key} onClick={() => changeTab(item.key)}>
            {item.label}
          </Chip>
        ))}
      </div>

      {tab === "global" ? (
        <GlobalLeaderboardTab
          autoHighlight={autoHighlight}
          onHighlightDone={() => setAutoHighlight(false)}
        />
      ) : tab === "teams" ? (
        <TeamLeaderboardTab />
      ) : (
        <LeaderboardComingSoonTab title="لیدر برد تورنومنت" />
      )}
    </>
  );
}
