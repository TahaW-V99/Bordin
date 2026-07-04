import { CupDetail } from "@/features/competitions/components/cup-detail";

export default async function CupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CupDetail cupId={id} />;
}
