"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Podium } from "@/shared/components/leaderboard/podium";
import { LeaderboardRow } from "@/shared/components/leaderboard/leaderboard-row";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { LeaderboardDisplayNameModal } from "@/features/leaderboard/components/leaderboard-display-name-modal";
import type { GlobalLeaderboardEntry } from "@/shared/types/leaderboard";

export function GlobalLeaderboardTab({
  autoHighlight,
  onHighlightDone,
}: {
  autoHighlight?: boolean;
  onHighlightDone?: () => void;
}) {
  const [rows, setRows] = useState<GlobalLeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [needsDisplayName, setNeedsDisplayName] = useState(false);
  const [displayNameModalOpen, setDisplayNameModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highlightUser, setHighlightUser] = useState(false);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/leaderboard/global", { cache: "no-store" });
    const data = await res.json();
    setRows(data.leaderboard ?? []);
    setCurrentUserId(data.currentUserId ?? null);
    setNeedsDisplayName(Boolean(data.needsDisplayName));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scrollToMe = useCallback(() => {
    if (needsDisplayName) {
      setDisplayNameModalOpen(true);
      return;
    }
    if (!currentUserId) return;
    setHighlightUser(true);
    const el = rowRefs.current.get(currentUserId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    window.setTimeout(() => setHighlightUser(false), 4000);
  }, [currentUserId, needsDisplayName]);

  useEffect(() => {
    if (!autoHighlight || loading) return;
    if (needsDisplayName) {
      setDisplayNameModalOpen(true);
      onHighlightDone?.();
      return;
    }
    if (!currentUserId) return;
    scrollToMe();
    onHighlightDone?.();
  }, [autoHighlight, loading, currentUserId, needsDisplayName, scrollToMe, onHighlightDone]);

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

  const top3 = rows.slice(0, 3);

  return (
    <>
      <LeaderboardDisplayNameModal
        open={displayNameModalOpen}
        onClose={() => setDisplayNameModalOpen(false)}
      />

      <div className="sticky top-0 z-10 border-b border-white/8 bg-black/90 px-4 py-3 backdrop-blur-md">
        <Button size="sm" variant="secondary" fullWidth onClick={scrollToMe}>
          جایگاه من
        </Button>
      </div>

      <Podium entries={top3} />

      <div className="max-h-[calc(100vh-22rem)] space-y-2 overflow-y-auto px-4 pb-6 scrollbar-hide">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">هنوز بازیکنی در لیدر برد نیست.</p>
        ) : (
          rows.map((row) => (
            <LeaderboardRow
              key={row.userId}
              ref={(el) => {
                if (el) rowRefs.current.set(row.userId, el);
              }}
              rank={row.rank}
              name={row.displayName}
              avatarUrl={row.avatarUrl}
              showcaseSlug={row.showcaseSlug}
              level={row.level}
              score={row.totalXp}
              highlight={highlightUser && row.userId === currentUserId}
            />
          ))
        )}
      </div>
    </>
  );
}
