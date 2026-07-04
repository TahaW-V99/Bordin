import { Suspense } from "react";
import { AdminDashboard } from "@/features/admin/components/admin-dashboard";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function AdminRoute() {
  return (
    <Suspense fallback={<Skeleton className="mx-4 h-40" />}>
      <AdminDashboard />
    </Suspense>
  );
}
