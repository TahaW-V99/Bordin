import { AdminTeamDetailPage } from "@/features/admin/components/admin-team-detail-page";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminTeamDetailRoute({ params }: PageProps) {
  const { id } = await params;
  return <AdminTeamDetailPage teamId={id} />;
}
