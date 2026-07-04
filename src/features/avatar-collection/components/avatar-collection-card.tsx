"use client";

import { ChevronLeft, Sparkles } from "lucide-react";
import { ProfileAvatar } from "@/shared/components/profile/profile-avatar";
import { cn } from "@/shared/lib/cn";

type AvatarCollectionCardProps = {
  avatarUrl: string | null;
  displayName: string;
  onOpen: () => void;
  className?: string;
};

export function AvatarCollectionCard({
  avatarUrl,
  displayName,
  onOpen,
  className,
}: AvatarCollectionCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl border border-bordin-orange/40",
        "bg-gradient-to-br from-[#141414] via-[#0f0f0f] to-[#1a1208]",
        "p-4 text-right shadow-[0_0_24px_rgba(255,122,0,0.12)] transition-all duration-300",
        "hover:border-bordin-orange/70 hover:shadow-[0_0_32px_rgba(255,122,0,0.22)]",
        "active:scale-[0.99]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,0,0.12),transparent_55%)] opacity-80 transition-opacity group-hover:opacity-100" />

      <div className="relative flex items-center gap-4">
        <div className="relative shrink-0">
          <ProfileAvatar avatarUrl={avatarUrl} displayName={displayName} size="lg" />
          <span className="absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full border border-bordin-orange/50 bg-black/80 text-bordin-orange shadow-glow-orange">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">مجموعه آواتار</p>
          <p className="mt-1 text-xs leading-5 text-white/50">
            هویت فوتبالی خود را از بین آواتارهای ویژه انتخاب کنید
          </p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-lg border border-bordin-orange/35 bg-bordin-orange/10 px-3 py-1.5 text-xs font-semibold text-bordin-orange transition group-hover:bg-bordin-orange/20">
            مشاهده مجموعه
            <ChevronLeft className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
