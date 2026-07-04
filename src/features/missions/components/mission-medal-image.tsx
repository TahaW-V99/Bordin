"use client";

import { medalImageUrl } from "@/shared/constants/medals";
import { cn } from "@/shared/lib/cn";

export const MISSION_REWARD_MEDAL_PX = 64;
export const MISSION_CELEBRATION_MEDAL_PX = 160;

export function MissionMedalImage({
  slug,
  alt,
  size = MISSION_REWARD_MEDAL_PX,
  className,
  onClick,
}: {
  slug: string;
  alt: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={medalImageUrl(slug)}
      alt={alt}
      height={size}
      draggable={false}
      className={cn(
        "block w-auto max-w-none object-contain object-center [filter:contrast(1.06)_saturate(1.1)]",
        className,
      )}
      style={{ height: size, maxHeight: size }}
    />
  );

  const boxStyle = { width: size, height: size };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b942]/50"
        style={boxStyle}
        aria-label={`مشاهده ${alt}`}
      >
        {image}
      </button>
    );
  }

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden"
      style={boxStyle}
    >
      {image}
    </span>
  );
}
