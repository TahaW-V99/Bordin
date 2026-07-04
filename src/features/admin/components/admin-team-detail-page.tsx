"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";

type TeamDetail = {
  id: string;
  name: string;
  logoUrl: string | null;
  isSuspended: boolean;
  owner: { username: string | null; displayName: string | null };
  members: Array<{
    role: string;
    user: { username: string | null; displayName: string | null };
  }>;
  honors: Array<{ titleFa: string; memberName: string | null }>;
  competitions: Array<{ titleFa: string; stage: string }>;
  competitionCount: number;
};

export function AdminTeamDetailPage({ teamId }: { teamId: string }) {
  const { toast } = useToast();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    fetch(`/api/admin/teams/${teamId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.team) setTeam(data.team);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [teamId]);

  const toggleSuspend = async () => {
    if (!team) return;
    setSubmitting(true);
    const res = await fetch(`/api/admin/teams/${teamId}/suspend`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspended: !team.isSuspended }),
    });
    const data = await res.json();
    setSubmitting(false);
    setConfirmOpen(false);
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    toast(team.isSuspended ? "تعلیق تیم لغو شد" : "تیم تعلیق شد", "success");
    setTeam((prev) =>
      prev
        ? {
            ...prev,
            isSuspended: data.team.isSuspended,
          }
        : prev,
    );
  };

  if (loading) {
    return (
      <>
        <PageHeader title="جزئیات تیم" />
        <Skeleton className="mx-4 h-40" />
      </>
    );
  }

  if (!team) {
    return (
      <>
        <PageHeader title="جزئیات تیم" />
        <p className="px-4 text-center text-red-400">تیم یافت نشد</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={team.name} subtitle="مدیریت تیم" />
      <div className="space-y-4 px-4 py-4">
        <div className="flex items-center gap-2">
          {team.isSuspended ? <Badge variant="orange">تعلیق شده</Badge> : <Badge variant="green">فعال</Badge>}
          <span className="text-sm text-white/50">
            {formatPersianNumber(team.competitionCount)} رقابت شرکت کرده
          </span>
        </div>

        <section className="rounded-2xl border border-white/8 p-4">
          <h3 className="mb-2 font-bold">مالک</h3>
          <p>{team.owner.displayName ?? team.owner.username ?? "—"}</p>
        </section>

        <section className="rounded-2xl border border-white/8 p-4">
          <h3 className="mb-2 font-bold">اعضا</h3>
          <div className="space-y-2">
            {team.members.map((member, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>{member.user.displayName ?? member.user.username ?? "—"}</span>
                <span className="text-white/40">{member.role}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 p-4">
          <h3 className="mb-2 font-bold">افتخارات تیم</h3>
          {team.honors.length === 0 ? (
            <p className="text-sm text-white/40">افتخاری ثبت نشده</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {team.honors.map((honor, index) => (
                <li key={index}>
                  {honor.titleFa} — {honor.memberName}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-white/8 p-4">
          <h3 className="mb-2 font-bold">رقابت‌های شرکت کرده</h3>
          {team.competitions.length === 0 ? (
            <p className="text-sm text-white/40">هنوز در رقابتی شرکت نکرده</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {team.competitions.map((comp, index) => (
                <li key={index}>
                  {comp.titleFa} ({comp.stage})
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button
          variant={team.isSuspended ? "primary" : "secondary"}
          onClick={() => setConfirmOpen(true)}
        >
          {team.isSuspended ? "رفع تعلیق تیم" : "تعلیق تیم"}
        </Button>

        <Link href="/admin?tab=competitions">
          <Button variant="secondary" className="w-full">
            بازگشت
          </Button>
        </Link>
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <p className="mb-4 text-center text-sm leading-7">
          {team.isSuspended
            ? "آیا از رفع تعلیق مطمئن هستید؟ در صورت تایید، تیم اجازه فعالیت در رقابت‌ها را خواهد داشت."
            : "آیا از تعلیق تیم مطمئن هستید؟ در صورت تایید، تیم اجازه فعالیت در هیچ رقابتی را نخواهد داشت."}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmOpen(false)}>
            انصراف
          </Button>
          <Button className="flex-1" onClick={() => void toggleSuspend()} disabled={submitting}>
            تایید
          </Button>
        </div>
      </Modal>
    </>
  );
}
