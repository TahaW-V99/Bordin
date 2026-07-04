"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPersianNumber } from "@/shared/lib/dates";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/cn";

type LeaderboardRow = {
  rank: number;
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  rankingScore: number | null;
  isMine: boolean;
};

export function TeamCompetitionLeaderboard({
  rows,
  myTeamId,
  stage,
  competitionId,
}: {
  rows: LeaderboardRow[];
  myTeamId: string | null;
  stage: string;
  competitionId: string;
}) {
  const mineRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (myTeamId && mineRef.current) {
      mineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [myTeamId, rows.length]);

  const showcaseHref = (teamId: string) =>
    `/showcase/team/${teamId}?from=competition&competitionId=${competitionId}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">لیدربورد تیم‌ها</h3>
        {myTeamId ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => mineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
          >
            جایگاه من
          </Button>
        ) : null}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="border-b border-white/8 text-white/50">
              <th className="px-3 py-2 text-right">رتبه</th>
              <th className="px-3 py-2 text-right">تیم</th>
              <th className="px-3 py-2 text-left">امتیاز</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.teamId}
                ref={row.isMine ? mineRef : undefined}
                className={cn(
                  "border-b border-white/5",
                  row.isMine && "bg-bordin-orange/10 ring-1 ring-bordin-orange/30",
                )}
              >
                <td className="px-3 py-3">{formatPersianNumber(row.rank)}</td>
                <td className="px-3 py-3">
                  <Link
                    href={showcaseHref(row.teamId)}
                    className="inline-flex max-w-[220px] items-center gap-2 font-medium transition hover:text-bordin-orange"
                  >
                    {row.logoUrl ? (
                      <Image
                        src={row.logoUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 shrink-0 rounded-lg object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/8 text-xs">
                        {row.teamName.charAt(0) || "⚽"}
                      </span>
                    )}
                    <span className="truncate">{row.teamName}</span>
                  </Link>
                </td>
                <td className="px-3 py-3 text-left">
                  {stage === "REGISTRATION" || row.rankingScore === null
                    ? "—"
                    : formatPersianNumber(row.rankingScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
