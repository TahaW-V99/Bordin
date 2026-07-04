import { formatPersianNumber } from "@/shared/lib/dates";

export function StatBlock({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-center">
      <p className={`text-lg font-bold ${accent ?? "text-white"}`}>
        {typeof value === "number" ? formatPersianNumber(value) : value}
      </p>
      <p className="mt-0.5 text-xs text-white/50">{label}</p>
    </div>
  );
}
