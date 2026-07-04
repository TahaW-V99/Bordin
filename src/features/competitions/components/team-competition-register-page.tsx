"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plus, Users } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";
import { resolveTeamLogoUrl } from "@/shared/constants/teams";
import { MEMBERSHIP_REQUEST_EXTRA_FEE } from "@/shared/constants/team-competition-user";
import { CoinCostLabel } from "@/shared/components/teams/coin-cost-label";
import {
  TEAM_LEAVE_FEE,
  TEAM_MEMBERSHIP_CONFLICT_CODE,
} from "@/shared/constants/teams";

const MEMBERSHIP_REQUEST_SKIP_KEY = "bordin-membership-request-confirm-skip";

type TeamRow = {
  id: string;
  name: string;
  logoUrl: string | null;
  logoKey?: number | null;
  memberCount: number;
  maxTeamSize?: number;
  hasOpenSlots?: boolean;
  isRegistered?: boolean;
  isSuspended?: boolean;
  canRegister?: boolean;
  registrationBlockReason?: string | null;
  ownerName?: string;
  role?: string;
};

type MyTeamRow = TeamRow & {
  listRole: "owner" | "member";
};

type Preview = {
  feePerMember: number;
  shortfallMembers: Array<{ userId: string; name: string; balance: number }>;
  needsOwnerCover: boolean;
};

function roleBadgeProps(team: MyTeamRow): { label: string; variant: "orange" | "purple" | "blue" } {
  if (team.listRole === "owner") return { label: "مالک", variant: "orange" };
  if (team.role === "CAPTAIN") return { label: "کاپیتان", variant: "purple" };
  return { label: "عضو", variant: "blue" };
}

function TeamAvatar({
  logoUrl,
  logoKey,
  name,
}: {
  logoUrl: string | null;
  logoKey?: number | null;
  name: string;
}) {
  const src = resolveTeamLogoUrl({ logoKey, logoUrl });
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-lg object-cover"
        unoptimized
      />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/8 text-sm"
      aria-hidden
    >
      {name.charAt(0) || "⚽"}
    </div>
  );
}

export function TeamCompetitionRegisterPage({ competitionId }: { competitionId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [comp, setComp] = useState<Record<string, unknown> | null>(null);
  const [ownedTeams, setOwnedTeams] = useState<TeamRow[]>([]);
  const [memberTeams, setMemberTeams] = useState<TeamRow[]>([]);
  const [browseTeams, setBrowseTeams] = useState<TeamRow[]>([]);
  const [browseFilter, setBrowseFilter] = useState<"all" | "open">("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [confirmTeamId, setConfirmTeamId] = useState<string | null>(null);
  const [coverModal, setCoverModal] = useState<{ teamId: string; preview: Preview } | null>(null);
  const [notifyModal, setNotifyModal] = useState<string | null>(null);
  const [membershipModalTeam, setMembershipModalTeam] = useState<TeamRow | null>(null);
  const [membershipRequiresFee, setMembershipRequiresFee] = useState(false);
  const [skipMembershipConfirm, setSkipMembershipConfirm] = useState(false);
  const [dontShowMembershipAgain, setDontShowMembershipAgain] = useState(false);
  const [membershipSubmitting, setMembershipSubmitting] = useState(false);
  const [membershipConflictOpen, setMembershipConflictOpen] = useState(false);
  const [membershipConflictTeam, setMembershipConflictTeam] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingMembershipTeam, setPendingMembershipTeam] = useState<TeamRow | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSkipMembershipConfirm(localStorage.getItem(MEMBERSHIP_REQUEST_SKIP_KEY) === "1");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [compRes, teamsRes, browseRes] = await Promise.all([
      fetch(`/api/team-competitions/${competitionId}`),
      fetch("/api/teams/me"),
      fetch(`/api/teams/browse?competitionId=${competitionId}&filter=${browseFilter}`),
    ]);
    const compData = await compRes.json();
    const teamsData = await teamsRes.json();
    const browseData = await browseRes.json();
    setComp(compData.competition ?? null);
    setOwnedTeams(compData.competition?.ownedTeams ?? teamsData.owned ?? []);
    setMemberTeams(compData.competition?.memberTeams ?? teamsData.member ?? []);
    setBrowseTeams(browseData.teams ?? []);
    setLoading(false);
  }, [competitionId, browseFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const myTeams = useMemo<MyTeamRow[]>(
    () => [
      ...ownedTeams.map((team) => ({ ...team, listRole: "owner" as const })),
      ...memberTeams.map((team) => ({ ...team, listRole: "member" as const })),
    ],
    [ownedTeams, memberTeams],
  );

  const myTeamIds = useMemo(() => new Set(myTeams.map((team) => team.id)), [myTeams]);

  const otherTeams = useMemo(
    () => browseTeams.filter((team) => !myTeamIds.has(team.id)),
    [browseTeams, myTeamIds],
  );

  const selectedTeam = useMemo(
    () => myTeams.find((team) => team.id === selectedTeamId) ?? null,
    [myTeams, selectedTeamId],
  );

  const canRegisterSelected =
    selectedTeam?.listRole === "owner" &&
    selectedTeam.canRegister !== false &&
    !selectedTeam.isRegistered &&
    !selectedTeam.isSuspended &&
    !submitting;

  const showStickyRegister = Boolean(selectedTeam && canRegisterSelected);

  const registerTeam = async (
    teamId: string,
    options?: { ownerCoversShortfall?: boolean; notifyMembers?: boolean },
  ) => {
    setSubmitting(true);
    const res = await fetch(`/api/team-competitions/${competitionId}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, ...options }),
    });
    const data = await res.json();
    setSubmitting(false);
    setConfirmTeamId(null);
    setCoverModal(null);
    setNotifyModal(null);

    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }

    if (data.needsOwnerCover) {
      setCoverModal({ teamId, preview: data });
      return;
    }

    if (data.notified) {
      toast("به اعضا اطلاع داده شد", "success");
      return;
    }

    if (data.registered) {
      toast("تیم با موفقیت ثبت‌نام شد", "success");
      router.push(data.rankingLink ?? `/competitions/teams/${competitionId}?tab=ranking`);
    }
  };

  const previewAndRegister = async (teamId: string) => {
    setSubmitting(true);
    const res = await fetch(`/api/team-competitions/${competitionId}/register/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    if (data.preview.needsOwnerCover) {
      setCoverModal({ teamId, preview: data.preview });
      return;
    }
    await registerTeam(teamId);
  };

  const submitMembershipRequest = async (team: TeamRow) => {
    setMembershipSubmitting(true);
    const res = await fetch(`/api/teams/${team.id}/membership-requests`, { method: "POST" });
    const data = await res.json();
    setMembershipSubmitting(false);

    if (res.status === 409 && data.code === TEAM_MEMBERSHIP_CONFLICT_CODE) {
      setMembershipModalTeam(null);
      setPendingMembershipTeam(team);
      setMembershipConflictTeam(data.currentTeam);
      setMembershipConflictOpen(true);
      return;
    }

    setMembershipModalTeam(null);
    setPendingMembershipTeam(null);

    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }

    toast(
      `درخواست عضویت شما در تیم (${data.teamName ?? team.name}) با موفقیت برای مالک آن تیم ارسال شد`,
      "success",
    );
    void load();
  };

  const leaveAndRequestMembership = async () => {
    if (!membershipConflictTeam || !pendingMembershipTeam) return;
    setMembershipSubmitting(true);
    try {
      const leaveRes = await fetch(`/api/teams/${membershipConflictTeam.id}/leave`, {
        method: "POST",
      });
      const leaveData = await leaveRes.json();
      if (!leaveRes.ok) throw new Error(leaveData.error ?? "خطا در ترک تیم");

      setMembershipConflictOpen(false);
      setMembershipConflictTeam(null);
      await submitMembershipRequest(pendingMembershipTeam);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setMembershipSubmitting(false);
    }
  };

  const openMembershipRequestModal = async (team: TeamRow) => {
    if (skipMembershipConfirm) {
      await submitMembershipRequest(team);
      return;
    }

    const res = await fetch("/api/teams/membership-request-preview");
    const data = await res.json();
    setMembershipRequiresFee(Boolean(data.preview?.requiresFee));
    setDontShowMembershipAgain(false);
    setMembershipModalTeam(team);
  };

  const confirmMembershipRequest = async () => {
    if (!membershipModalTeam) return;
    if (dontShowMembershipAgain && typeof window !== "undefined") {
      localStorage.setItem(MEMBERSHIP_REQUEST_SKIP_KEY, "1");
      setSkipMembershipConfirm(true);
    }
    setPendingMembershipTeam(membershipModalTeam);
    await submitMembershipRequest(membershipModalTeam);
  };

  const notifyOwner = async (teamId: string) => {
    const res = await fetch(`/api/team-competitions/${competitionId}/notify-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    toast("تمایل شما برای حضور تیم در رقابت، برای مالک ارسال شد.", "success");
    setNotifyModal(null);
  };

  const openRegisterConfirm = () => {
    if (!selectedTeam || !canRegisterSelected) return;
    setConfirmTeamId(selectedTeam.id);
  };

  if (loading || !comp) {
    return (
      <>
        <PageHeader title="ثبت‌نام در رقابت" />
        <Skeleton className="mx-4 h-40" />
      </>
    );
  }

  const fee = comp.registrationFeePerMember as number;
  const selectedRole = selectedTeam ? roleBadgeProps(selectedTeam) : null;

  return (
    <>
      <PageHeader title="ثبت‌نام در رقابت" subtitle={comp.titleFa as string} />

      <div className={cn("space-y-5 px-4 py-4", showStickyRegister && "pb-28")}>
        {/* Section 1 — Selected Team */}
        <section className="rounded-2xl border border-[#f5b942]/30 bg-gradient-to-b from-[#f5b942]/8 to-transparent p-4">
          <h2 className="mb-3 text-sm font-bold text-[#ffd54a]">تیم انتخاب‌شده</h2>
          {selectedTeam ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <TeamAvatar
                  logoUrl={selectedTeam.logoUrl}
                  logoKey={selectedTeam.logoKey}
                  name={selectedTeam.name}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-bold">{selectedTeam.name}</p>
                    {selectedRole ? (
                      <Badge variant={selectedRole.variant} className="text-[10px] px-2 py-0">
                        {selectedRole.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-white/50">
                    <Users className="h-3.5 w-3.5" />
                    {formatPersianNumber(selectedTeam.memberCount)} عضو
                    {selectedTeam.listRole === "member" && selectedTeam.ownerName
                      ? ` · مالک: ${selectedTeam.ownerName}`
                      : null}
                  </p>
                </div>
              </div>

              {selectedTeam.isRegistered ? (
                <p className="text-xs text-bordin-green">این تیم در این رقابت ثبت‌نام شده است.</p>
              ) : selectedTeam.registrationBlockReason ? (
                <p className="text-xs text-red-400">{selectedTeam.registrationBlockReason}</p>
              ) : selectedTeam.listRole === "owner" ? (
                <p className="text-xs text-white/45">
                  هزینه هر عضو: {formatPersianNumber(fee)} سکه
                </p>
              ) : (
                <p className="text-xs text-white/45">
                  ثبت‌نام تیم فقط توسط مالک انجام می‌شود.
                </p>
              )}

              {canRegisterSelected ? (
                <Button fullWidth loading={submitting} onClick={openRegisterConfirm}>
                  ثبت نام
                </Button>
              ) : selectedTeam.listRole === "member" && !selectedTeam.isRegistered ? (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => setNotifyModal(selectedTeam.id)}
                >
                  به مالک تیم اطلاع بده
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center">
              <p className="text-sm text-white/55">هنوز تیمی انتخاب نکرده‌اید.</p>
              <p className="mt-1 text-xs text-white/40">
                از بخش «تیم‌های من» یک تیم را انتخاب کنید.
              </p>
            </div>
          )}
        </section>

        {/* Section 2 — My Teams */}
        {myTeams.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-white/85">تیم‌های من</h2>
            <div className="space-y-2">
              {myTeams.map((team) => {
                const role = roleBadgeProps(team);
                const isSelected = selectedTeamId === team.id;
                const canSelectOwned =
                  team.listRole === "owner" && !team.isSuspended && !submitting;

                return (
                  <div
                    key={team.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition",
                      isSelected
                        ? "border-bordin-green/40 bg-bordin-green/5"
                        : "border-white/8 bg-white/[0.02]",
                    )}
                  >
                    <TeamAvatar
                      logoUrl={team.logoUrl}
                      logoKey={team.logoKey}
                      name={team.name}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold">{team.name}</p>
                        <Badge variant={role.variant} className="text-[10px] px-2 py-0">
                          {role.label}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-white/45">
                        {formatPersianNumber(team.memberCount)} عضو
                        {team.listRole === "member" && team.ownerName
                          ? ` · ${team.ownerName}`
                          : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {team.listRole === "owner" ? (
                        <Link href={`/profile/teams/${team.id}`}>
                          <Button size="sm" variant="outline">
                            ویرایش
                          </Button>
                        </Link>
                      ) : null}
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-bordin-green/30 bg-bordin-green/10 px-2.5 py-1.5 text-xs font-medium text-bordin-green">
                          <Check className="h-3.5 w-3.5" />
                          انتخاب شد
                        </span>
                      ) : team.listRole === "owner" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!canSelectOwned && team.listRole === "owner"}
                          onClick={() => setSelectedTeamId(team.id)}
                        >
                          {team.isRegistered ? "ثبت‌نام شده" : "انتخاب"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedTeamId(team.id)}
                        >
                          انتخاب
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Section 3 — Create a Team */}
        <section className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-4">
          <p className="text-sm font-medium text-white/70">تیم مناسبی ندارید؟</p>
          <p className="mt-1 text-xs text-white/45">
            برای شرکت در رقابت، یک تیم جدید بسازید.
          </p>
          <Link href="/profile/teams" className="mt-3 block">
            <Button variant="outline" fullWidth>
              <Plus className="h-4 w-4" />
              ایجاد تیم
            </Button>
          </Link>
        </section>

        {/* Section 4 — Other Bordin Teams */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-white/85">سایر تیم‌های بُردین</h2>
            <div className="flex gap-1">
              <Chip active={browseFilter === "all"} onClick={() => setBrowseFilter("all")}>
                همه
              </Chip>
              <Chip active={browseFilter === "open"} onClick={() => setBrowseFilter("open")}>
                ظرفیت خالی
              </Chip>
            </div>
          </div>
          {otherTeams.length === 0 ? (
            <p className="rounded-xl border border-white/8 px-3 py-4 text-center text-xs text-white/40">
              تیم دیگری برای نمایش نیست.
            </p>
          ) : (
            <div className="space-y-1.5">
              {otherTeams.map((team) => (
                <div
                  key={team.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/8 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamAvatar
                      logoUrl={team.logoUrl}
                      logoKey={team.logoKey}
                      name={team.name}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/showcase/team/${team.id}`}
                        className="truncate text-sm font-semibold hover:text-bordin-orange"
                      >
                        {team.name}
                      </Link>
                      <p className="text-[11px] text-white/45">
                        {formatPersianNumber(team.memberCount)} /{" "}
                        {formatPersianNumber(team.maxTeamSize ?? 5)} عضو
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!team.hasOpenSlots}
                    onClick={() => openMembershipRequestModal(team)}
                  >
                    {team.hasOpenSlots ? "درخواست عضویت" : "ظرفیت تکمیل"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Sticky Register */}
      {showStickyRegister && selectedTeam ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0a0a0a]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <Button fullWidth loading={submitting} onClick={openRegisterConfirm}>
            ثبت‌نام تیم · {selectedTeam.name}
          </Button>
        </div>
      ) : null}

      <Modal open={Boolean(confirmTeamId)} onClose={() => setConfirmTeamId(null)}>
        <p className="mb-4 text-sm leading-7">
          آیا مطمئن هستید؟ با تایید وارد رقابت تیمی می‌شوید و هزینه ثبت‌نام از تمام اعضای تیم کسر می‌شود.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmTeamId(null)}>
            انصراف
          </Button>
          <Button
            className="flex-1"
            loading={submitting}
            onClick={() => confirmTeamId && previewAndRegister(confirmTeamId)}
          >
            تایید
          </Button>
        </div>
      </Modal>

      <Modal open={Boolean(coverModal)} onClose={() => setCoverModal(null)}>
        {coverModal ? (
          <>
            <p className="mb-4 text-sm leading-7">
              {coverModal.preview.shortfallMembers.map((m) => m.name).join("، ")} فاقد سکه کافی جهت پرداخت
              هزینه حضور در رقابت هستند. آیا این سکه‌ها از حساب شما کسر شود؟ در صورت تایید، مبلغ از
              حساب شما کسر می‌شود؛ در غیر این صورت می‌توانید به اعضا اطلاع دهید تا سکه تهیه کنند.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                loading={submitting}
                onClick={() =>
                  registerTeam(coverModal.teamId, { ownerCoversShortfall: true })
                }
              >
                تایید
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  registerTeam(coverModal.teamId, { notifyMembers: true })
                }
              >
                اطلاع‌رسانی به اعضا
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={Boolean(membershipModalTeam)} onClose={() => setMembershipModalTeam(null)}>
        {membershipModalTeam ? (
          <>
            <p className="mb-4 text-sm leading-8 text-white/80">
              شما در حال ثبت درخواست برای عضویت در تیم ({membershipModalTeam.name}) هستید. درخواست
              شما برای مالک تیم ارسال می‌شود و در صورت تایید او، عضو تیم خواهید شد. روی دکمه تایید
              کلیک کنید تا درخواست شما برای مالک تیم ارسال شود.
            </p>
            <p className="mb-4 text-xs leading-7 text-white/50">
              توجه: در طول یک هفته می‌توانید فقط برای ۱۰ تیم درخواست عضویت ارسال کنید. در صورت
              رسیدن به این حد، باید {formatPersianNumber(MEMBERSHIP_REQUEST_EXTRA_FEE)} سکه به ازای
              هر درخواست عضویت جدید هزینه پرداخت کنید.
            </p>
            <label className="mb-6 flex cursor-pointer items-center gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                checked={dontShowMembershipAgain}
                onChange={(e) => setDontShowMembershipAgain(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 accent-bordin-orange"
              />
              دیگه نمایش نده
            </label>
            <div className="flex flex-col gap-2">
              <Button loading={membershipSubmitting} onClick={() => void confirmMembershipRequest()}>
                {membershipRequiresFee ? (
                  <span className="flex items-center justify-center gap-2">
                    تایید
                    <CoinCostLabel amount={MEMBERSHIP_REQUEST_EXTRA_FEE} />
                  </span>
                ) : (
                  "تایید"
                )}
              </Button>
              <Button variant="secondary" onClick={() => setMembershipModalTeam(null)}>
                انصراف
              </Button>
            </div>
          </>
        ) : null}
      </Modal>

      <Modal open={Boolean(notifyModal)} onClose={() => setNotifyModal(null)}>
        <p className="mb-4 text-sm leading-7">
          شرکت دادن یک تیم در رقابت توسط مالک تیم باید انجام بشه. با تایید، تمایل شما به مالک اطلاع‌رسانی می‌شود.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setNotifyModal(null)}>
            انصراف
          </Button>
          <Button className="flex-1" onClick={() => notifyModal && notifyOwner(notifyModal)}>
            تایید
          </Button>
        </div>
      </Modal>

      <Modal open={membershipConflictOpen} onClose={() => setMembershipConflictOpen(false)}>
        <p className="mb-6 text-center text-sm leading-8 text-white/80">
          امکان حضور همزمان در دو تیم وجود ندارد! با توجه به اینکه شما در تیم{" "}
          <span className="font-bold text-white">{membershipConflictTeam?.name ?? "فعلی"}</span> عضو
          هستید، امکان اینکه در تیم دیگری عضو شوید وجود ندارد. اما می‌توانید با کلیک روی دکمه ترک
          تیم فعلی، تیم خود را ترک کنید و درخواست عضویت در تیم جدید ارسال شود. در صورت ترک تیم،
          می‌بایست {formatPersianNumber(TEAM_LEAVE_FEE)} سکه هزینه کنید و امکان عضویت مجدد در آن
          تیم به مدت ۱ ماه برای شما وجود ندارد!
        </p>
        <div className="flex flex-col gap-2">
          <Button loading={membershipSubmitting} onClick={() => void leaveAndRequestMembership()}>
            <span className="flex items-center justify-center gap-2">
              ترک تیم
              <CoinCostLabel amount={TEAM_LEAVE_FEE} />
            </span>
          </Button>
          <Button variant="ghost" onClick={() => setMembershipConflictOpen(false)}>
            انصراف
          </Button>
        </div>
      </Modal>
    </>
  );
}
