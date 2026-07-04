"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Chip } from "@/shared/components/ui/chip";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber, formatTehranDateTime } from "@/shared/lib/dates";

type ShebaItem = {
  userId: string;
  phone: string;
  displayName: string;
  shebaDisplay: string | null;
  submittedAt: string | null;
  inquiryMatched: boolean | null;
};

type WithdrawalItem = {
  id: string;
  displayName: string;
  phone: string;
  amountToman: number;
  createdAt: string;
  shebaDigits: string | null;
};

type CoinPurchaseItem = {
  id: string;
  displayName: string;
  phone: string;
  amountToman: number;
  coinsGranted: number;
  method: "wallet" | "gateway";
  createdAt: string;
};

export function AdminWalletPanel() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"sheba" | "purchases" | "withdrawals">("sheba");
  const [shebas, setShebas] = useState<ShebaItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [coinPurchases, setCoinPurchases] = useState<CoinPurchaseItem[]>([]);
  const [inquiryMsg, setInquiryMsg] = useState<Record<string, string>>({});

  const load = async () => {
    const [sRes, wRes, pRes] = await Promise.all([
      fetch("/api/admin/wallet/shebas"),
      fetch("/api/admin/wallet/withdrawals"),
      fetch("/api/admin/wallet/coin-purchases"),
    ]);
    const sData = await sRes.json();
    const wData = await wRes.json();
    const pData = await pRes.json();
    setShebas(sData.items ?? []);
    setWithdrawals(wData.items ?? []);
    setCoinPurchases(pData.items ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const shebaAction = async (userId: string, action: string) => {
    const res = await fetch(`/api/admin/wallet/shebas/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    if (action === "inquire" && data.result?.messageFa) {
      setInquiryMsg((prev) => ({ ...prev, [userId]: data.result.messageFa }));
      toast(data.result.messageFa, data.result.matched ? "success" : "error");
    } else {
      toast("انجام شد", "success");
    }
    void load();
  };

  const withdrawalAction = async (id: string, action: string) => {
    const res = await fetch(`/api/admin/wallet/withdrawals/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.error ?? "خطا", "error");
      return;
    }
    toast("انجام شد", "success");
    void load();
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-2 overflow-x-auto">
        <Chip active={tab === "sheba"} onClick={() => setTab("sheba")}>تأیید شبا</Chip>
        <Chip active={tab === "purchases"} onClick={() => setTab("purchases")}>
          خرید سکه توسط کاربران
        </Chip>
        <Chip active={tab === "withdrawals"} onClick={() => setTab("withdrawals")}>درخواست‌های دریافت وجه</Chip>
      </div>

      {tab === "sheba" ? (
      <section>
        <h3 className="mb-3 font-bold">کیف پول کاربران — تأیید شبا</h3>
        {shebas.length === 0 ? (
          <p className="text-sm text-white/45">درخواست شبای در انتظاری نیست.</p>
        ) : (
          <div className="space-y-3">
            {shebas.map((item) => (
              <div key={item.userId} className="rounded-xl border border-white/8 p-3">
                <p className="font-semibold">{item.displayName}</p>
                <p className="text-xs text-white/45">{item.phone}</p>
                <p className="mt-1 text-sm" dir="ltr">
                  {item.shebaDisplay}
                </p>
                {item.submittedAt ? (
                  <p className="mt-1 text-[10px] text-white/35">
                    {formatTehranDateTime(item.submittedAt)}
                  </p>
                ) : null}
                {inquiryMsg[item.userId] ? (
                  <p className="mt-2 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/60">
                    {inquiryMsg[item.userId]}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void shebaAction(item.userId, "inquire")}>
                    استعلام شماره شبا
                  </Button>
                  <Button size="sm" onClick={() => void shebaAction(item.userId, "approve")}>
                    تأیید شماره شبا
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void shebaAction(item.userId, "request-edit")}>
                    درخواست ویرایش شبا
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {tab === "purchases" ? (
      <section>
        <h3 className="mb-3 font-bold">خرید سکه توسط کاربران</h3>
        {coinPurchases.length === 0 ? (
          <p className="text-sm text-white/45">خرید موفقی ثبت نشده است.</p>
        ) : (
          <div className="space-y-3">
            {coinPurchases.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/8 p-3">
                <p className="font-semibold">{item.displayName}</p>
                <p className="text-xs text-white/45">{item.phone}</p>
                <p className="mt-1 text-sm text-bordin-orange">
                  {formatPersianNumber(item.amountToman)} تومان
                </p>
                <p className="text-xs text-bordin-green">
                  {formatPersianNumber(item.coinsGranted)} سکه
                </p>
                <p className="mt-1 text-[10px] text-white/35">
                  روش پرداخت: {item.method === "wallet" ? "کیف پول" : "درگاه پرداخت"}
                </p>
                <p className="text-[10px] text-white/35">{formatTehranDateTime(item.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {tab === "withdrawals" ? (
      <section>
        <h3 className="mb-3 font-bold">درخواست‌های دریافت وجه</h3>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-white/45">درخواست در انتظاری نیست.</p>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/8 p-3">
                <p className="font-semibold">{item.displayName}</p>
                <p className="text-xs text-white/45">{item.phone}</p>
                <p className="mt-1 text-sm text-bordin-orange">
                  {formatPersianNumber(item.amountToman)} تومان
                </p>
                <p className="text-[10px] text-white/35">{formatTehranDateTime(item.createdAt)}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => void withdrawalAction(item.id, "approve")}>
                    تأیید پرداخت
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => void withdrawalAction(item.id, "reject")}>
                    عدم تأیید پرداخت
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </div>
  );
}
