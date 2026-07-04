"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { formatPersianNumber } from "@/shared/lib/dates";
import type { ChatActiveCompetitionCard } from "@/shared/types/chat";

function kindLabel(kind: ChatActiveCompetitionCard["kind"]) {
  if (kind === "cup") return "جام";
  if (kind === "tournament") return "تورنومنت";
  return "رقابت تیمی";
}

export function ChatCompetitionsPanel({
  competitions,
}: {
  competitions: ChatActiveCompetitionCard[];
}) {
  if (competitions.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-white/55">رقابت‌های فعال</p>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {competitions.map((item) => (
          <Link
            key={`${item.kind}-${item.id}`}
            href={item.href}
            className="block min-w-[220px] shrink-0 rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.04] to-transparent p-3 transition hover:border-bordin-orange/30"
          >
            <Badge variant="orange" className="mb-2">
              {kindLabel(item.kind)}
            </Badge>
            <p className="text-sm font-bold leading-snug">{item.titleFa}</p>
            {item.subtitleFa ? (
              <p className="mt-1 line-clamp-2 text-xs text-white/50">{item.subtitleFa}</p>
            ) : null}
            {item.entryFeeCoins != null ? (
              <p className="mt-2 text-xs text-bordin-orange">
                {item.kind === "team" ? (
                  <span className="inline-flex items-center gap-1" dir="ltr">
                    <span>{formatPersianNumber(item.entryFeeCoins)} سکه</span>
                    <Trophy className="h-3 w-3 shrink-0" aria-hidden />
                  </span>
                ) : (
                  <>{formatPersianNumber(item.entryFeeCoins)} سکه</>
                )}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
