import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES } from "@/features/public/data/site-config";
import { getPublicSiteOrigin } from "@/features/public/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getPublicSiteOrigin();
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
