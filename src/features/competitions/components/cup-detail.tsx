"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber, formatTehranDateTime } from "@/shared/lib/dates";
import { translateTeamNameToFa } from "@/shared/lib/football-names-fa";
import { Minus, Plus } from "lucide-react";

export function CupDetail({ cupId }: { cupId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [cup, setCup] = useState<Record<string, unknown> | null>(null);
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cups/${cupId}`);
    const data = await res.json();
    setCup(data.cup);
    const pred = data.cup?.prediction as { homePrediction: number; awayPrediction: number } | null;
    if (pred) { setHome(pred.homePrediction); setAway(pred.awayPrediction); }
  }, [cupId]);

  useEffect(() => { load(); }, [load]);

  const join = async () => {
    setLoading(true);
    const res = await fetch(`/api/cups/${cupId}/join`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast(data.error, "error"); return; }
    toast("ثبت‌نام در جام انجام شد", "success");
    load();
  };

  const predict = async () => {
    setLoading(true);
    const res = await fetch(`/api/cups/${cupId}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homePrediction: home, awayPrediction: away }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast(data.error, "error"); return; }
    toast("پیش‌بینی ثبت شد", "success");
    load();
  };

  if (!cup) return <PageHeader title="جام" subtitle="در حال بارگذاری..." />;

  const match = cup.match as Record<string, unknown>;
  const joined = cup.joined as boolean;
  const prediction = cup.prediction as unknown;
  const tiers = (cup.rewardTiers ?? []) as Array<{ accuracyPercent: number; coins: number; xp: number }>;

  return (
    <>
      <PageHeader
        title={cup.titleFa as string}
        subtitle={cup.description as string}
        action={<Badge variant={cup.mode === "LEGEND" ? "purple" : "orange"}>{cup.mode === "LEGEND" ? "افسانه" : "عادی"}</Badge>}
      />
      <div className="space-y-4 px-4 py-4">
        <Card>
          <CardContent className="space-y-3 pt-4">
            <p className="text-center text-lg font-bold">
              {translateTeamNameToFa(match.homeTeamName as string)} vs{" "}
              {translateTeamNameToFa(match.awayTeamName as string)}
            </p>
            <p className="text-center text-sm text-white/50">{formatTehranDateTime(match.kickoffAt as string)}</p>
            <p className="text-center text-sm">ورودی: {formatPersianNumber(cup.entryFeeCoins as number)} سکه</p>
          </CardContent>
        </Card>

        {!joined ? (
          <Button fullWidth loading={loading} onClick={join}>ثبت‌نام در جام</Button>
        ) : !prediction ? (
          <Card>
            <CardContent className="space-y-4 pt-4">
              <p className="text-sm font-medium">پیش‌بینی شما</p>
              <div className="flex justify-center gap-8">
                {[{ v: home, set: setHome, l: "میزبان" }, { v: away, set: setAway, l: "میهمان" }].map(({ v, set, l }) => (
                  <div key={l} className="flex flex-col items-center gap-2">
                    <span className="text-xs text-white/50">{l}</span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => set(Math.max(0, v - 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Minus className="h-4 w-4" /></button>
                      <span className="w-6 text-center text-xl font-bold">{formatPersianNumber(v)}</span>
                      <button type="button" onClick={() => set(Math.min(20, v + 1))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Plus className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <Button fullWidth loading={loading} onClick={predict}>ثبت پیش‌بینی</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl border border-bordin-green/20 bg-bordin-green/5 p-4 text-center text-bordin-green">
            پیش‌بینی شما ثبت شده است
          </div>
        )}

        <div>
          <h3 className="mb-2 font-bold">جدول پاداش</h3>
          <div className="space-y-1">
            {tiers.map((t) => (
              <div key={t.accuracyPercent} className="flex justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span>{formatPersianNumber(t.accuracyPercent)}٪ دقت</span>
                <span className="text-bordin-orange">{formatPersianNumber(t.coins)} سکه · {formatPersianNumber(t.xp)} XP</span>
              </div>
            ))}
          </div>
        </div>

        <Button variant="ghost" fullWidth onClick={() => router.push("/competitions")}>بازگشت</Button>
      </div>
    </>
  );
}
