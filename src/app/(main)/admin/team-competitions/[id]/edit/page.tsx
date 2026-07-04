import { TeamCompetitionBuilder } from "@/features/admin/components/team-competition-builder";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminEditTeamCompetitionPage({ params }: PageProps) {
  const { id } = await params;
  return <TeamCompetitionBuilder competitionId={id} />;
}
