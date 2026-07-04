import { cn } from "@/shared/lib/cn";
import { HTMLAttributes } from "react";

const variants = {
  default: "bg-white/10 text-white/80",
  orange: "bg-bordin-orange/15 text-bordin-orange border border-bordin-orange/30",
  green: "bg-bordin-green/15 text-bordin-green border border-bordin-green/30",
  purple: "bg-bordin-purple/15 text-bordin-purple border border-bordin-purple/30",
  blue: "bg-bordin-blue/10 text-bordin-blue border border-bordin-blue/20",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
