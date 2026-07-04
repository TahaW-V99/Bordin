"use client";

import Image from "next/image";
import { cn } from "@/shared/lib/cn";

const WHISTLE_SRC = "/images/referee-whistle.png";

export function RefereeWhistleIcon({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <Image
      src={WHISTLE_SRC}
      alt=""
      width={24}
      height={24}
      aria-hidden
      className={cn(
        "h-6 w-6 object-contain",
        animated && "whistle-blow",
        className,
      )}
    />
  );
}
