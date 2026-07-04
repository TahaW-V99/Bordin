"use client";

import type { CSSProperties } from "react";
import { X } from "lucide-react";
import { medalImageUrl, MEDAL_CATALOG_BY_SLUG } from "@/shared/constants/medals";

const PREVIEW_WIDTH_PX = 337;
const PREVIEW_HEIGHT_PX = 383;
const MEDAL_IMG_WIDTH_PX = 280;
const MEDAL_IMG_HEIGHT_PX = 303;

export function MissionMedalPreviewModal({
  medalSlug,
  medalTitleFa,
  onClose,
}: {
  medalSlug: string;
  medalTitleFa: string | null;
  onClose: () => void;
}) {
  const catalog = MEDAL_CATALOG_BY_SLUG[medalSlug];
  const glowColor = catalog?.glowColor ?? "#ffd54a";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative overflow-hidden rounded-2xl border border-[#f5b942]/35 bg-gradient-to-b from-[#1a1408] to-[#0a0a0a] shadow-[0_0_40px_rgba(245,185,66,0.2)]"
        style={{ width: PREVIEW_WIDTH_PX, height: PREVIEW_HEIGHT_PX }}
        role="dialog"
        aria-modal="true"
        aria-label={medalTitleFa ?? "پیش‌نمایش مدال"}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/70 transition hover:border-white/30 hover:text-white"
          aria-label="بستن"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex h-full flex-col items-center justify-center px-6 pb-8 pt-12">
          <div
            className="mission-medal-preview-glow relative flex flex-1 items-center justify-center"
            style={{ "--medal-glow-color": glowColor } as CSSProperties}
          >
            <div className="mission-medal-preview-rays pointer-events-none absolute inset-0" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={medalImageUrl(medalSlug)}
              alt={medalTitleFa ?? "مدال"}
              width={MEDAL_IMG_WIDTH_PX}
              height={MEDAL_IMG_HEIGHT_PX}
              draggable={false}
              className="mission-medal-preview-img relative z-10 object-contain object-center"
            />
          </div>
          {medalTitleFa ? (
            <p className="mt-4 text-center text-sm font-semibold text-white/85">{medalTitleFa}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
