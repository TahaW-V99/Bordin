"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  HelpCircle,
  MessageCircle,
  Pencil,
  Trash2,
  UserPlus,
} from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { ClickTooltip } from "@/shared/components/ui/click-tooltip";
import { useToast } from "@/shared/components/ui/toast";
import { useAssetPayment } from "@/shared/hooks/use-asset-payment";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { HonorsSlider } from "@/shared/components/profile/honors-slider";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { TeamMemberSelection } from "@/features/teams/components/team-member-selection";
import { TeamLogoPickerModal } from "@/features/teams/components/team-logo-picker-modal";
import {
  TEAM_LEAVE_FEE,
  TEAM_MEDAL_SLUGS,
  TEAM_REMOVE_MEMBER_FEE,
  TEAM_RENAME_FEE,
  isPaidTeamLogo,
} from "@/shared/constants/teams";
import { formatPersianNumber, formatShamsiDateWithYear } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import type { HonorItem } from "@/shared/lib/honors";
import { CoinCostLabel } from "@/shared/components/teams/coin-cost-label";
import { PublicProfileLink } from "@/shared/components/profile/public-profile-link";

type MemberRow = {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  showcaseSlug: string | null;
  role: string;
  roleFa: string;
  joined: boolean;
};

type TeamDetail = {
  id: string;
  name: string;
  logoKey: number | null;
  logoUrl: string | null;
  capacity: number;
  createdAt: string;
  isOwner: boolean;
  isComplete: boolean;
  members: MemberRow[];
  pendingInvites: Array<{
    id: string;
    userId?: string;
    displayName: string;
    avatarUrl: string | null;
    joined: boolean;
  }>;
  pendingMembershipRequests: Array<{
    id: string;
    userId: string;
    name: string;
    showcaseSlug: string | null;
    globalRank: number | null;
    totalXp: number;
    createdAt: string;
  }>;
  honors: HonorItem[];
  unlockedLogos: number[];
  inviteStats: { sent: number; freeLimit: number; extraCost: number };
};

type RosterItem = MemberRow & {
  rosterKey: string;
  canRemove: boolean;
  isPending: boolean;
};

const VISIBLE_ROSTER_COUNT = 3;

function memberSortOrder(role: string) {
  if (role === "OWNER") return 0;
  if (role === "CAPTAIN") return 1;
  return 2;
}

function memberRoleLabel(item: RosterItem) {
  if (item.isPending) return "در انتظار پذیرش";
  if (item.role === "MEMBER") return "عضو عادی";
  return item.roleFa;
}

function RosterRow({
  item,
  isOwner,
  onRemove,
  onAssignRole,
  actionLoading,
}: {
  item: RosterItem;
  isOwner: boolean;
  onRemove?: (item: RosterItem) => void;
  onAssignRole?: (memberId: string) => void;
  actionLoading?: boolean;
}) {
  const profileContent = (
    <>
      <ProfileAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-sm">{item.displayName}</p>
        <div className="flex items-center gap-1 text-xs text-white/45">
          <span>{memberRoleLabel(item)}</span>
          {!item.isPending && item.role === "OWNER" ? (
            <ClickTooltip
              dismissMs={6000}
              content="مالک تیم غیر قابل حذف و تغییر است. شما فقط میتوانید تیم خود را در آینده بفروشید!"
            >
              <HelpCircle className="h-3 w-3" />
            </ClickTooltip>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-3">
      {item.showcaseSlug && !item.isPending ? (
        <PublicProfileLink
          slug={item.showcaseSlug}
          ariaLabel={`مشاهده پروفایل ${item.displayName}`}
          className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-90"
        >
          {profileContent}
        </PublicProfileLink>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{profileContent}</div>
      )}
      {isOwner && !item.isPending && item.role !== "OWNER" ? (
        <div className="flex shrink-0 gap-1">
          {item.role === "MEMBER" && onAssignRole ? (
            <Button size="sm" variant="outline" onClick={() => onAssignRole(item.id)}>
              انتخاب نقش
            </Button>
          ) : null}
          {item.canRemove && onRemove ? (
            <button
              type="button"
              onClick={() => onRemove(item)}
              disabled={actionLoading}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-white/50 transition hover:border-red-500/40 hover:text-red-400 disabled:opacity-50"
              aria-label={`حذف ${item.displayName}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function TeamDetailPage({ teamId }: { teamId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { runWithAssetPayment } = useAssetPayment();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [roleModal, setRoleModal] = useState<string | null>(null);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RosterItem | null>(null);
  const [newName, setNewName] = useState("");
  const [membershipRequestsExpanded, setMembershipRequestsExpanded] = useState(true);
  const [membershipActingId, setMembershipActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/teams/${teamId}`);
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      setTeam(null);
    } else {
      setTeam(data.team as TeamDetail);
      setNewName(data.team.name);
    }
    setLoading(false);
  }, [teamId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const roster = useMemo<RosterItem[]>(() => {
    if (!team) return [];
    const joined = [...team.members]
      .sort((a, b) => memberSortOrder(a.role) - memberSortOrder(b.role))
      .map((m) => ({
        ...m,
        rosterKey: `member-${m.id}`,
        canRemove: team.isOwner && m.role !== "OWNER",
        isPending: false,
      }));
    const pending: RosterItem[] = team.pendingInvites.map((inv) => ({
      id: inv.id,
      userId: inv.userId ?? inv.id,
      displayName: inv.displayName,
      avatarUrl: inv.avatarUrl,
      showcaseSlug: null,
      role: "PENDING",
      roleFa: "دعوت‌شده",
      joined: false,
      rosterKey: `invite-${inv.id}`,
      canRemove: false,
      isPending: true,
    }));
    return [...joined, ...pending];
  }, [team]);

  const visibleRoster = roster.slice(0, VISIBLE_ROSTER_COUNT);
  const hiddenRoster = roster.slice(VISIBLE_ROSTER_COUNT);
  const hasHiddenRoster = hiddenRoster.length > 0;
  const canRecruit = team?.isOwner && !team.isComplete;
  const pendingMembershipRequests = team?.pendingMembershipRequests ?? [];

  const respondMembershipRequest = async (requestId: string, accept: boolean) => {
    setMembershipActingId(requestId);
    try {
      const res = await fetch(`/api/teams/${teamId}/membership-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      toast(
        accept ? "عضو جدید به تیم شما اضافه شد" : "درخواست عضویت کاربر با موفقیت رد شد",
        "success",
      );
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setMembershipActingId(null);
    }
  };

  const rename = async () => {
    setActionLoading(true);
    try {
      const res = await runWithAssetPayment((allowFootballCredit) =>
        fetch(`/api/teams/${teamId}/rename`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, allowFootballCredit }),
        }),
      );
      if (!res) { setRenameOpen(false); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      toast("نام تیم تغییر کرد", "success");
      setRenameOpen(false);
      void load();
    } catch (e) {
      setRenameOpen(false);
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const saveLogo = async (logoKey: number) => {
    setActionLoading(true);
    try {
      const needsPurchase =
        isPaidTeamLogo(logoKey) && !team?.unlockedLogos.includes(logoKey);
      if (needsPurchase) {
        const purchaseRes = await runWithAssetPayment((allowFootballCredit) =>
          fetch("/api/teams/logos/purchase", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logoKey, allowFootballCredit }),
          }),
        );
        if (!purchaseRes) { setLogoOpen(false); return; }
        const purchaseJson = await purchaseRes.json();
        if (!purchaseRes.ok) throw new Error(purchaseJson.error ?? "خطا در خرید لوگو");
      }

      const res = await fetch(`/api/teams/${teamId}/logo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      toast("لوگو تغییر کرد", "success");
      setLogoOpen(false);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const removeMember = async () => {
    if (!removeTarget) return;
    setActionLoading(true);
    try {
      const res = await runWithAssetPayment((allowFootballCredit) =>
        fetch(`/api/teams/${teamId}/members/${removeTarget.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowFootballCredit }),
        }),
      );
      if (!res) { setRemoveTarget(null); return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      toast("عضو از تیم حذف شد", "success");
      setRemoveTarget(null);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const assignRole = async (memberId: string, role: "CAPTAIN" | "MEMBER") => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      toast("سمت تعیین شد", "success");
      setRoleModal(null);
      void load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const leave = async () => {
    setActionLoading(true);
    try {
      const res = await runWithAssetPayment((allowFootballCredit) =>
        fetch(`/api/teams/${teamId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ allowFootballCredit }),
        }),
      );
      if (!res) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      toast("تیم را ترک کردید", "success");
      router.push("/profile/teams");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="مدیریت تیم" />
        <div className="space-y-3 px-4 py-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-24" />
        </div>
      </>
    );
  }

  if (!team) {
    return (
      <>
        <PageHeader title="تیم یافت نشد" />
        <div className="px-4 py-4">
          <Link href="/profile/teams">
            <Button variant="ghost" fullWidth>
              بازگشت
            </Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={team.name}
        subtitle={team.isOwner ? "مدیریت تیم" : "مشاهده تیم"}
        startAction={
          <Link
            href="/profile/teams"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
            aria-label="بازگشت به تیم‌های من"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        }
      />

      <div className="space-y-6 px-4 py-4 pb-24">
        {team.isOwner && pendingMembershipRequests.length > 0 ? (
          <div className="animate-pulse rounded-xl border border-bordin-orange/40 bg-bordin-orange/10 px-3 py-2 text-xs text-bordin-orange">
            درخواست عضویت جدید
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            {team.logoUrl ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                <Image src={team.logoUrl} alt="" width={48} height={48} className="rounded-xl" />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                ⚽
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold">{team.name}</h2>
                {team.isOwner ? (
                  <button type="button" onClick={() => setRenameOpen(true)} aria-label="ویرایش نام">
                    <Pencil className="h-4 w-4 text-bordin-orange" />
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-white/45">
                {formatShamsiDateWithYear(team.createdAt)} ·{" "}
                {formatPersianNumber(team.members.length)} / {formatPersianNumber(team.capacity)} عضو
              </p>
              {team.isOwner ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => setLogoOpen(true)}
                >
                  تغییر لوگو
                </Button>
              ) : null}
            </div>
          </div>
          <Link href={`/chat/teams/${team.id}`} className="mt-4 block">
            <Button variant="outline" fullWidth className="gap-2">
              <MessageCircle className="h-4 w-4 text-bordin-orange" />
              چت با اعضا
            </Button>
          </Link>
        </section>

        <section className="space-y-3">
          <h3 className="font-bold">اعضای تیم</h3>
          <div className="space-y-2">
            {visibleRoster.map((item) => (
              <RosterRow
                key={item.rosterKey}
                item={item}
                isOwner={team.isOwner}
                onRemove={setRemoveTarget}
                onAssignRole={setRoleModal}
                actionLoading={actionLoading}
              />
            ))}
          </div>

          {hasHiddenRoster ? (
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setRosterExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
              >
                <span className="text-sm font-semibold text-white/80">
                  سایر اعضا و دعوت‌ها ({formatPersianNumber(hiddenRoster.length)})
                </span>
                <ChevronDown
                  className={cn("h-4 w-4 text-white/45 transition", rosterExpanded && "rotate-180")}
                />
              </button>
              {rosterExpanded ? (
                <div className="space-y-2 border-t border-white/8 p-3">
                  {hiddenRoster.map((item) => (
                    <RosterRow
                      key={item.rosterKey}
                      item={item}
                      isOwner={team.isOwner}
                      onRemove={setRemoveTarget}
                      onAssignRole={setRoleModal}
                      actionLoading={actionLoading}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {canRecruit ? (
          <section className="space-y-3">
            <Button variant="outline" fullWidth onClick={() => setRecruitOpen((v) => !v)}>
              <UserPlus className="h-4 w-4" />
              {recruitOpen ? "بستن عضوگیری" : "عضوگیری جدید"}
            </Button>
            {recruitOpen ? (
              <TeamMemberSelection
                teamId={teamId}
                freeInviteLimit={team.inviteStats.freeLimit}
                onInviteSent={load}
              />
            ) : null}
          </section>
        ) : null}

        {team.isOwner && pendingMembershipRequests.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setMembershipRequestsExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right"
            >
              <span className="text-sm font-semibold text-white/80">
                درخواست‌های عضویت ({formatPersianNumber(pendingMembershipRequests.length)})
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-white/45 transition",
                  membershipRequestsExpanded && "rotate-180",
                )}
              />
            </button>
            {membershipRequestsExpanded ? (
              <div className="space-y-2 border-t border-white/8 p-3">
                {pendingMembershipRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-white/8 bg-white/5 p-3">
                    {request.showcaseSlug ? (
                      <PublicProfileLink
                        slug={request.showcaseSlug}
                        ariaLabel={`مشاهده ویترین ${request.name}`}
                        className="font-semibold transition hover:text-bordin-orange"
                      >
                        {request.name}
                      </PublicProfileLink>
                    ) : (
                      <p className="font-semibold">{request.name}</p>
                    )}
                    <p className="mt-1 text-xs text-white/45">
                      رتبه:{" "}
                      {request.globalRank ? formatPersianNumber(request.globalRank) : "—"} · امتیاز:{" "}
                      {formatPersianNumber(request.totalXp)}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        loading={membershipActingId === request.id}
                        onClick={() => void respondMembershipRequest(request.id, true)}
                      >
                        تایید درخواست
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={membershipActingId === request.id}
                        onClick={() => void respondMembershipRequest(request.id, false)}
                      >
                        رد درخواست
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section>
          <h3 className="mb-3 font-bold">افتخارات تیم</h3>
          <HonorsSlider
            slugFilter={TEAM_MEDAL_SLUGS}
            earnedMedals={team.honors
              .filter((h) => h.earned)
              .map((h) => ({
                earnedAt: h.earnedAt,
                earnedReason: h.earnedReason,
                medal: { slug: h.slug, titleFa: h.titleFa, tier: h.tier, category: h.category },
              }))}
          />
        </section>

        {team.isOwner ? (
          <Button
            variant="outline"
            fullWidth
            onClick={() => toast("تیم شما به سطح مناسبی برای فروش نرسیده است.", "error")}
          >
            فروش تیم
          </Button>
        ) : (
          <Button variant="outline" fullWidth onClick={() => setLeaveOpen(true)}>
            ترک تیم
          </Button>
        )}
      </div>

      <Modal open={renameOpen} onClose={() => setRenameOpen(false)}>
        <h4 className="mb-4 font-bold">ویرایش نام تیم</h4>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3"
          maxLength={10}
        />
        <Button fullWidth loading={actionLoading} onClick={rename}>
          ذخیره · {formatPersianNumber(TEAM_RENAME_FEE)} سکه
        </Button>
      </Modal>

      <TeamLogoPickerModal
        open={logoOpen}
        onClose={() => setLogoOpen(false)}
        unlockedLogos={team.unlockedLogos}
        currentLogoKey={team.logoKey}
        onSave={saveLogo}
        loading={actionLoading}
      />

      <Modal open={roleModal != null} onClose={() => setRoleModal(null)}>
        <h4 className="mb-4 font-bold">انتخاب نقش</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              fullWidth
              variant="outline"
              loading={actionLoading}
              onClick={() => roleModal && assignRole(roleModal, "CAPTAIN")}
            >
              کاپیتان
            </Button>
            <ClickTooltip
              dismissMs={8000}
              placement="below"
              content="کاپیتان تیم فردی است که در مراحل حذفی یک رقابت‌تیمی، پس از مشورت با شما و دیگر اعضای تیم، پیش‌بینی تیمتان را ثبت میکند. در انتخاب این فرد دقت کنید!"
              align="end"
              className="shrink-0"
            >
              <HelpCircle className="h-4 w-4" />
            </ClickTooltip>
          </div>
          <Button
            fullWidth
            variant="outline"
            loading={actionLoading}
            onClick={() => roleModal && assignRole(roleModal, "MEMBER")}
          >
            عضو عادی
          </Button>
        </div>
      </Modal>

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)}>
        <p className="mb-4 text-center leading-8">
          آیا از ترک تیم مطمئن هستید؟ در صورت ترک تیم می‌بایست{" "}
          {formatPersianNumber(TEAM_LEAVE_FEE)} سکه هزینه کنید. همچنین تا ۱ ماه امکان حضور در این
          تیم را نخواهید داشت!
        </p>
        <div className="flex flex-col gap-2">
          <Button loading={actionLoading} onClick={leave}>
            <CoinCostLabel amount={TEAM_LEAVE_FEE} />
          </Button>
          <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
            انصراف
          </Button>
        </div>
      </Modal>

      <Modal open={removeTarget != null} onClose={() => setRemoveTarget(null)}>
        <p className="mb-6 text-center text-sm leading-8 text-white/80">
          آیا از حذف عضو مطمئن هستید؟ در صورت تایید، {formatPersianNumber(TEAM_REMOVE_MEMBER_FEE)}{" "}
          سکه هزینه حذف عضو را باید پرداخت کنید همچنین امکان ارسال درخواست عضویت برای فرد تا ۱ ماه
          آینده وجود ندارد!
        </p>
        <div className="flex flex-col gap-2">
          <Button loading={actionLoading} onClick={removeMember}>
            <span className="flex items-center justify-center gap-2">
              تایید
              <CoinCostLabel amount={TEAM_REMOVE_MEMBER_FEE} />
            </span>
          </Button>
          <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
            انصراف
          </Button>
        </div>
      </Modal>
    </>
  );
}
