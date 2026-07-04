"use client";

import Link from "next/link";
import Image from "next/image";
import { formatShamsiDateWithYear } from "@/shared/lib/dates";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";

export type TeamCardData = {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt: string;
  role: string;
  roleFa: string;
  hasAssignedRole?: boolean;
  memberCount: number;
  capacity: number;
  acceptanceStatusFa: string;
  isComplete: boolean;
  pendingMembershipRequestCount?: number;
};

export function TeamCard({ team }: { team: TeamCardData }) {
  const roleClassName = team.hasAssignedRole
    ? "text-sm font-semibold text-bordin-green"
    : "text-sm font-semibold text-bordin-orange";

  return (
    <article
      className={cn(
        "relative rounded-2xl border p-4 transition-colors",
        team.isComplete
          ? "border-bordin-green/50 bg-bordin-green/10"
          : "border-bordin-orange/50 bg-bordin-orange/10",
      )}
    >
      {team.role === "owner" && (team.pendingMembershipRequestCount ?? 0) > 0 ? (
        <span className="absolute left-3 top-3 z-10 animate-pulse rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
          درخواست عضویت جدید
        </span>
      ) : null}
      <div className="flex items-start gap-3">
        {team.logoUrl ? (
          <Image
            src={team.logoUrl}
            alt=""
            width={56}
            height={56}
            className="rounded-xl"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 text-xl">
            ⚽
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-bold">{team.name}</h3>
          <p className="mt-1 text-xs text-white/50">{formatShamsiDateWithYear(team.createdAt)}</p>
          <p className={cn("mt-1", roleClassName)}>{team.roleFa}</p>
          <p className="mt-1 text-xs text-white/60">
            {team.memberCount} / {team.capacity} عضو · {team.acceptanceStatusFa}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <Link href={`/profile/teams/${team.id}`}>
          <Button fullWidth size="sm" variant={team.role === "owner" ? "primary" : "secondary"}>
            {team.role === "owner" ? "مدیریت تیم" : "مشاهده تیم"}
          </Button>
        </Link>
      </div>
    </article>
  );
}
