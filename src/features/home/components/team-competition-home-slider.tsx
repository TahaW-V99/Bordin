"use client";

import { useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TeamCompetitionCard } from "@/features/competitions/components/team-competition-card";
import { cn } from "@/shared/lib/cn";

type TeamCompetitionHomeSliderProps = {
  items: Array<Record<string, unknown>>;
};

export function TeamCompetitionHomeSlider({ items }: TeamCompetitionHomeSliderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollByCard = useCallback((direction: 1 | -1) => {
    const container = scrollRef.current;
    if (!container) return;

    const cards = Array.from(container.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement,
    );
    if (cards.length === 0) return;

    const containerRect = container.getBoundingClientRect();
    let activeIndex = 0;
    let bestOverlap = -1;

    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const overlap =
        Math.min(rect.right, containerRect.right) - Math.max(rect.left, containerRect.left);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        activeIndex = index;
      }
    });

    const targetIndex = Math.min(cards.length - 1, Math.max(0, activeIndex + direction));
    cards[targetIndex]?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, []);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="scrollbar-hide team-competition-home-scroll flex gap-3 overflow-x-auto pb-1"
      >
        {items.map((tc) => (
          <TeamCompetitionCard
            key={tc.id as string}
            data={tc as Parameters<typeof TeamCompetitionCard>[0]["data"]}
            variant="slider"
          />
        ))}
      </div>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="رقابت قبلی"
            onClick={() => scrollByCard(-1)}
            className={cn(
              "absolute top-1/2 end-1 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/80 p-1.5 text-white shadow-lg backdrop-blur-sm transition hover:border-bordin-orange/40 hover:text-bordin-orange md:flex",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="رقابت بعدی"
            onClick={() => scrollByCard(1)}
            className={cn(
              "absolute top-1/2 start-1 z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/80 p-1.5 text-white shadow-lg backdrop-blur-sm transition hover:border-bordin-orange/40 hover:text-bordin-orange md:flex",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  );
}
