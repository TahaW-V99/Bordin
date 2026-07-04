import { cn } from "@/shared/lib/cn";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label;
    return (
      <div className="space-y-1.5">
        {label ? (
          <label htmlFor={inputId} className="block text-sm font-medium text-white/80">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 outline-none transition focus:border-bordin-orange/60 focus:ring-2 focus:ring-bordin-orange/20",
            error && "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20",
            className,
          )}
          {...props}
        />
        {error ? <p className="text-xs text-red-400">{error}</p> : null}
        {hint && !error ? <p className="text-xs text-white/40">{hint}</p> : null}
      </div>
    );
  },
);

Input.displayName = "Input";
