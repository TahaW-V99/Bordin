import { Suspense } from "react";
import { LeaderboardPage } from "@/features/leaderboard/components/leaderboard-page";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function LeaderboardRoute() {
  return (
    <Suspense fallback={<div className="px-4 py-8"><Skeleton className="h-40" /></div>}>
      <LeaderboardPage />
    </Suspense>
  );
}
