"use client";

import { formatTehranDateTime } from "@/shared/lib/dates";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useEffect, useState } from "react";

type ReportRow = {
  id: string;
  createdAt: string;
  reporterName: string;
  offenderName: string;
  messageBody: string;
  roomSlug: string;
  teamId: string | null;
};

function roomLabel(slug: string, teamId: string | null) {
  const map: Record<string, string> = {
    PUBLIC: "عمومی",
    TODAY_PREDICTIONS: "پیش‌بینی امروز",
    TEAMS: "تیم‌ها",
    TEAMS_ALL: "تمام تیم‌ها",
    COMPETITIONS: "رقابت‌ها",
  };
  const base = map[slug] ?? slug;
  return teamId ? `${base} (تیم)` : base;
}

export function AdminChatReportsPanel() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/chat-reports")
      .then((r) => r.json())
      .then((data) => setReports(data.reports ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-40" />;

  if (reports.length === 0) {
    return <p className="text-sm text-white/45">گزارش پیامی ثبت نشده است.</p>;
  }

  return (
    <div className="space-y-3">
      {reports.map((row) => (
        <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
            <span>{formatTehranDateTime(row.createdAt)}</span>
            <span className="text-bordin-orange">{roomLabel(row.roomSlug, row.teamId)}</span>
          </div>
          <p className="mt-2 text-white/70">
            گزارش‌دهنده: <span className="font-semibold text-white">{row.reporterName}</span>
          </p>
          <p className="mt-1 text-white/70">
            متخلف: <span className="font-semibold text-red-300">{row.offenderName}</span>
          </p>
          <p className="mt-2 rounded-lg bg-black/30 px-3 py-2 text-xs leading-6 text-white/80">
            {row.messageBody}
          </p>
        </div>
      ))}
    </div>
  );
}
