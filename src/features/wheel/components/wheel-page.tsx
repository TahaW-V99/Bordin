"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  FortuneWheel,
  computeWheelRotation,
  type FortuneWheelSegment,
} from "@/features/wheel/components/fortune-wheel";
import { WheelTicketWinModal } from "@/features/wheel/components/wheel-ticket-win-modal";
import { WHEEL_REWARD_OPTIONS, type WheelTicketReward } from "@/shared/constants/wheel";
import { getTicketAssetByWalletField } from "@/shared/constants/tickets";

type WheelStatus = {
  canSpin: boolean;
  segments: FortuneWheelSegment[];
};

type SpinResult = {
  coinsWon: number;
  ticketsWon?: WheelTicketReward[];
  segmentIndex: number;
};

function buildFallbackSegments(): FortuneWheelSegment[] {
  return WHEEL_REWARD_OPTIONS.map((option) => ({
    coins: option.amount,
    tickets: option.tickets ?? [],
  }));
}

export function WheelPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{
    coins: number;
    tickets: WheelTicketReward[];
  } | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const rotationBase = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/wheel");
    const data = await res.json();
    const segments: FortuneWheelSegment[] =
      Array.isArray(data.segments) && data.segments.length === WHEEL_REWARD_OPTIONS.length
        ? data.segments
        : Array.isArray(data.segmentLayout) &&
            data.segmentLayout.length === WHEEL_REWARD_OPTIONS.length
          ? data.segmentLayout.map((coins: number) => {
              const option = WHEEL_REWARD_OPTIONS.find((item) => item.amount === coins);
              return {
                coins,
                tickets: option?.tickets ?? [],
              };
            })
          : buildFallbackSegments();

    setStatus({
      canSpin: Boolean(data.canSpin),
      segments,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const executeSpin = async () => {
    if (!status?.canSpin || spinning) return;
    setSpinning(true);
    setResult(null);
    setTicketModalOpen(false);

    const res = await fetch("/api/wheel", { method: "POST" });
    const data = (await res.json()) as SpinResult & { error?: string };

    if (!res.ok) {
      setSpinning(false);
      toast(data.error ?? "خطا در چرخش", "error");
      return;
    }

    const targetRotation =
      rotationBase.current +
      computeWheelRotation(data.segmentIndex, status?.segments.length ?? 0);
    const targetBallRotation = ballRotation - targetRotation * 0.45;

    setWheelRotation(targetRotation);
    setBallRotation(targetBallRotation);
    rotationBase.current = targetRotation;

    const ticketsWon = data.ticketsWon ?? [];

    window.setTimeout(() => {
      setSpinning(false);
      setResult({ coins: data.coinsWon, tickets: ticketsWon });
      setStatus((prev) => (prev ? { ...prev, canSpin: false } : prev));

      if (ticketsWon.length > 0) {
        setTicketModalOpen(true);
      } else {
        toast(
          `تبریک! ${formatPersianNumber(data.coinsWon)} سکه برنده شدید`,
          "success",
        );
      }
      void load();
    }, 4300);
  };

  const segments =
    status?.segments.length === WHEEL_REWARD_OPTIONS.length
      ? status.segments
      : buildFallbackSegments();

  return (
    <>
      <PageHeader title="گردونه شانس" subtitle="هر ۲۴ ساعت یک چرخش رایگان" />

      <div className="flex flex-col items-center px-4 py-6">
        <FortuneWheel
          segments={segments}
          wheelRotation={wheelRotation}
          ballRotation={ballRotation}
          spinning={spinning}
        />

        {result !== null ? (
          <div className="mt-6 space-y-1 text-center">
            <p className="text-xl font-bold text-bordin-green">
              +{formatPersianNumber(result.coins)} سکه
            </p>
            {result.tickets.map((ticket) => {
              const asset = getTicketAssetByWalletField(ticket.ticketType);
              return (
                <p
                  key={`${ticket.ticketType}-${ticket.quantity}`}
                  className="text-sm font-medium text-bordin-orange"
                >
                  +×{formatPersianNumber(ticket.quantity)} {asset?.title ?? "بلیط"}
                </p>
              );
            })}
          </div>
        ) : null}

        <Button
          className="mt-6"
          size="lg"
          fullWidth
          disabled={!status?.canSpin || spinning}
          loading={spinning}
          onClick={() => void executeSpin()}
        >
          {status?.canSpin ? "بچرخان!" : "فردا دوباره بیا"}
        </Button>
      </div>

      <WheelTicketWinModal
        open={ticketModalOpen && (result?.tickets.length ?? 0) > 0}
        coins={result?.coins ?? 0}
        tickets={result?.tickets ?? []}
        onClose={() => setTicketModalOpen(false)}
      />
    </>
  );
}
