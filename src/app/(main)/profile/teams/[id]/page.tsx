import { TeamDetailPage } from "@/features/teams/components/team-detail-page";

type Props = { params: Promise<{ id: string }> };

export default async function ProfileTeamDetailRoute({ params }: Props) {
  const { id } = await params;
  return <TeamDetailPage teamId={id} />;
}
