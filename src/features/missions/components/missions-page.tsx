"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import type { MissionCardView, MissionClaimResult } from "@/shared/types/missions";
import { MissionCard } from "@/features/missions/components/mission-card";
import { MissionRewardCelebrationModal } from "@/features/missions/components/mission-reward-celebration-modal";

export function MissionsPage() {
  const { toast } = useToast();
  const [missions, setMissions] = useState<MissionCardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingSlug, setClaimingSlug] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<MissionClaimResult | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/missions", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      toast((data.error as string) ?? "خطا در بارگذاری ماموریت‌ها", "error");
      setLoading(false);
      return;
    }
    setMissions((data.missions as MissionCardView[]) ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClaim = async (missionSlug: string, tierKey: string) => {
    setClaimingSlug(missionSlug);
    try {
      const res = await fetch("/api/missions/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionSlug, tierKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast((data.error as string) ?? "خطا در دریافت پاداش", "error");
        return;
      }
      setCelebration(data.reward as MissionClaimResult);
      await load();
    } finally {
      setClaimingSlug(null);
    }
  };

  return (
    <>
      <PageHeader
        title="ماموریت‌ها"
        subtitle="فعالیت کن، پاداش بگیر و مدال جمع کن"
        startAction={
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت به پروفایل"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        {loading ? (
          <>
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </>
        ) : (
          missions.map((mission) => (
            <MissionCard
              key={mission.slug}
              mission={mission}
              claiming={claimingSlug === mission.slug}
              onClaim={handleClaim}
            />
          ))
        )}
      </div>

      <MissionRewardCelebrationModal
        open={Boolean(celebration)}
        reward={celebration}
        onClose={() => setCelebration(null)}
      />
    </>
  );
}
