import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES } from "@/features/public/data/site-config";
import { getPublicSiteOrigin } from "@/features/public/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/profile", "/home", "/chat", "/messages"],
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
