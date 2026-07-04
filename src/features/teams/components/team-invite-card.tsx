"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  TEAM_JOIN_FEE,
  TEAM_LEAVE_FEE,
  TEAM_MEMBERSHIP_CONFLICT_CODE,
} from "@/shared/constants/teams";
import { CoinCostLabel } from "@/shared/components/teams/coin-cost-label";
import { dispatchNotificationsUpdated } from "@/shared/constants/notifications";

type PendingInvite = {
  id: string;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  ownerName: string;
};

type CurrentTeam = {
  id: string;
  name: string;
  isOwner: boolean;
};

async function dismissInviteNotification(inviteId: string) {
  const res = await fetch("/api/notifications/dismiss-team-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteId }),
  });
  if (res.ok) {
    const data = await res.json();
    if (typeof data.unreadCount === "number") {
      dispatchNotificationsUpdated(data.unreadCount);
    } else {
      dispatchNotificationsUpdated();
    }
  }
}

export function TeamInviteCard({
  invite,
  currentTeam,
  onUpdated,
}: {
  invite: PendingInvite;
  currentTeam?: CurrentTeam | null;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictTeam, setConflictTeam] = useState<CurrentTeam | null>(currentTeam ?? null);

  const hasOtherTeam =
    currentTeam != null && currentTeam.id !== invite.teamId;

  const openAcceptFlow = () => {
    if (hasOtherTeam && currentTeam) {
      setConflictTeam(currentTeam);
      setConflictOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const accept = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/invites/${invite.id}/accept`, { method: "POST" });
      const json = await res.json();
      if (res.status === 409 && json.code === TEAM_MEMBERSHIP_CONFLICT_CODE) {
        setConfirmOpen(false);
        setConflictTeam(json.currentTeam as CurrentTeam);
        setConflictOpen(true);
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "خطا");
      await dismissInviteNotification(invite.id);
      toast("به تیم پیوستید!", "success");
      setConfirmOpen(false);
      onUpdated();
    } catch (e) {
      setConfirmOpen(false);
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoading(false);
    }
  };

  const switchTeam = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/invites/${invite.id}/switch`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      await dismissInviteNotification(invite.id);
      toast("تیم قبلی را ترک کردید و به تیم جدید پیوستید", "success");
      setConflictOpen(false);
      onUpdated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoading(false);
    }
  };

  const reject = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/invites/${invite.id}/reject`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "خطا");
      await dismissInviteNotification(invite.id);
      toast("درخواست رد شد", "success");
      onUpdated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setLoading(false);
    }
  };

  const teamNameForConflict = conflictTeam?.name ?? "تیم فعلی";

  return (
    <>
      <article className="rounded-2xl border border-bordin-orange/40 bg-bordin-orange/10 p-4">
        <Link
          href={`/showcase/team/${invite.teamId}?from=teams`}
          className="flex items-center gap-3 transition hover:opacity-90"
        >
          {invite.teamLogoUrl ? (
            <Image src={invite.teamLogoUrl} alt="" width={48} height={48} className="rounded-xl" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl">
              ⚽
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-bordin-orange underline-offset-2 hover:underline">
              {invite.teamName}
            </h4>
            <p className="mt-1 text-xs text-white/60">دعوت از {invite.ownerName}</p>
          </div>
        </Link>
        <div className="mt-4 flex gap-2">
          <Button size="sm" loading={loading} onClick={openAcceptFlow}>
            پذیرش درخواست
          </Button>
          <Button size="sm" variant="ghost" loading={loading} onClick={reject}>
            رد درخواست
          </Button>
        </div>
      </article>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <p className="mb-6 text-center leading-8 text-white/80">
          آیا مطمئنی می‌خوای به این تیم ملحق بشی؟
        </p>
        <div className="flex flex-col gap-2">
          <Button loading={loading} onClick={accept}>
            <span className="flex items-center justify-center gap-2">
              بله
              <CoinCostLabel amount={TEAM_JOIN_FEE} />
            </span>
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            انصراف
          </Button>
        </div>
      </Modal>

      <Modal open={conflictOpen} onClose={() => setConflictOpen(false)}>
        <p className="mb-6 text-center text-sm leading-8 text-white/80">
          امکان حضور همزمان در دو تیم وجود ندارد! با توجه به اینکه شما در تیم{" "}
          <span className="font-bold text-white">{teamNameForConflict}</span> عضو هستید، امکان اینکه
          در تیم دیگری عضو شوید وجود ندارد. اما می‌توانید با کلیک روی دکمه ترک تیم فعلی، تیم خود را
          ترک کنید و عضو تیم جدید شوید. در صورت ترک تیم، می‌بایست{" "}
          {formatPersianNumber(TEAM_LEAVE_FEE)} سکه هزینه کنید و امکان عضویت مجدد در آن تیم به مدت
          ۱ ماه برای شما وجود ندارد!
        </p>
        <div className="flex flex-col gap-2">
          <Button loading={loading} onClick={switchTeam}>
            <span className="flex items-center justify-center gap-2">
              ترک تیم
              <CoinCostLabel amount={TEAM_LEAVE_FEE} />
            </span>
          </Button>
          <Button variant="ghost" onClick={() => setConflictOpen(false)}>
            انصراف
          </Button>
        </div>
      </Modal>
    </>
  );
}
