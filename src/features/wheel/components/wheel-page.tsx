"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  FortuneWheel,
  computeWheelRotation,
} from "@/features/wheel/components/fortune-wheel";
import { WheelSpinCostModal } from "@/features/wheel/components/wheel-spin-cost-modal";
import { WHEEL_REWARD_OPTIONS } from "@/shared/constants/wheel";

type WheelStatus = {
  canSpin: boolean;
  segmentLayout: number[];
  isCostSpin: boolean;
  calculatedCost: number;
  canApplyCost: boolean;
  totalCoins: number;
  nextSpinNumber: number;
};

type SpinResult = {
  coinsWon: number;
  segmentIndex: number;
  spinCost: {
    calculated: number;
    applied: number;
    skipped: boolean;
    skipReason: string | null;
    coinsLast3Days: number;
    isCostSpin: boolean;
  };
};

export function WheelPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<WheelStatus | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [ballRotation, setBallRotation] = useState(0);
  const [costModalOpen, setCostModalOpen] = useState(false);
  const rotationBase = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/wheel");
    const data = await res.json();
    setStatus({
      canSpin: data.canSpin,
      segmentLayout: data.segmentLayout ?? [],
      isCostSpin: Boolean(data.isCostSpin),
      calculatedCost: data.calculatedCost ?? 0,
      canApplyCost: Boolean(data.canApplyCost),
      totalCoins: data.totalCoins ?? 0,
      nextSpinNumber: data.nextSpinNumber ?? 1,
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const executeSpin = async () => {
    if (!status?.canSpin || spinning) return;
    setSpinning(true);
    setResult(null);
    setCostModalOpen(false);

    const res = await fetch("/api/wheel", { method: "POST" });
    const data = (await res.json()) as SpinResult & { error?: string };

    if (!res.ok) {
      setSpinning(false);
      toast(data.error ?? "خطا در چرخش", "error");
      return;
    }

    const targetRotation =
      rotationBase.current + computeWheelRotation(data.segmentIndex, status?.segmentLayout.length ?? 0);
    const targetBallRotation = ballRotation - targetRotation * 0.45;

    setWheelRotation(targetRotation);
    setBallRotation(targetBallRotation);
    rotationBase.current = targetRotation;

    window.setTimeout(() => {
      setSpinning(false);
      setResult(data.coinsWon);
      setStatus((prev) => (prev ? { ...prev, canSpin: false } : prev));

      let message = `تبریک! ${formatPersianNumber(data.coinsWon)} سکه برنده شدید`;
      if (data.spinCost.isCostSpin && data.spinCost.applied > 0) {
        message += ` (هزینه چرخش: ${formatPersianNumber(data.spinCost.applied)} سکه)`;
      } else if (data.spinCost.isCostSpin && data.spinCost.skipped) {
        message += " — هزینه چرخش اعمال نشد";
      }
      toast(message, "success");
      void load();
    }, 4300);
  };

  const onSpinClick = () => {
    if (!status?.canSpin || spinning) return;
    if (status.isCostSpin && status.calculatedCost > 0) {
      setCostModalOpen(true);
      return;
    }
    void executeSpin();
  };

  const segments =
    status?.segmentLayout.length === WHEEL_REWARD_OPTIONS.length
      ? status.segmentLayout
      : WHEEL_REWARD_OPTIONS.map((option) => option.amount);

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
          <p className="mt-6 text-xl font-bold text-bordin-green">
            +{formatPersianNumber(result)} سکه
          </p>
        ) : null}

        <Button
          className="mt-6"
          size="lg"
          fullWidth
          disabled={!status?.canSpin || spinning}
          loading={spinning}
          onClick={onSpinClick}
        >
          {status?.canSpin ? "بچرخان!" : "فردا دوباره بیا"}
        </Button>
      </div>

      <WheelSpinCostModal
        open={costModalOpen}
        calculatedCost={status?.calculatedCost ?? 0}
        totalCoins={status?.totalCoins ?? 0}
        canApply={status?.canApplyCost ?? false}
        onConfirm={() => void executeSpin()}
        onClose={() => setCostModalOpen(false)}
      />
    </>
  );
}
