"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { saveScrollPosition } from "@/shared/lib/public-profile-navigation";
import { cn } from "@/shared/lib/cn";

export function PublicProfileLink({
  slug,
  children,
  className,
  ariaLabel,
}: {
  slug?: string | null;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  if (!slug) {
    return <>{children}</>;
  }

  return (
    <Link
      href={`/showcase/${slug}`}
      scroll={false}
      aria-label={ariaLabel}
      className={cn("transition-opacity hover:opacity-90", className)}
      onClick={() => saveScrollPosition()}
    >
      {children}
    </Link>
  );
}
