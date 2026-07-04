"use client";

import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";

export function AppBackButton({
  fallbackHref,
  ariaLabel = "بازگشت",
}: {
  fallbackHref: string;
  ariaLabel?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white/70 transition hover:border-bordin-orange/40 hover:text-bordin-orange"
      aria-label={ariaLabel}
    >
      <ChevronRight className="h-5 w-5" />
    </button>
  );
}
