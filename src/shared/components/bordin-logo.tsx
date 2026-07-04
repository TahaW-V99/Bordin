import { cn } from "@/shared/lib/cn";

type BordinLogoProps = {
  size?: number;
  className?: string;
};

/**
 * Official Bordin logo.
 * To update: replace either file (no code change needed):
 *   - public/logo/bordin-logo.png  (recommended)
 *   - public/logo/logo.svg
 */
export function BordinLogo({ size = 72, className }: BordinLogoProps) {
  return (
    <picture>
      <source srcSet="/logo/bordin-logo.png" type="image/png" />
      <img
        src="/logo/bordin-logo.png"
        alt="لوگوی بُردین"
        width={size}
        height={size}
        className={cn("object-contain", className)}
        decoding="async"
      />
    </picture>
  );
}
