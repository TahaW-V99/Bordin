export type SocialSharePlatform = "telegram" | "whatsapp" | "bale" | "instagram";

export function buildSocialShareUrl(
  platform: SocialSharePlatform,
  options: { message: string; url: string },
) {
  const fullText = `${options.message}\n${options.url}`;
  const encodedText = encodeURIComponent(fullText);
  const encodedUrl = encodeURIComponent(options.url);
  const encodedMessage = encodeURIComponent(options.message);

  switch (platform) {
    case "telegram":
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
    case "whatsapp":
      return `https://api.whatsapp.com/send?text=${encodedText}`;
    case "bale":
      return `https://ble.ir/share/url?url=${encodedUrl}&text=${encodedMessage}`;
    case "instagram":
      return null;
    default:
      return null;
  }
}

export async function shareViaSocialPlatform(
  platform: SocialSharePlatform,
  options: { message: string; url: string },
) {
  const fullText = `${options.message}\n${options.url}`;

  try {
    await navigator.clipboard.writeText(fullText);
  } catch {
    // clipboard may fail in insecure contexts
  }

  if (platform === "instagram") {
    return { copied: true, opened: false, platform };
  }

  const shareUrl = buildSocialShareUrl(platform, options);
  if (!shareUrl) {
    return { copied: true, opened: false, platform };
  }

  window.open(shareUrl, "_blank", "noopener,noreferrer");
  return { copied: true, opened: true, platform };
}
