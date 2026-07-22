"use client";

import Image from "next/image";
import { Modal } from "@/shared/components/ui/modal";
import { Button } from "@/shared/components/ui/button";
import { formatPersianNumber } from "@/shared/lib/dates";
import { getTicketAssetByWalletField } from "@/shared/constants/tickets";
import type { WheelTicketReward } from "@/shared/constants/wheel";

type WheelTicketWinModalProps = {
  open: boolean;
  coins: number;
  tickets: WheelTicketReward[];
  onClose: () => void;
};

function buildWinMessage(coins: number, tickets: WheelTicketReward[]) {
  const ticketParts = tickets.map((ticket) => {
    const asset = getTicketAssetByWalletField(ticket.ticketType);
    const title = asset?.title ?? "بلیط";
    return `${formatPersianNumber(ticket.quantity)} ${title}`;
  });

  if (ticketParts.length === 0) {
    return `چه شانسی! ${formatPersianNumber(coins)} سکه برنده شدی!`;
  }

  return `چه شانسی! ${formatPersianNumber(coins)} سکه و ${ticketParts.join(" و ")} برنده شدی!`;
}

export function WheelTicketWinModal({
  open,
  coins,
  tickets,
  onClose,
}: WheelTicketWinModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      className="flex h-[412px] w-[340px] max-w-[340px] flex-col overflow-hidden p-4"
    >
      <p className="shrink-0 text-center text-sm font-semibold leading-6 text-white">
        {buildWinMessage(coins, tickets)}
      </p>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
        <div className="rounded-xl border border-bordin-green/30 bg-bordin-green/10 px-3 py-2 text-center">
          <span className="text-base font-bold text-bordin-green">
            +{formatPersianNumber(coins)} سکه
          </span>
        </div>

        {tickets.map((ticket) => {
          const asset = getTicketAssetByWalletField(ticket.ticketType);
          if (!asset) return null;
          return (
            <div
              key={`${ticket.ticketType}-${ticket.quantity}`}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2"
            >
              <Image
                src={asset.image}
                alt={asset.title}
                width={140}
                height={45}
                className="h-[45px] w-[140px] shrink-0 object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-white/70">{asset.title}</p>
                <p className="text-sm font-bold text-bordin-orange">
                  ×{formatPersianNumber(ticket.quantity)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Button className="mt-3 shrink-0" fullWidth onClick={onClose}>
        باشه
      </Button>
    </Modal>
  );
}
