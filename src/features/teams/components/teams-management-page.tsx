"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { TeamCard, type TeamCardData } from "@/features/teams/components/team-card";
import { TeamInviteCard } from "@/features/teams/components/team-invite-card";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { dispatchNotificationsUpdated } from "@/shared/constants/notifications";

type PendingInvite = {
  id: string;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  ownerName: string;
};

const SEEN_INVITES_KEY = "bordin-seen-team-invite-ids";

function readSeenInviteIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_INVITES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeSeenInviteIds(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SEEN_INVITES_KEY, JSON.stringify(ids));
}

type CurrentTeam = { id: string; name: string; isOwner: boolean };

export function TeamsManagementPage() {
  const searchParams = useSearchParams();
  const [teams, setTeams] = useState<TeamCardData[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitesExpanded, setInvitesExpanded] = useState(false);
  const [seenInviteIds, setSeenInviteIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch("/api/teams/my");
    const json = await res.json();
    setTeams(json.teams ?? []);
    setPendingInvites(json.pendingInvites ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    setSeenInviteIds(readSeenInviteIds());
  }, [load]);

  useEffect(() => {
    const inviteId = searchParams.get("inviteId");
    if (inviteId) {
      setInvitesExpanded(true);
      markInvitesSeen();
    }
    if (!inviteId) return;
    void fetch("/api/notifications/dismiss-team-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      dispatchNotificationsUpdated(
        typeof data.unreadCount === "number" ? data.unreadCount : undefined,
      );
    });
  }, [searchParams]);

  const activeForeignTeam = useMemo<CurrentTeam | null>(() => {
    const team = teams.find((t) => t.role !== "owner");
    if (!team) return null;
    return { id: team.id, name: team.name, isOwner: false };
  }, [teams]);

  const hasNewInvites = useMemo(
    () => pendingInvites.some((inv) => !seenInviteIds.has(inv.id)),
    [pendingInvites, seenInviteIds],
  );

  const markInvitesSeen = () => {
    const allIds = pendingInvites.map((inv) => inv.id);
    const merged = new Set([...seenInviteIds, ...allIds]);
    writeSeenInviteIds([...merged]);
    setSeenInviteIds(merged);
  };

  const toggleInvites = () => {
    setInvitesExpanded((open) => {
      const next = !open;
      if (next) markInvitesSeen();
      return next;
    });
  };

  if (loading) {
    return (
      <>
        <PageHeader title="مدیریت تیم‌های من" />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="مدیریت تیم‌های من" subtitle="تیم‌های خود را بسازید و مدیریت کنید" />
      <div className="space-y-6 px-4 py-4">
        <Link href="/profile/teams/create">
          <Button fullWidth>
            <Plus className="h-4 w-4" />
            ایجاد تیم
          </Button>
        </Link>

        <section className="!mt-10">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <Users className="h-4 w-4 text-bordin-orange" />
            تیم‌های من
          </h3>
          <Link
            href="/profile"
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت به پروفایل"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
          {teams.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
              هنوز تیمی نساخته‌اید. با «ایجاد تیم» اولین تیم خود را بسازید.
            </p>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          )}
        </section>

        {pendingInvites.length > 0 ? (
          <section>
            <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
              {hasNewInvites ? (
                <span className="absolute left-3 top-3 z-10 animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  درخواست جدید
                </span>
              ) : null}
              <button
                type="button"
                onClick={toggleInvites}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
              >
                <span className="text-sm font-semibold text-white/80">
                  درخواست‌های عضویت ({formatPersianNumber(pendingInvites.length)})
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-white/45 transition",
                    invitesExpanded && "rotate-180",
                  )}
                />
              </button>
              {invitesExpanded ? (
                <div className="space-y-3 border-t border-white/8 p-3">
                  {pendingInvites.map((inv) => (
                    <TeamInviteCard
                      key={inv.id}
                      invite={inv}
                      currentTeam={activeForeignTeam?.id !== inv.teamId ? activeForeignTeam : null}
                      onUpdated={load}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
