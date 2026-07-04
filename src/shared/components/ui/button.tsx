import { cn } from "@/shared/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const variants = {
      primary: "bg-bordin-orange text-black hover:bg-bordin-orange/90 shadow-glow-orange",
      secondary: "bg-white/10 text-white hover:bg-white/15 border border-white/10",
      ghost: "bg-transparent text-white hover:bg-white/5",
      outline: "border border-bordin-orange/50 text-bordin-orange hover:bg-bordin-orange/10",
      danger: "bg-red-600 text-white hover:bg-red-500",
    };

    const sizes = {
      sm: "h-9 px-3 text-sm rounded-lg",
      md: "h-11 px-5 text-sm rounded-xl",
      lg: "h-13 px-6 text-base rounded-xl",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
