import { Suspense } from "react";
import { PredictionResultsPage } from "@/features/profile/components/prediction-results-page";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function ProfilePredictionsRoute() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-4">
          <Skeleton className="mb-4 h-12" />
          <Skeleton className="h-36" />
        </div>
      }
    >
      <PredictionResultsPage />
    </Suspense>
  );
}
