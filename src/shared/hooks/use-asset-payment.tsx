"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import {
  FOOTBALL_CREDIT_CONFIRMATION_STATUS,
  FOOTBALL_CREDIT_DIALOG,
  isFootballCreditConfirmationPayload,
} from "@/shared/lib/asset-payment";

/**
 * Performs a single spend request. Receives `allowFootballCredit`, which the
 * caller must forward to the server (e.g. in the request body). It is called
 * once with `false`; if the server requires Football Credit confirmation and
 * the user accepts, it is called again with `true`.
 */
export type AssetPaymentFetcher = (allowFootballCredit: boolean) => Promise<Response>;

type AssetPaymentContextValue = {
  /**
   * Wraps a spend request with the application-wide asset spending priority
   * (Purchased → Reward → Football Credit). When the server signals that only
   * Football Credit can cover the cost, shows the shared confirmation dialog
   * and either retries with confirmation or navigates to the Store.
   *
   * Resolves with the final `Response`, or `null` when the action was cancelled
   * (user chose Store or dismissed the dialog) — callers must NOT continue the
   * original action in that case.
   */
  runWithAssetPayment: (fetcher: AssetPaymentFetcher) => Promise<Response | null>;
};

type DialogChoice = "confirm" | "store" | "cancel";

const AssetPaymentContext = createContext<AssetPaymentContextValue | null>(null);

export function AssetPaymentProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((choice: DialogChoice) => void) | null>(null);

  const settle = useCallback((choice: DialogChoice) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(choice);
  }, []);

  const runWithAssetPayment = useCallback(
    async (fetcher: AssetPaymentFetcher): Promise<Response | null> => {
      const res = await fetcher(false);
      if (res.status !== FOOTBALL_CREDIT_CONFIRMATION_STATUS) return res;

      const data = await res
        .clone()
        .json()
        .catch(() => null);
      if (!isFootballCreditConfirmationPayload(data)) return res;

      const choice = await new Promise<DialogChoice>((resolve) => {
        resolverRef.current = resolve;
        setOpen(true);
      });

      if (choice === "confirm") {
        return fetcher(true);
      }
      if (choice === "store") {
        router.push("/store");
      }
      return null;
    },
    [router],
  );

  return (
    <AssetPaymentContext.Provider value={{ runWithAssetPayment }}>
      {children}
      <Modal open={open} onClose={() => settle("cancel")} className="max-w-md">
        <div className="space-y-5 text-right">
          <div className="space-y-3 text-sm leading-7 text-white/80">
            {FOOTBALL_CREDIT_DIALOG.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button fullWidth onClick={() => settle("confirm")}>
              {FOOTBALL_CREDIT_DIALOG.confirmLabel}
            </Button>
            <Button fullWidth variant="secondary" onClick={() => settle("store")}>
              {FOOTBALL_CREDIT_DIALOG.storeLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </AssetPaymentContext.Provider>
  );
}

export function useAssetPayment(): AssetPaymentContextValue {
  const ctx = useContext(AssetPaymentContext);
  if (!ctx) throw new Error("useAssetPayment must be used within AssetPaymentProvider");
  return ctx;
}
