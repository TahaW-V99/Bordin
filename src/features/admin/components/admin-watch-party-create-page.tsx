"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Modal } from "@/shared/components/ui/modal";
import { useToast } from "@/shared/components/ui/toast";
import { cn } from "@/shared/lib/cn";
import { formatTehranDateTime, formatPersianNumber } from "@/shared/lib/dates";
import type { AdminKandakatorMatchOption } from "@/server/services/watch-party-service";

type SelectedMatch = AdminKandakatorMatchOption;

type RoomDraft = {
  matchId: string;
  googleMeetUrl: string;
  capacity: string;
  entryFeeCoins: string;
};

export function AdminWatchPartyCreatePage() {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [matches, setMatches] = useState<AdminKandakatorMatchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedMatch[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RoomDraft>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [openLeagues, setOpenLeagues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/admin/watch-party")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "خطا");
        return data;
      })
      .then((data) => setMatches(data.matches ?? []))
      .catch((err) => toast(err instanceof Error ? err.message : "خطا", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const grouped = useMemo(() => {
    const map = new Map<string, AdminKandakatorMatchOption[]>();
    for (const match of matches) {
      const list = map.get(match.leagueName) ?? [];
      list.push(match);
      map.set(match.leagueName, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b, "fa"));
  }, [matches]);

  const toggleMatch = (match: AdminKandakatorMatchOption) => {
    setSelected((prev) => {
      const exists = prev.some((row) => row.matchId === match.matchId);
      if (exists) {
        return prev.filter((row) => row.matchId !== match.matchId);
      }
      return [...prev, match];
    });
  };

  const initDrafts = () => {
    const next: Record<string, RoomDraft> = {};
    for (const match of selected) {
      next[match.matchId] = drafts[match.matchId] ?? {
        matchId: match.matchId,
        googleMeetUrl: "",
        capacity: "20",
        entryFeeCoins: "100",
      };
    }
    setDrafts(next);
  };

  const goStep2 = () => {
    if (selected.length === 0) {
      toast("حداقل یک مسابقه انتخاب کنید", "error");
      return;
    }
    initDrafts();
    setStep(2);
  };

  const goStep3 = () => {
    for (const match of selected) {
      const draft = drafts[match.matchId];
      if (!draft?.googleMeetUrl.trim()) {
        toast(`لینک گوگل میت برای ${match.homeTeamName} - ${match.awayTeamName} الزامی است`, "error");
        return;
      }
    }
    setStep(3);
  };

  const publish = async () => {
    setPublishing(true);
    try {
      const rooms = selected.map((match) => {
        const draft = drafts[match.matchId];
        return {
          matchId: match.matchId,
          googleMeetUrl: draft.googleMeetUrl.trim(),
          capacity: Number(draft.capacity),
          entryFeeCoins: Number(draft.entryFeeCoins),
        };
      });

      const res = await fetch("/api/admin/watch-party/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خطا");
      toast("اتاق‌ها با موفقیت منتشر شد", "success");
      setConfirmOpen(false);
      window.location.href = "/admin?tab=watch-party";
    } catch (error) {
      toast(error instanceof Error ? error.message : "خطا", "error");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <PageHeader title="ایجاد اتاق Watch Party" subtitle={`مرحله ${formatPersianNumber(step)} از ۳`} />
      <div className="space-y-6 px-4 py-4">
        <Link href="/admin?tab=watch-party" className="text-xs text-bordin-orange">
          بازگشت به پنل
        </Link>

        {step === 1 ? (
          <section className="space-y-4">
            <p className="text-sm text-white/60">مسابقات کنداکتور تا یک هفته آینده را انتخاب کنید.</p>
            {loading ? <p className="text-sm text-white/45">در حال بارگذاری...</p> : null}
            {grouped.map(([leagueName, leagueMatches]) => {
              const open = openLeagues[leagueName] ?? true;
              return (
                <div key={leagueName} className="overflow-hidden rounded-2xl border border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenLeagues((prev) => ({ ...prev, [leagueName]: !open }))
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-right"
                  >
                    <span className="font-semibold">{leagueName}</span>
                    <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
                  </button>
                  {open ? (
                    <div className="space-y-2 border-t border-white/10 p-3">
                      {leagueMatches.map((match) => {
                        const isSelected = selected.some((row) => row.matchId === match.matchId);
                        return (
                          <button
                            key={match.matchId}
                            type="button"
                            onClick={() => toggleMatch(match)}
                            className={cn(
                              "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-right text-sm",
                              isSelected
                                ? "border-bordin-orange/50 bg-bordin-orange/10"
                                : "border-white/10 bg-white/[0.02]",
                            )}
                          >
                            <div>
                              <p className="font-medium">
                                {match.homeTeamName} - {match.awayTeamName}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {formatTehranDateTime(match.kickoffAt)}
                              </p>
                            </div>
                            {match.hasPublishedRoom ? (
                              <span className="text-[10px] text-bordin-green">منتشر شده</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            <Button fullWidth onClick={goStep2}>
              ادامه
            </Button>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <p className="text-sm text-white/60">برای هر مسابقه لینک گوگل میت را وارد کنید.</p>
            {selected.map((match) => (
              <div key={match.matchId} className="rounded-2xl border border-white/10 p-4">
                <p className="font-semibold">
                  {match.homeTeamName} - {match.awayTeamName}
                </p>
                <p className="mb-3 text-xs text-white/45">{formatTehranDateTime(match.kickoffAt)}</p>
                <Input
                  value={drafts[match.matchId]?.googleMeetUrl ?? ""}
                  onChange={(event) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [match.matchId]: {
                        ...(prev[match.matchId] ?? {
                          matchId: match.matchId,
                          capacity: "20",
                          entryFeeCoins: "100",
                        }),
                        googleMeetUrl: event.target.value,
                      },
                    }))
                  }
                  placeholder="https://meet.google.com/..."
                  dir="ltr"
                  className="text-left"
                />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setStep(1)}>
                قبلی
              </Button>
              <Button fullWidth onClick={goStep3}>
                ادامه
              </Button>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-4">
            <p className="text-sm text-white/60">ظرفیت و هزینه ورود هر اتاق را مشخص کنید.</p>
            {selected.map((match) => (
              <div key={match.matchId} className="rounded-2xl border border-white/10 p-4">
                <p className="font-semibold">
                  {match.homeTeamName} - {match.awayTeamName}
                </p>
                <p className="mb-3 text-xs text-white/45">{formatTehranDateTime(match.kickoffAt)}</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs text-white/55">
                    ظرفیت
                    <Input
                      type="number"
                      min={1}
                      value={drafts[match.matchId]?.capacity ?? "20"}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [match.matchId]: {
                            ...(prev[match.matchId] ?? {
                              matchId: match.matchId,
                              googleMeetUrl: "",
                              entryFeeCoins: "100",
                            }),
                            capacity: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs text-white/55">
                    هزینه ورود (سکه)
                    <Input
                      type="number"
                      min={0}
                      value={drafts[match.matchId]?.entryFeeCoins ?? "100"}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [match.matchId]: {
                            ...(prev[match.matchId] ?? {
                              matchId: match.matchId,
                              googleMeetUrl: "",
                              capacity: "20",
                            }),
                            entryFeeCoins: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setStep(2)}>
                قبلی
              </Button>
              <Button fullWidth onClick={() => setConfirmOpen(true)}>
                انتشار
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="space-y-4 text-right">
          <h2 className="text-lg font-bold">تأیید انتشار</h2>
          <p className="text-sm leading-7 text-white/70">
            آیا برای انتشار اتاق(های) گفتگو مطمئن هستی؟
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmOpen(false)}>
              خیر
            </Button>
            <Button fullWidth loading={publishing} onClick={() => void publish()}>
              بله
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
