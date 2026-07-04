"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { AdminTeamsMonitor } from "@/features/admin/components/admin-teams-monitor";
import { formatPersianNumber } from "@/shared/lib/dates";

type CompTab = "teams" | "team-competitions" | "cups" | "tournaments";

type TeamCompetitionRow = {
  id: string;
  titleFa: string;
  teamCapacity: number;
  stage: string;
  isPublished: boolean;
  entryCount: number;
};

type CupRow = {
  id: string;
  titleFa: string;
  isPublished: boolean;
};

export function AdminCompetitionsPanel({
  initialCups,
}: {
  initialCups: CupRow[];
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<CompTab>("team-competitions");
  const [cups, setCups] = useState(initialCups);
  const [teamCompetitions, setTeamCompetitions] = useState<TeamCompetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTeamCompetitions = () => {
    setLoading(true);
    fetch("/api/admin/team-competitions")
      .then((r) => r.json())
      .then((data) => setTeamCompetitions(data.competitions ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTeamCompetitions();
  }, []);

  const toggleCupPublish = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/cups/${id}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: !current }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    toast("به‌روزرسانی شد", "success");
    setCups((prev) => prev.map((c) => (c.id === id ? { ...c, isPublished: !current } : c)));
  };

  const setTcPublish = async (id: string, isPublished: boolean) => {
    const res = await fetch(`/api/admin/team-competitions/${id}/publish`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error, "error");
      return;
    }
    toast(isPublished ? "رقابت منتشر شد" : "انتشار لغو شد", "success");
    setTeamCompetitions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPublished } : c)),
    );
  };

  const deleteTc = async (id: string) => {
    if (!confirm("آیا از حذف این رقابت تیمی اطمینان دارید؟")) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/team-competitions/${id}`, { method: "DELETE" });
    const data = await res.json();
    setDeletingId(null);
    if (!res.ok) {
      toast(data.error ?? "خطا در حذف", "error");
      return;
    }
    toast("رقابت حذف شد", "success");
    setTeamCompetitions((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        <Chip active={tab === "teams"} onClick={() => setTab("teams")}>
          تیم‌ها
        </Chip>
        <Chip active={tab === "team-competitions"} onClick={() => setTab("team-competitions")}>
          رقابت‌های تیمی
        </Chip>
        <Chip active={tab === "cups"} onClick={() => setTab("cups")}>
          جام‌ها
        </Chip>
        <Chip active={tab === "tournaments"} onClick={() => setTab("tournaments")}>
          تورنمنت‌ها
        </Chip>
      </div>

      {tab === "teams" ? <AdminTeamsMonitor /> : null}

      {tab === "team-competitions" ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold">رقابت‌های تیمی</h3>
            <Link href="/admin/team-competitions/create">
              <Button size="sm">ایجاد یک رقابت تیمی</Button>
            </Link>
          </div>
          {loading ? (
            <Skeleton className="h-24" />
          ) : teamCompetitions.length === 0 ? (
            <p className="rounded-xl border border-white/8 p-6 text-center text-sm text-white/40">
              هنوز رقابت تیمی ایجاد نشده است
            </p>
          ) : (
            <div className="space-y-2">
              {teamCompetitions.map((comp) => (
                <div
                  key={comp.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/8 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold">{comp.titleFa}</p>
                    <p className="text-xs text-white/40">
                      ظرفیت {formatPersianNumber(comp.teamCapacity)} تیم ·{" "}
                      {formatPersianNumber(comp.entryCount)} ثبت‌نام · {comp.stage} ·{" "}
                      {comp.isPublished ? "منتشر شده" : "پیش‌نویس"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={comp.isPublished}
                      onClick={() => void setTcPublish(comp.id, true)}
                    >
                      انتشار
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!comp.isPublished}
                      onClick={() => void setTcPublish(comp.id, false)}
                    >
                      عدم انتشار
                    </Button>
                    <Link href={`/admin/team-competitions/${comp.id}/edit`}>
                      <Button size="sm" variant="secondary">
                        ویرایش
                      </Button>
                    </Link>
                    {!comp.isPublished ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={deletingId === comp.id}
                        onClick={() => void deleteTc(comp.id)}
                      >
                        {deletingId === comp.id ? "..." : "حذف"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {tab === "cups" ? (
        <section className="space-y-2">
          <h3 className="font-bold">مدیریت جام‌ها</h3>
          {cups.map((cup) => (
            <div key={cup.id} className="flex items-center justify-between rounded-xl border border-white/8 p-3">
              <div>
                <p className="font-semibold">{cup.titleFa}</p>
                <p className="text-xs text-white/40">{cup.isPublished ? "منتشر شده" : "پیش‌نویس"}</p>
              </div>
              <Button
                size="sm"
                variant={cup.isPublished ? "secondary" : "primary"}
                onClick={() => toggleCupPublish(cup.id, cup.isPublished)}
              >
                {cup.isPublished ? "عدم انتشار" : "انتشار"}
              </Button>
            </div>
          ))}
        </section>
      ) : null}

      {tab === "tournaments" ? (
        <p className="rounded-xl border border-white/8 p-6 text-center text-sm text-white/40">
          مدیریت تورنمنت از پنل ادمین به‌زودی اضافه می‌شود
        </p>
      ) : null}
    </div>
  );
}
