import Link from "next/link";
import { Badge } from "@/shared/components/ui/badge";
import { formatPersianNumber } from "@/shared/lib/dates";

export function CompetitionCard({
  href,
  title,
  subtitle,
  fee,
  status,
  mode,
}: {
  href: string;
  title: string;
  subtitle?: string;
  fee?: number;
  status?: string;
  mode?: string;
}) {
  const statusVariant =
    status === "joined" ? "green" : status === "finished" ? "default" : "orange";

  return (
    <Link
      href={href}
      className="block min-w-[260px] shrink-0 rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-4 transition hover:border-bordin-orange/30"
    >
      <div className="mb-2 flex gap-2">
        {mode === "LEGEND" ? <Badge variant="purple">افسانه</Badge> : null}
        {status ? <Badge variant={statusVariant}>{status === "joined" ? "عضو" : status === "finished" ? "پایان" : "جدید"}</Badge> : null}
      </div>
      <p className="font-bold leading-tight">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-white/50">{subtitle}</p> : null}
      {fee !== undefined ? (
        <p className="mt-2 text-sm text-bordin-orange">{formatPersianNumber(fee)} سکه</p>
      ) : null}
    </Link>
  );
}
