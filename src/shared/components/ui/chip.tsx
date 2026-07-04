import { cn } from "@/shared/lib/cn";
import { ButtonHTMLAttributes } from "react";

export function Chip({
  className,
  active,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
        active
          ? "bg-bordin-orange text-black"
          : "bg-white/5 text-white/70 hover:bg-white/10",
        className,
      )}
      {...props}
    />
  );
}
