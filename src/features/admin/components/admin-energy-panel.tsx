"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Modal } from "@/shared/components/ui/modal";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  DEFAULT_ENERGY_COSTS,
  ENERGY_ACTIVITIES,
  ENERGY_ACTIVITY_LABELS_FA,
  ENERGY_RECOVERY_MODE_DEFAULT,
  ENERGY_RECOVERY_MODE_INVITE,
  type EnergyActivity,
  type EnergyCostsMap,
} from "@/shared/constants/energy";
import type { EnergyConfigView } from "@/shared/types/energy";

export function AdminEnergyPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [costs, setCosts] = useState<EnergyCostsMap>({ ...DEFAULT_ENERGY_COSTS });
  // String drafts so mobile users can clear the default "0" while typing.
  const [costInputs, setCostInputs] = useState<Record<EnergyActivity, string>>(() =>
    Object.fromEntries(
      ENERGY_ACTIVITIES.map((key) => [key, String(DEFAULT_ENERGY_COSTS[key])]),
    ) as Record<EnergyActivity, string>,
  );
  const [inviteRecoveryEnabled, setInviteRecoveryEnabled] = useState(false);

  const syncCostInputs = (next: EnergyCostsMap) => {
    setCostInputs(
      Object.fromEntries(
        ENERGY_ACTIVITIES.map((key) => [key, String(next[key] ?? 0)]),
      ) as Record<EnergyActivity, string>,
    );
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/energy");
        const data = await res.json();
        if (!res.ok) {
          toast(data.error ?? "خطا در بارگذاری", "error");
          setLoading(false);
          return;
        }
        const config = data.config as EnergyConfigView;
        const next = { ...DEFAULT_ENERGY_COSTS, ...config.costs };
        setCosts(next);
        syncCostInputs(next);
        setInviteRecoveryEnabled(config.inviteRecoveryEnabled);
      } catch {
        toast("خطا در بارگذاری", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const total = useMemo(
    () => ENERGY_ACTIVITIES.reduce((sum, key) => sum + (Number(costs[key]) || 0), 0),
    [costs],
  );

  const exceedsHundred = total > 100;

  const setCostInput = (activity: EnergyActivity, raw: string) => {
    // Allow empty while typing; only accept non-negative integers otherwise.
    if (raw !== "" && !/^\d+$/.test(raw)) return;
    setCostInputs((prev) => ({ ...prev, [activity]: raw }));
    setCosts((prev) => ({
      ...prev,
      [activity]: raw === "" ? 0 : Number(raw),
    }));
  };

  const apply = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/energy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costs, inviteRecoveryEnabled }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error ?? "خطا در اعمال", "error");
        return;
      }
      const config = data.config as EnergyConfigView;
      const next = { ...DEFAULT_ENERGY_COSTS, ...config.costs };
      setCosts(next);
      syncCostInputs(next);
      setInviteRecoveryEnabled(config.inviteRecoveryEnabled);
      toast("تنظیمات سطح انرژی اعمال شد", "success");
      setConfirmOpen(false);
    } catch {
      toast("خطا در اعمال", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">سطح انرژی</h3>
          <p className="mt-1 text-xs text-white/50">
            درصد مصرف هر فعالیت برای یک بار اجرا تنظیم می‌شود.
          </p>
        </div>
        <div
          className={`rounded-xl border px-3 py-2 text-left ${
            exceedsHundred
              ? "border-red-500/50 bg-red-500/10"
              : "border-white/10 bg-white/5"
          }`}
        >
          <p className="text-[10px] text-white/45">مجموع مصرف</p>
          <p
            className={`text-lg font-bold ${
              exceedsHundred ? "text-red-400" : "text-bordin-orange"
            }`}
          >
            {formatPersianNumber(total)}٪
          </p>
        </div>
      </div>

      {exceedsHundred ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-6 text-red-300">
          هشدار: مجموع درصد مصرف فعالیت‌ها از ۱۰۰٪ بیشتر است. می‌توانید همچنان اعمال کنید، اما
          کاربران سریع‌تر انرژی از دست می‌دهند.
        </div>
      ) : null}

      <div className="space-y-2">
        {ENERGY_ACTIVITIES.map((activity) => (
          <label
            key={activity}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
          >
            <span className="text-sm text-white/80">{ENERGY_ACTIVITY_LABELS_FA[activity]}</span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={costInputs[activity]}
                onChange={(e) => setCostInput(activity, e.target.value)}
                onBlur={() => {
                  if (costInputs[activity] === "") {
                    setCostInput(activity, "0");
                  }
                }}
                className="w-20 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-center text-sm outline-none focus:border-bordin-orange/50"
              />
              <span className="text-xs text-white/40">٪</span>
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="mb-2 text-xs font-semibold text-white/70">شرط بازیابی انرژی</p>
        <div className="space-y-2">
          <label className="flex items-start gap-2 rounded-lg border border-[#f5b942]/30 bg-[#f5b942]/8 px-3 py-2 text-sm">
            <input type="checkbox" checked disabled className="mt-1" />
            <span>
              <span className="font-semibold text-[#ffd54a]">
                حالت پیش‌فرض ۶ ساعته - پر شدن ۵۰٪
              </span>
              <span className="mt-1 block text-xs text-white/50">
                همیشه فعال است و با گزینه دعوت جایگزین نمی‌شود.
              </span>
              <span className="sr-only">{ENERGY_RECOVERY_MODE_DEFAULT}</span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={inviteRecoveryEnabled}
              onChange={(e) => setInviteRecoveryEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-semibold">دعوت از دوستان</span>
              <span className="mt-1 block text-xs text-white/50">
                هر دعوت موفق ۱۰٪ انرژی برمی‌گرداند (حداکثر ۱۰ دعوت). علاوه بر بازیابی ۶ ساعته.
              </span>
              <span className="sr-only">{ENERGY_RECOVERY_MODE_INVITE}</span>
            </span>
          </label>
        </div>
      </div>

      <Button fullWidth onClick={() => setConfirmOpen(true)}>
        اعمال
      </Button>

      <Modal open={confirmOpen} onClose={() => { if (!saving) setConfirmOpen(false); }}>
        <p className="text-center text-sm leading-7 text-white/85">
          آیا از اعمال تغییرات سطح انرژی مطمئن هستی؟
        </p>
        <div className="mt-5 flex gap-2">
          <Button fullWidth loading={saving} onClick={() => void apply()}>
            بله
          </Button>
          <Button
            fullWidth
            variant="secondary"
            disabled={saving}
            onClick={() => setConfirmOpen(false)}
          >
            بازنگری
          </Button>
        </div>
      </Modal>
    </section>
  );
}
