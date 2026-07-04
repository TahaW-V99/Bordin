import { Suspense } from "react";
import { CompetitionsPage } from "@/features/competitions/components/competitions-page";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function CompetitionsRoute() {
  return (
    <Suspense fallback={<Skeleton className="mx-4 h-40" />}>
      <CompetitionsPage />
    </Suspense>
  );
}
