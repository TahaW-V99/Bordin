import { cn } from "@/shared/lib/cn";
import { getAvatarSrc } from "@/shared/constants/settings";

type ProfileAvatarProps = {
  avatarUrl?: string | null;
  displayName?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

export function ProfileAvatar({
  avatarUrl,
  displayName,
  size = "md",
  className,
}: ProfileAvatarProps) {
  const src = getAvatarSrc(avatarUrl);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5",
        sizes[size],
        className,
      )}
    >
      <img
        src={src}
        alt={displayName ? `آواتار ${displayName}` : "آواتار پروفایل"}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
