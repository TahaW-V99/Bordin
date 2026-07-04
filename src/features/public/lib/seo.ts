import type { Metadata } from "next";
import { PUBLIC_SITE } from "@/features/public/data/site-config";
import { resolvePublicAppOrigin } from "@/shared/lib/environment";

export function getPublicSiteOrigin(): string {
  return resolvePublicAppOrigin();
}

type PageSeoInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
};

export function buildPublicPageMetadata({
  title,
  description,
  path,
  keywords = [],
}: PageSeoInput): Metadata {
  const origin = getPublicSiteOrigin();
  const url = `${origin}${path === "/" ? "" : path}`;
  const fullTitle = path === "/" ? `${PUBLIC_SITE.name} | ${title}` : `${title} | ${PUBLIC_SITE.name}`;

  return {
    title: fullTitle,
    description,
    keywords: [
      "پیش‌بینی فوتبال",
      "بُردین",
      "رقابت فوتبال",
      "کنداکتور",
      "لیدربورد",
      ...keywords,
    ],
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "fa_IR",
      url,
      siteName: PUBLIC_SITE.name,
      title: fullTitle,
      description,
      images: [{ url: `${origin}/logo/logo.png`, width: 512, height: 512, alt: PUBLIC_SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [`${origin}/logo/logo.png`],
    },
    robots: { index: true, follow: true },
  };
}
