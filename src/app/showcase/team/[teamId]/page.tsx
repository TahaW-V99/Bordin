import { notFound } from "next/navigation";
import { PublicTeamShowcasePage } from "@/features/teams/components/public-team-showcase-page";
import { getTeamShowcaseProfile } from "@/server/services/team-service";

export default async function TeamShowcaseRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ teamId: string }>;
  searchParams: Promise<{ from?: string; competitionId?: string }>;
}) {
  const { teamId } = await params;
  const { from, competitionId } = await searchParams;
  const team = await getTeamShowcaseProfile(teamId);

  if (!team) {
    notFound();
  }

  const backHref =
    from === "teams"
      ? "/profile/teams"
      : from === "competition-knockout" && competitionId
        ? `/competitions/teams/${competitionId}?tab=knockout`
        : from === "competition" && competitionId
          ? `/competitions/teams/${competitionId}?tab=ranking`
          : "/home";

  return (
    <PublicTeamShowcasePage
      team={team}
      backHref={backHref}
    />
  );
}
