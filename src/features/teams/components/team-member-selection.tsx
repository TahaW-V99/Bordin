"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { formatPersianNumber } from "@/shared/lib/dates";
import { TEAM_EXTRA_INVITE_FEE, TEAM_INVITE_SHARE_MESSAGE } from "@/shared/constants/teams";
import {
  buildInviteShareLoginUrl,
} from "@/shared/constants/invite";
import { shareViaSocialPlatform, type SocialSharePlatform } from "@/shared/lib/social-share";
import { CoinCostLabel } from "@/shared/components/teams/coin-cost-label";
import { cn } from "@/shared/lib/cn";
import { Search, UserPlus } from "lucide-react";
import { PublicProfileLink } from "@/shared/components/profile/public-profile-link";

const paidInviteSkipKey = (teamId: string) => `bordin-team-paid-invite-skip-${teamId}`;

type UserRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  showcaseSlug?: string | null;
  totalXp: number;
  globalRank: number | null;
  medalCount: number;
  invitePending?: boolean;
  isTeamMember?: boolean;
};

type InviteInfo = {
  inviteLink: string;
  inviteCode: string;
};

function isLocalOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

function normalizeInviteInfo(info: { inviteLink: string; inviteCode: string }) {
  if (!info.inviteCode || typeof window === "undefined") return info;
  if (isLocalOrigin(window.location.origin)) return info;
  return {
    inviteCode: info.inviteCode,
    inviteLink: buildInviteShareLoginUrl(info.inviteCode),
  };
}

export function TeamMemberSelection({
  teamId,
  freeInviteLimit,
  onInviteSent,
}: {
  teamId: string;
  freeInviteLimit: number;
  returnTo?: string;
  onInviteSent?: () => void;
}) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteStats, setInviteStats] = useState({ sent: 0, freeLimit: freeInviteLimit });
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [paidInviteConfirmOpen, setPaidInviteConfirmOpen] = useState(false);
  const [pendingInviteeId, setPendingInviteeId] = useState<string | null>(null);
  const [skipPaidInviteConfirm, setSkipPaidInviteConfirm] = useState(false);
  const [dontShowPaidInviteAgain, setDontShowPaidInviteAgain] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSkipPaidInviteConfirm(localStorage.getItem(paidInviteSkipKey(teamId)) === "1");
  }, [teamId]);

  const loadInviteInfo = useCallback(async () => {
    const res = await fetch("/api/invite");
    const json = await res.json();
    if (!res.ok || !json.inviteLink || !json.inviteCode) {
      setInviteInfo(null);
      return;
    }
    setInviteInfo(
      normalizeInviteInfo({
        inviteLink: json.inviteLink as string,
        inviteCode: json.inviteCode as string,
      }),
    );
  }, []);

  const loadInviteStats = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}`);
    const json = await res.json();
    if (res.ok && json.team?.inviteStats) {
      setInviteStats({
        sent: json.team.inviteStats.sent as number,
        freeLimit: json.team.inviteStats.freeLimit as number,
      });
    }
  }, [teamId]);

  const load = useCallback(
    async (q?: string) => {
      const params = new URLSearchParams({ teamId });
      if (q?.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/teams/users?${params}`);
      const json = await res.json();
      setUsers(json.users ?? []);
    },
    [teamId],
  );

  useEffect(() => {
    void loadInviteInfo();
    void loadInviteStats();
    void load();
  }, [load, loadInviteInfo, loadInviteStats]);

  useEffect(() => {
    const t = setTimeout(() => void load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const sendInvite = async (inviteeId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      setUsers((prev) =>
        prev.map((u) => (u.id === inviteeId ? { ...u, invitePending: true } : u)),
      );
      await loadInviteStats();
      onInviteSent?.();
      toast("درخواست عضویت ارسال شد", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoading(false);
      setPaidInviteConfirmOpen(false);
      setPendingInviteeId(null);
    }
  };

  const invite = (inviteeId: string) => {
    if (inviteStats.sent >= inviteStats.freeLimit) {
      if (skipPaidInviteConfirm) {
        void sendInvite(inviteeId);
        return;
      }
      setPendingInviteeId(inviteeId);
      setDontShowPaidInviteAgain(false);
      setPaidInviteConfirmOpen(true);
      return;
    }
    void sendInvite(inviteeId);
  };

  const confirmPaidInvite = () => {
    if (dontShowPaidInviteAgain && typeof window !== "undefined") {
      localStorage.setItem(paidInviteSkipKey(teamId), "1");
      setSkipPaidInviteConfirm(true);
    }
    if (pendingInviteeId) void sendInvite(pendingInviteeId);
  };

  const shareTo = async (platform: SocialSharePlatform) => {
    if (!inviteInfo?.inviteLink) {
      toast("برای دعوت دوستان ابتدا نام کاربری خود را در پروفایل تنظیم کنید", "error");
      return;
    }

    const result = await shareViaSocialPlatform(platform, {
      message: TEAM_INVITE_SHARE_MESSAGE,
      url: inviteInfo.inviteLink,
    });

    if (platform === "instagram") {
      toast(
        "متن دعوت کپی شد. اینستاگرام امکان اشتراک مستقیم ندارد — متن را در دایرکت یا استوری پیست کنید.",
        "success",
      );
      return;
    }

    if (result.copied) {
      toast("متن دعوت کپی شد", "success");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/50">
        {formatPersianNumber(inviteStats.sent)} دعوت ارسال شده برای این تیم · تا{" "}
        {formatPersianNumber(inviteStats.freeLimit)} دعوت رایگان · بعد از آن هر دعوت{" "}
        {formatPersianNumber(TEAM_EXTRA_INVITE_FEE)} سکه
      </p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-3 right-3 h-4 w-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی بازیکن..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-bordin-orange"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
          <UserPlus className="h-4 w-4" />
          دعوت دوستان
        </Button>
      </div>

      <div className="scrollbar-bordin max-h-80 space-y-2 overflow-y-auto pe-1 md:pe-2">
        {users.map((u) => {
          const inviteDisabled = u.invitePending || u.isTeamMember;
          return (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 p-3"
            >
              <PublicProfileLink
                slug={u.showcaseSlug}
                ariaLabel={`پروفایل ${u.displayName}`}
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <ProfileAvatar avatarUrl={u.avatarUrl} displayName={u.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{u.displayName}</p>
                  <p className="text-xs text-white/45">
                    رتبه {u.globalRank ? formatPersianNumber(u.globalRank) : "—"} ·{" "}
                    {formatPersianNumber(u.totalXp)} امتیاز · {formatPersianNumber(u.medalCount)} مدال
                  </p>
                </div>
              </PublicProfileLink>
              <Button
                size="sm"
                loading={loading}
                disabled={inviteDisabled}
                onClick={() => invite(u.id)}
                className={cn(
                  "h-8 shrink-0 px-2.5 text-xs",
                  inviteDisabled
                    ? "!bg-white/10 !text-white/40 hover:!bg-white/10"
                    : "!bg-bordin-green !text-black hover:!bg-bordin-green/90",
                )}
              >
                {u.invitePending ? "ارسال شده" : "درخواست عضویت"}
              </Button>
            </div>
          );
        })}
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)}>
        <p className="mb-4 text-center text-sm leading-7 text-white/70">
          متن آماده دعوت از دوستانت رو از طریق یکی از پیام‌رسان‌های زیر ارسال کن
        </p>
        {!inviteInfo?.inviteLink ? (
          <p className="mb-4 text-center text-xs text-bordin-orange">
            برای دریافت لینک اختصاصی دعوت، ابتدا نام کاربری خود را در تنظیمات پروفایل ثبت کنید.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "telegram", label: "تلگرام" },
              { id: "whatsapp", label: "واتساپ" },
              { id: "bale", label: "بله" },
              { id: "instagram", label: "اینستاگرام" },
            ] as const
          ).map((p) => (
            <Button key={p.id} variant="outline" onClick={() => void shareTo(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
      </Modal>

      <Modal open={paidInviteConfirmOpen} onClose={() => setPaidInviteConfirmOpen(false)}>
        <h4 className="mb-4 text-center text-sm font-bold leading-8 text-white">
          تعداد درخواست عضویت رایگان شما به اتمام رسید! از الان به بعد، برای ارسال درخواست به هر نفر
          باید {formatPersianNumber(TEAM_EXTRA_INVITE_FEE)} سکه هزینه کنی
        </h4>
        <label className="mb-6 flex cursor-pointer items-center justify-center gap-2 text-xs text-white/60">
          <input
            type="checkbox"
            checked={dontShowPaidInviteAgain}
            onChange={(e) => setDontShowPaidInviteAgain(e.target.checked)}
            className="h-4 w-4 rounded border-white/20 accent-bordin-orange"
          />
          متوجه شدم و دیگه نشونم نده
        </label>
        <div className="flex flex-col gap-2">
          <Button loading={loading} onClick={confirmPaidInvite}>
            <span className="flex items-center justify-center gap-2">
              تایید
              <CoinCostLabel amount={TEAM_EXTRA_INVITE_FEE} />
            </span>
          </Button>
          <Button variant="ghost" onClick={() => setPaidInviteConfirmOpen(false)}>
            انصراف
          </Button>
        </div>
      </Modal>
    </div>
  );
}
