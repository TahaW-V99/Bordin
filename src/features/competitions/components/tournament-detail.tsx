"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber, formatTehranDateTime } from "@/shared/lib/dates";
import { translateTeamNameToFa } from "@/shared/lib/football-names-fa";
import { Minus, Plus } from "lucide-react";
import Link from "next/link";

export function TournamentDetail({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [tournament, setTournament] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<Record<string, { home: number; away: number }>>({});

  const load = useCallback(async () => {
    const res = await fetch(`/api/tournaments/${tournamentId}`);
    const data = await res.json();
    setTournament(data.tournament);
  }, [tournamentId]);

  useEffect(() => { load(); }, [load]);

  const register = async () => {
    setLoading(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/register`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast(data.error, "error"); return; }
    toast("ثبت‌نام در تورنمنت انجام شد", "success");
    load();
  };

  const predict = async (matchId: string) => {
    const s = scores[matchId] ?? { home: 0, away: 0 };
    setLoading(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, homePrediction: s.home, awayPrediction: s.away }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast(data.error, "error"); return; }
    toast("پیش‌بینی ثبت شد", "success");
    load();
  };

  if (!tournament) return <PageHeader title="تورنمنت" subtitle="..." />;

  const joined = tournament.joined as boolean;
  const matches = (tournament.matches ?? []) as Array<Record<string, unknown>>;
  const predictions = (tournament.predictions ?? []) as Array<{ matchId: string }>;
  const predictedIds = new Set(predictions.map((p) => p.matchId));

  return (
    <>
      <PageHeader title={tournament.nameFa as string} subtitle={tournament.description as string} />
      <div className="space-y-4 px-4 py-4">
        <Card>
          <CardContent className="space-y-2 pt-4 text-sm text-white/60">
            <p>ثبت‌نام: {formatPersianNumber(tournament.registrationFeeCoins as number)} سکه</p>
            <p>هر پیش‌بینی: {formatPersianNumber(tournament.predictionFeeCoins as number)} سکه</p>
            <p>امتیاز تورنمنت ×{formatPersianNumber(tournament.pointsMultiplier as number)} در لیدربورد</p>
          </CardContent>
        </Card>

        {!joined ? (
          <Button fullWidth loading={loading} onClick={register}>ثبت‌نام در تورنمنت</Button>
        ) : (
          matches.map((m) => {
            const match = (m.match ?? m) as Record<string, unknown>;
            const matchId = (m.matchId ?? match.id) as string;
            const done = predictedIds.has(matchId);
            const s = scores[matchId] ?? { home: 0, away: 0 };
            return (
              <Card key={matchId}>
                <CardContent className="space-y-3 pt-4">
                  <p className="font-bold text-center">
                    {translateTeamNameToFa(match.homeTeamName as string)} vs{" "}
                    {translateTeamNameToFa(match.awayTeamName as string)}
                  </p>
                  <p className="text-center text-xs text-white/50">{formatTehranDateTime(match.kickoffAt as string)}</p>
                  {done ? (
                    <p className="text-center text-sm text-bordin-green">پیش‌بینی ثبت شده</p>
                  ) : (
                    <>
                      <div className="flex justify-center gap-6">
                        {(["home", "away"] as const).map((side) => (
                          <div key={side} className="flex items-center gap-2">
                            <button type="button" onClick={() => setScores((prev) => ({ ...prev, [matchId]: { ...s, [side]: Math.max(0, s[side] - 1) } }))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Minus className="h-4 w-4" /></button>
                            <span className="w-6 text-center font-bold">{formatPersianNumber(s[side])}</span>
                            <button type="button" onClick={() => setScores((prev) => ({ ...prev, [matchId]: { ...s, [side]: Math.min(20, s[side] + 1) } }))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5"><Plus className="h-4 w-4" /></button>
                          </div>
                        ))}
                      </div>
                      <Button fullWidth size="sm" loading={loading} onClick={() => predict(matchId)}>ثبت پیش‌بینی</Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}

        <Link href={`/leaderboard?tournament=${tournamentId}`}>
          <Button variant="outline" fullWidth>لیدربورد تورنمنت</Button>
        </Link>
        <Button variant="ghost" fullWidth onClick={() => router.push("/competitions")}>بازگشت</Button>
      </div>
    </>
  );
}
