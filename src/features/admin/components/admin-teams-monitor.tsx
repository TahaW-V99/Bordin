"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { formatPersianNumber } from "@/shared/lib/dates";

type AdminTeamRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  isSuspended: boolean;
  owner: { username: string | null; displayName: string | null };
  memberCount: number;
  competitionCount: number;
};

export function AdminTeamsMonitor() {
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/teams")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setTeams(data.teams ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-40" />;
  if (error) return <p className="text-sm text-red-400">{error}</p>;

  return (
    <section className="space-y-3 rounded-2xl border border-white/8 p-4">
      <h3 className="font-bold">تیم‌های بُردین</h3>
      <p className="text-xs text-white/45">
        وضعیت تیم‌ها — با تغییرات مالک به‌روز می‌شود. افتخارات در صفحه جزئیات نمایش داده می‌شود.
      </p>
      {teams.length === 0 ? (
        <p className="py-6 text-center text-sm text-white/40">هنوز تیمی ثبت نشده است</p>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <div
              key={team.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/8 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{team.name}</p>
                  {team.isSuspended ? <Badge variant="orange">تعلیق</Badge> : <Badge variant="green">فعال</Badge>}
                </div>
                <p className="mt-1 text-xs text-white/45">
                  مالک: {team.owner.displayName ?? team.owner.username ?? "—"} ·{" "}
                  {formatPersianNumber(team.memberCount)} عضو ·{" "}
                  {formatPersianNumber(team.competitionCount)} رقابت
                </p>
              </div>
              <Link href={`/admin/teams/${team.id}`}>
                <Button size="sm" variant="secondary">
                  مشاهده بیشتر
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
