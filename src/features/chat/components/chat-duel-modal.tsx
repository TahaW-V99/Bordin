"use client";

import { useCallback, useEffect, useState } from "react";
import { Swords, X, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { ChatDuelOpponentDto } from "@/shared/types/chat";
import { PublicProfileLink } from "@/shared/components/profile/public-profile-link";

export function ChatDuelModal({
  matchIds,
  matchLabels,
  onClose,
  onCreated,
}: {
  matchIds: string[];
  matchLabels: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"opponent" | "confirm">("opponent");
  const [opponents, setOpponents] = useState<ChatDuelOpponentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [opponent, setOpponent] = useState<ChatDuelOpponentDto | null>(null);
  const [search, setSearch] = useState("");

  const loadOpponents = useCallback(async (query?: string) => {
    setLoading(true);
    const params = query?.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
    const res = await fetch(`/api/chat/duel${params}`, { cache: "no-store" });
    const data = await res.json();
    setOpponents(data.opponents ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOpponents();
  }, [loadOpponents]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadOpponents(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, loadOpponents]);

  const submit = async () => {
    if (!opponent) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat/duel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId: opponent.userId, matchIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ثبت دوئل ناموفق بود");
      toast("دوئل پیش‌بینی ثبت شد! بزن بریم ⚔️", "success");
      onCreated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطا", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="بستن" onClick={onClose} />
      <div
        className="relative z-10 max-h-[calc(88dvh+6cm)] min-h-[min(520px,calc(88dvh+6cm))] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-4 sm:rounded-3xl"
        style={{ maxHeight: "calc(88dvh + 6cm)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-red-400" />
            <h2 className="text-sm font-bold text-white">دوئل پیش‌بینی</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/60">
          <p className="font-semibold text-white/80">بازی‌های انتخاب‌شده:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {matchLabels.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>

        {step === "opponent" ? (
          <>
            <p className="mb-3 text-xs text-white/50">حریف خود را انتخاب کنید:</p>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی نام بازیکن…"
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 ps-10 pe-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-bordin-orange/40"
              />
            </div>
            {loading ? (
              <p className="py-6 text-center text-sm text-white/40">در حال بارگذاری…</p>
            ) : opponents.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">بازیکنی یافت نشد.</p>
            ) : (
              <div className="max-h-[min(52vh,28rem)] space-y-2 overflow-y-auto pe-1">
                {opponents.map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2"
                  >
                    {p.showcaseSlug ? (
                      <PublicProfileLink slug={p.showcaseSlug} ariaLabel={`پروفایل ${p.displayName}`}>
                        <ProfileAvatar
                          avatarUrl={p.avatarUrl}
                          displayName={p.displayName}
                          size="sm"
                          className="h-9 w-9 shrink-0"
                        />
                      </PublicProfileLink>
                    ) : (
                      <ProfileAvatar
                        avatarUrl={p.avatarUrl}
                        displayName={p.displayName}
                        size="sm"
                        className="h-9 w-9 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      {p.showcaseSlug ? (
                        <PublicProfileLink
                          slug={p.showcaseSlug}
                          className="block truncate text-sm font-semibold text-white hover:text-bordin-orange"
                        >
                          {p.displayName}
                        </PublicProfileLink>
                      ) : (
                        <p className="truncate text-sm font-semibold text-white">{p.displayName}</p>
                      )}
                      <p className="text-[10px] text-white/45">
                        رتبه {p.globalRank ? formatPersianNumber(p.globalRank) : "—"} ·{" "}
                        {formatPersianNumber(p.totalXp)} امتیاز
                        {p.isTeammate ? (
                          <span className="ms-1 text-bordin-green">· هم‌تیمی</span>
                        ) : null}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOpponent(p);
                        setStep("confirm");
                      }}
                      className="shrink-0 rounded-lg border border-bordin-orange/40 bg-bordin-orange/10 px-3 py-1.5 text-xs font-semibold text-bordin-orange"
                    >
                      انتخاب
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-4 text-sm leading-7 text-white/80">
              آیا مطمئنید می‌خواهید به{" "}
              <span className="font-bold text-bordin-orange">{opponent?.displayName}</span> در
              پیش‌بینی این بازی‌ها دوئل بدهید؟
            </p>
            <p className="mb-4 text-[11px] text-white/45">
              این یک چالش افتخار فوتبالی است — بدون شرط‌بندی.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("opponent")}>
                بازگشت
              </Button>
              <Button className="flex-1" loading={submitting} onClick={() => void submit()}>
                تأیید دوئل ⚔️
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
