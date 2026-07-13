import { Suspense } from "react";
import { HomeDashboard } from "@/features/home/components/home-dashboard";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function HomePage() {
  return (
    <Suspense fallback={<Skeleton className="mx-4 h-40" />}>
      <HomeDashboard />
    </Suspense>
  );
}
