/** Normalize stored banner paths so uploads work after deploy (API serves runtime files). */
export function resolveTeamCompetitionBannerUrl(bannerUrl?: string | null): string | null {
  if (!bannerUrl) return null;

  const trimmed = bannerUrl.trim();
  if (!trimmed) return null;

  const fromPath = (pathname: string) => {
    const api = pathname.match(/^\/api\/team-competition-banners\/(.+)$/);
    if (api) return `/api/team-competition-banners/${api[1]}`;
    const legacy = pathname.match(/^\/uploads\/team-competition-banners\/(.+)$/);
    if (legacy) return `/api/team-competition-banners/${legacy[1]}`;
    return null;
  };

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const resolved = fromPath(new URL(trimmed).pathname);
      if (resolved) return resolved;
    } catch {
      return trimmed;
    }
  }

  const resolved = fromPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
  if (resolved) return resolved;

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
