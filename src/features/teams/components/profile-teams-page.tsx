"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import { Users } from "lucide-react";

type TeamRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  memberCount: number;
  isSuspended?: boolean;
  competitionCount?: number;
};

export function ProfileTeamsPage() {
  const { toast } = useToast();
  const [owned, setOwned] = useState<TeamRow[]>([]);
  const [member, setMember] = useState<TeamRow[]>([]);
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/teams/me");
    const data = await res.json();
    setOwned(data.owned ?? []);
    setMember(data.member ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createTeam = async () => {
    if (!teamName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: teamName.trim() }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    toast("تیم ایجاد شد", "success");
    setTeamName("");
    void load();
  };

  if (loading) {
    return (
      <>
        <PageHeader title="تیم‌های من" />
        <Skeleton className="mx-4 h-40" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="تیم‌های من" subtitle="ایجاد و مدیریت تیم" />
      <div className="space-y-6 px-4 py-4">
        <section className="space-y-3 rounded-2xl border border-white/8 p-4">
          <h3 className="font-bold">ایجاد تیم جدید</h3>
          <Input
            label="نام تیم"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="نام تیم"
          />
          <Button fullWidth loading={creating} onClick={createTeam}>
            ایجاد تیم
          </Button>
        </section>

        {owned.length > 0 ? (
          <section className="space-y-3">
            <h3 className="font-bold">تیم‌های تحت مالکیت</h3>
            {owned.map((team) => (
              <Link
                key={team.id}
                href={`/profile/teams/${team.id}`}
                className="flex items-center justify-between rounded-xl border border-white/8 p-4 transition hover:border-bordin-orange/30"
              >
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-xs text-white/45">
                    {formatPersianNumber(team.memberCount)} عضو
                    {team.competitionCount
                      ? ` · ${formatPersianNumber(team.competitionCount)} رقابت`
                      : ""}
                  </p>
                  {team.isSuspended ? (
                    <p className="mt-1 text-xs text-red-400">تعلیق شده</p>
                  ) : null}
                </div>
                <span className="text-xs text-bordin-orange">مدیریت تیم</span>
              </Link>
            ))}
          </section>
        ) : null}

        {member.length > 0 ? (
          <section className="space-y-3">
            <h3 className="font-bold">عضویت در تیم‌ها</h3>
            {member.map((team) => (
              <Link
                key={team.id}
                href={`/profile/teams/${team.id}`}
                className="flex items-center gap-3 rounded-xl border border-white/8 p-4"
              >
                <Users className="h-5 w-5 text-white/40" />
                <div>
                  <p className="font-semibold">{team.name}</p>
                  <p className="text-xs text-white/45">
                    {formatPersianNumber(team.memberCount)} عضو
                  </p>
                </div>
              </Link>
            ))}
          </section>
        ) : null}

        {owned.length === 0 && member.length === 0 ? (
          <p className="text-center text-sm text-white/45">هنوز تیمی ندارید. یک تیم بسازید.</p>
        ) : null}
      </div>
    </>
  );
}
