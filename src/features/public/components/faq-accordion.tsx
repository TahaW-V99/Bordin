"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/cn";

type FaqAccordionProps = {
  items: Array<{ id: string; question: string; answer: string }>;
  className?: string;
};

export function FaqAccordion({ items, className }: FaqAccordionProps) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item) => {
        const isOpen = openId === item.id;
        const panelId = `${baseId}-${item.id}`;
        const buttonId = `${panelId}-button`;

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right transition-colors hover:bg-white/[0.04]"
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <span className="font-semibold text-white">{item.question}</span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-bordin-orange transition-transform",
                  isOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                "grid transition-[grid-template-rows] duration-300 ease-out",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-7 text-white/65">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
