import { Coins } from "lucide-react";
import { formatPersianNumber } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/cn";

/** Cost display for team fee confirmations — not the Bordin wallet brand icon. */
export function CoinCostLabel({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Coins className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <span>
        {formatPersianNumber(amount)} سکه هزینه
      </span>
    </span>
  );
}
