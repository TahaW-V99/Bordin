"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import {
  ENERGY_DEPLETED_EVENT,
  dispatchEnergyDepleted,
  dispatchEnergyUpdated,
  isEnergyInsufficientResponse,
} from "@/shared/lib/energy-client";
import type { EnergyInsufficientMeta } from "@/shared/types/energy";

export function EnergyDepletedHost() {
  const router = useRouter();
  const [meta, setMeta] = useState<EnergyInsufficientMeta | null>(null);

  useEffect(() => {
    const onDepleted = (event: Event) => {
      const detail = (event as CustomEvent<EnergyInsufficientMeta>).detail;
      if (detail) setMeta(detail);
    };
    window.addEventListener(ENERGY_DEPLETED_EVENT, onDepleted);
    return () => window.removeEventListener(ENERGY_DEPLETED_EVENT, onDepleted);
  }, []);

  // Catch ENERGY_INSUFFICIENT from any API response without wiring every feature.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      try {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json") && !response.ok) {
          const data = await response.clone().json();
          if (isEnergyInsufficientResponse(data)) {
            dispatchEnergyDepleted(data.energy);
          }
        } else if (response.ok) {
          const method =
            typeof args[0] === "string"
              ? (args[1]?.method ?? "GET")
              : ((args[0] as Request).method ?? "GET");
          if (method !== "GET" && method !== "HEAD") {
            dispatchEnergyUpdated();
          }
        }
      } catch {
        // ignore parse errors
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const close = useCallback(() => setMeta(null), []);

  if (!meta) return null;

  const inviteCase =
    meta.inviteRecoveryEnabled &&
    meta.successfulInviteCount < meta.inviteRecoveryCap;

  return (
    <Modal open onClose={close} className="max-w-md">
      <button
        type="button"
        aria-label="بستن"
        onClick={close}
        className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="pe-8 text-center text-base font-bold text-[#ffd54a]">
        سطح انرژی فوتبالیت تموم شده!
      </h2>

      {inviteCase ? (
        <p className="mt-4 text-center text-sm leading-7 text-white/75">
          اگر نمیخوایی ۶ ساعت منتظر بمونی که نصف انرژیت پُر بشه، ۱۰ نفر از دوستات رو دعوت کن
          <br />
          (هر دعوت موفق ۱۰ درصد انرژیت رو پُر میکنه)
          <br />
          یا از فروشگاه انرژی بخر.
        </p>
      ) : (
        <p className="mt-4 text-center text-sm leading-7 text-white/75">
          اگر نمیخوایی ۶ ساعت منتظر بمونی که نصف انرژیت پُر بشه، از فروشگاه انرژی بخر.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Button
          fullWidth
          onClick={() => {
            close();
            router.push("/store");
          }}
        >
          فروشگاه
        </Button>

        {inviteCase ? (
          <Button
            fullWidth
            variant="secondary"
            onClick={() => {
              close();
              router.push("/invite");
            }}
          >
            دعوت از دوستان
          </Button>
        ) : (
          <Button fullWidth variant="secondary" onClick={close}>
            متوجه شدم
          </Button>
        )}
      </div>
    </Modal>
  );
}
