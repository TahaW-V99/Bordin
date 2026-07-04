"use client";

import { Construction } from "lucide-react";
import { EmptyState } from "@/shared/components/ui/empty-state";

export function LeaderboardComingSoonTab({ title }: { title: string }) {
  return (
    <div className="px-4 pb-8 pt-6">
      <EmptyState
        icon={Construction}
        title={title}
        description="در حال توسعه"
      />
    </div>
  );
}
