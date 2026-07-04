import { TeamCompetitionRegisterPage } from "@/features/competitions/components/team-competition-register-page";

type Props = { params: Promise<{ id: string }> };

export default async function TeamCompetitionRegisterRoute({ params }: Props) {
  const { id } = await params;
  return <TeamCompetitionRegisterPage competitionId={id} />;
}
