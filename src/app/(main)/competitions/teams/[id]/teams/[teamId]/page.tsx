import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string; teamId: string }> };

/** Legacy competition team profile URL — unified to public team showcase. */
export default async function LegacyCompetitionTeamProfileRoute({ params }: Props) {
  const { teamId } = await params;
  redirect(`/showcase/team/${teamId}`);
}
