"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";

type MemberRow = { role: string; name: string; globalRank: number | null; totalXp: number };
type RequestRow = {
  id: string;
  userId: string;
  name: string;
  globalRank: number | null;
  totalXp: number;
};

export function ProfileTeamDetailPage({ teamId }: { teamId: string }) {
  const { toast } = useToast();
  const [team, setTeam] = useState<Record<string, unknown> | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [showRequests, setShowRequests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}`);
    const data = await res.json();
    setTeam(data.team ?? null);
    setRequests(data.pendingRequests ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (requestId: string, accept: boolean) => {
    setActingId(requestId);
    const res = await fetch(`/api/teams/${teamId}/membership-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept }),
    });
    const data = await res.json();
    setActingId(null);
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    toast(accept ? "عضو جدید به تیم شما اضافه شد" : "درخواست عضویت کاربر با موفقیت رد شد", "success");
    void load();
  };

  if (loading || !team) {
    return (
      <>
        <PageHeader title="مدیریت تیم" />
        <Skeleton className="mx-4 h-40" />
      </>
    );
  }

  const members = (team.members ?? []) as MemberRow[];
  const isOwner = team.isOwner as boolean;
  const hasPending = requests.length > 0;

  return (
    <>
      <PageHeader title={team.name as string} subtitle="مدیریت تیم" />
      <div className="space-y-4 px-4 py-4">
        {isOwner && hasPending ? (
          <div className="animate-pulse rounded-xl border border-bordin-orange/40 bg-bordin-orange/10 px-3 py-2 text-xs text-bordin-orange">
            درخواست عضویت جدید
          </div>
        ) : null}

        <section className="rounded-xl border border-white/8 p-4">
          <p className="text-sm text-white/45">
            {formatPersianNumber(team.memberCount as number)} / {formatPersianNumber(team.maxTeamSize as number)} عضو
          </p>
          <div className="mt-3 space-y-2">
            {members.map((m, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{m.name}</span>
                <span className="text-white/45">{m.role}</span>
              </div>
            ))}
          </div>
        </section>

        {isOwner ? (
          <>
            <Button variant="secondary" fullWidth onClick={() => setShowRequests((v) => !v)}>
              درخواست‌های عضویت ({formatPersianNumber(requests.length)})
            </Button>
            {showRequests ? (
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <p className="text-sm text-white/45">درخواستی نیست.</p>
                ) : (
                  requests.map((r) => (
                    <div key={r.id} className="rounded-xl border border-white/8 p-3">
                      <p className="font-semibold">{r.name}</p>
                      <p className="text-xs text-white/45">
                        رتبه: {r.globalRank ? formatPersianNumber(r.globalRank) : "—"} · امتیاز:{" "}
                        {formatPersianNumber(r.totalXp)}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          loading={actingId === r.id}
                          onClick={() => respond(r.id, true)}
                        >
                          قبول
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={actingId === r.id}
                          onClick={() => respond(r.id, false)}
                        >
                          رد
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </>
        ) : null}

        <Link href="/profile/teams">
          <Button variant="ghost" fullWidth>
            بازگشت
          </Button>
        </Link>
      </div>
    </>
  );
}
