import { Suspense } from "react";
import { TeamCompetitionDetail } from "@/features/competitions/components/team-competition-detail";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default async function TeamCompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<Skeleton className="mx-4 h-48" />}>
      <TeamCompetitionDetail competitionId={id} />
    </Suspense>
  );
}
