"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/shared/components/layout/page-header";
import { Button } from "@/shared/components/ui/button";
import { useToast } from "@/shared/components/ui/toast";
import { formatPersianNumber } from "@/shared/lib/dates";
import {
  INVITE_HEADLINE_FA,
  INVITE_SHARE_SECTION_TITLE_FA,
  INVITE_SUCCESS_TOAST_FA,
  INVITE_UNLIMITED_REWARD_PROMO_BANNER_FA,
  INVITE_UNLIMITED_REWARD_PROMO_DEADLINE_FA,
  buildInviteShareLoginUrl,
  buildInviteShareMessage,
  isInviteUnlimitedRewardPromoActive,
} from "@/shared/constants/invite";
import { Copy, Share2, UserPlus } from "lucide-react";
import { Modal } from "@/shared/components/ui/modal";
import { shareViaSocialPlatform, type SocialSharePlatform } from "@/shared/lib/social-share";

type InviteInfo = {
  inviteCode: string;
  inviteLink: string;
  shareText: string;
  inviteCount: number;
  maxInvites: number;
  coinReward: number;
  xpReward: number;
};

function isLocalOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

/** Share links use the Cloudflare mirror on production (not localhost). */
function normalizeInviteInfo(info: InviteInfo): InviteInfo {
  if (!info.inviteCode) return info;
  if (typeof window !== "undefined" && isLocalOrigin(window.location.origin)) return info;
  const inviteLink = buildInviteShareLoginUrl(info.inviteCode);
  return {
    ...info,
    inviteLink,
    shareText: buildInviteShareMessage(inviteLink),
  };
}

const SHARE_PLATFORMS = [
  { id: "telegram", label: "تلگرام" },
  { id: "whatsapp", label: "واتساپ" },
  { id: "bale", label: "بله" },
  { id: "instagram", label: "اینستاگرام" },
] as const;

export function InvitePage() {
  const { toast } = useToast();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const unlimitedPromoActive = isInviteUnlimitedRewardPromoActive();

  useEffect(() => {
    fetch("/api/invite")
      .then((r) => r.json())
      .then((data) => setInfo(normalizeInviteInfo(data as InviteInfo)));
  }, []);

  const copyText = useCallback(
    async (text: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        toast(INVITE_SUCCESS_TOAST_FA, "success");
      } catch {
        toast("کپی انجام نشد", "error");
      }
    },
    [toast],
  );

  const shareNative = useCallback(async () => {
    if (!info?.shareText) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "دعوت به بُردین",
          text: info.shareText,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    setShareOpen(true);
  }, [info?.shareText]);

  const shareToPlatform = async (platform: SocialSharePlatform) => {
    if (!info) return;

    const message = info.shareText.replace(info.inviteLink, "").trim();
    const result = await shareViaSocialPlatform(platform, {
      message,
      url: info.inviteLink,
    });

    setShareOpen(false);

    if (platform === "instagram") {
      toast(
        "متن دعوت کپی شد. اینستاگرام امکان اشتراک مستقیم ندارد — متن را در دایرکت یا استوری پیست کنید.",
        "success",
      );
      return;
    }

    if (result.copied) {
      toast(INVITE_SUCCESS_TOAST_FA, "success");
    }
  };

  return (
    <>
      <PageHeader title="دعوت از دوستان" />
      <div className="space-y-6 px-4 py-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bordin-purple/15">
          <UserPlus className="h-8 w-8 text-bordin-purple" />
        </div>

        <p className="text-center text-sm leading-7 text-white/75">{INVITE_HEADLINE_FA}</p>

        {unlimitedPromoActive ? (
          <section className="rounded-2xl border border-yellow-400/40 bg-yellow-500/15 p-4">
            <p className="text-sm leading-7 text-yellow-100">
              {INVITE_UNLIMITED_REWARD_PROMO_BANNER_FA}
            </p>
          </section>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-center text-xs text-white/45">کد دعوت شما</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <p className="font-mono text-xl font-bold tracking-wide" dir="ltr">
              {info?.inviteCode ?? "—"}
            </p>
            <button
              type="button"
              aria-label="کپی کد دعوت"
              onClick={() => void copyText(info?.inviteCode ?? "")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
          <p className="text-sm font-medium text-white/80">{INVITE_SHARE_SECTION_TITLE_FA}</p>
          <div className="flex gap-2">
            <Button fullWidth variant="primary" onClick={() => void shareNative()}>
              <Share2 className="h-4 w-4" />
              اشتراک‌گذاری
            </Button>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => void copyText(info?.shareText ?? "")}
            >
              <Copy className="h-4 w-4" />
              کپی متن دعوت
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-xs text-white/45">دعوت‌های موفق شما</p>
          <p className="mt-2 text-2xl font-bold text-bordin-orange">
            {formatPersianNumber(info?.inviteCount ?? 0)}
          </p>
          <p className="mt-1 text-xs text-white/50">
            هر دعوت موفق: {formatPersianNumber(info?.coinReward ?? 50)} سکه و{" "}
            {formatPersianNumber(info?.xpReward ?? 100)} امتیاز
            <br />
            {unlimitedPromoActive
              ? `بدون محدودیت تا ${INVITE_UNLIMITED_REWARD_PROMO_DEADLINE_FA}`
              : `(سقف پاداش: ${formatPersianNumber(info?.maxInvites ?? 10)} نفر)`}
          </p>
        </section>
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)}>
        <p className="mb-4 text-center text-sm leading-7 text-white/70">
          متن دعوت کپی شد. یکی از پیام‌رسان‌ها را انتخاب کنید:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SHARE_PLATFORMS.map((p) => (
            <Button key={p.id} variant="outline" onClick={() => void shareToPlatform(p.id)}>
              {p.label}
            </Button>
          ))}
        </div>
      </Modal>
    </>
  );
}
