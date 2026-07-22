"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/shared/components/layout/page-header";
import { StatBlock } from "@/shared/components/ui/stat-block";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { useToast } from "@/shared/components/ui/toast";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AdminWalletPanel } from "@/features/admin/components/admin-wallet-panel";
import { AdminCompetitionsPanel } from "@/features/admin/components/admin-competitions-panel";
import { AdminChatReportsPanel } from "@/features/admin/components/admin-chat-reports-panel";
import { AdminWatchPartyPanel } from "@/features/admin/components/admin-watch-party-panel";
import { AdminEnergyPanel } from "@/features/admin/components/admin-energy-panel";

type AdminTab =
  | "general"
  | "competitions"
  | "wallet"
  | "chat-reports"
  | "watch-party"
  | "energy";

export function AdminDashboard() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<AdminTab>(
    initialTab === "competitions" ||
    initialTab === "wallet" ||
    initialTab === "chat-reports" ||
    initialTab === "watch-party" ||
    initialTab === "energy"
      ? initialTab
      : "general",
  );
  const [dashboard, setDashboard] = useState<Record<string, number> | null>(null);
  const [cups, setCups] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      initialTab === "competitions" ||
      initialTab === "wallet" ||
      initialTab === "chat-reports" ||
      initialTab === "watch-party" ||
      initialTab === "energy"
    ) {
      setTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/dashboard").then((r) => r.json()),
      fetch("/api/admin/cups").then((r) => r.json()),
    ]).then(([d, c]) => {
      if (d.error) {
        setError(d.error);
        return;
      }
      setDashboard(d.dashboard);
      setCups(c.cups ?? []);
    });
  }, []);

  if (error) {
    return (
      <>
        <PageHeader title="پنل ادمین" />
        <p className="px-4 py-8 text-center text-red-400">{error}</p>
        <p className="px-4 text-center text-xs text-white/40">برای تست: در حالت dev کاربر با role=admin لازم است</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="پنل ادمین" subtitle="مدیریت بُردین" />
      <div className="space-y-6 px-4 py-4">
        <div className="flex gap-2 overflow-x-auto">
          <Chip active={tab === "general"} onClick={() => setTab("general")}>
            عمومی
          </Chip>
          <Chip active={tab === "competitions"} onClick={() => setTab("competitions")}>
            مدیریت رقابت‌ها
          </Chip>
          <Chip active={tab === "wallet"} onClick={() => setTab("wallet")}>
            کیف پول
          </Chip>
          <Chip active={tab === "chat-reports"} onClick={() => setTab("chat-reports")}>
            گزارش پیام
          </Chip>
          <Chip active={tab === "watch-party"} onClick={() => setTab("watch-party")}>
            watch party
          </Chip>
          <Chip active={tab === "energy"} onClick={() => setTab("energy")}>
            سطح انرژی
          </Chip>
        </div>

        {tab === "energy" ? <AdminEnergyPanel /> : null}

        {tab === "watch-party" ? <AdminWatchPartyPanel /> : null}

        {tab === "chat-reports" ? (
          <section>
            <h3 className="mb-3 font-bold">گزارش پیام‌های چت</h3>
            <AdminChatReportsPanel />
          </section>
        ) : null}

        {tab === "wallet" ? <AdminWalletPanel /> : null}

        {tab === "competitions" ? (
          <AdminCompetitionsPanel
            initialCups={cups.map((cup) => ({
              id: cup.id as string,
              titleFa: cup.titleFa as string,
              isPublished: cup.isPublished as boolean,
            }))}
          />
        ) : null}

        {tab === "general" ? (
          <>
            {!dashboard ? (
              <Skeleton className="h-20" />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatBlock label="کاربران" value={dashboard.usersCount} />
                <StatBlock label="جام‌ها" value={dashboard.cupsCount} accent="text-bordin-orange" />
                <StatBlock label="تورنمنت" value={dashboard.tournamentsCount} accent="text-bordin-purple" />
                <StatBlock
                  label="رقابت تیمی"
                  value={dashboard.teamCompsCount ?? 0}
                  accent="text-bordin-green"
                />
              </div>
            )}

            <section>
              <h3 className="mb-3 font-bold">همگام‌سازی کنداکتور</h3>
              <p className="mb-3 text-xs text-white/45">
                نیاز به FIXTURE_API_KEY در env دارد.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const res = await fetch("/api/admin/predictions/settle", { method: "POST" });
                    const data = await res.json();
                    if (!res.ok) {
                      toast(data.error ?? "خطا", "error");
                      return;
                    }
                    toast(`${data.settled} پیش‌بینی امتیازدهی شد`, "success");
                  }}
                >
                  امتیازدهی
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const res = await fetch("/api/admin/kandakator/sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ week: true }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      toast(data.error ?? "خطا", "error");
                      return;
                    }
                    const total = (data.results as Array<{ matchCount: number }>).reduce(
                      (sum, item) => sum + item.matchCount,
                      0,
                    );
                    toast(`${total} بازی برای هفته همگام شد`, "success");
                  }}
                >
                  sync هفته
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await fetch("/api/admin/kandakator/sync", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      toast(data.error ?? "خطا", "error");
                      return;
                    }
                    toast(`${data.result.matchCount} بازی امروز sync شد`, "success");
                  }}
                >
                  sync امروز
                </Button>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
