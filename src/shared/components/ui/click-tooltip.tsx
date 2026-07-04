"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/lib/cn";

export function ClickTooltip({
  content,
  dismissMs,
  children,
  className,
  align = "center",
  placement = "auto",
}: {
  content: string;
  dismissMs: number;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
  placement?: "auto" | "above" | "below";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: "above" | "below";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const positionTooltip = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 224;
    const gap = 8;
    const preferBelow =
      placement === "below" ||
      (placement === "auto" && rect.top < 140);

    const top = preferBelow ? rect.bottom + gap : rect.top - gap;

    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (align === "start") left = rect.right - tooltipWidth;
    if (align === "end") left = rect.left;

    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

    setCoords({
      top,
      left,
      placement: preferBelow ? "below" : "above",
    });
  }, [align, placement]);

  const show = () => {
    setOpen(true);
    positionTooltip();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), dismissMs);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const onReposition = () => positionTooltip();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, positionTooltip]);

  const tooltip =
    open && coords
      ? createPortal(
          <span
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className={cn(
              "fixed z-[200] w-56 rounded-xl border border-white/10 bg-[#1a1a1a] p-3 text-xs leading-6 text-white/80 shadow-xl",
              coords.placement === "above" && "-translate-y-full",
            )}
          >
            {content}
          </span>,
          document.body,
        )
      : null;

  return (
    <span className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        className="inline-flex items-center justify-center text-white/45 transition hover:text-bordin-orange"
        aria-label="راهنما"
      >
        {children}
      </button>
      {tooltip}
    </span>
  );
}
