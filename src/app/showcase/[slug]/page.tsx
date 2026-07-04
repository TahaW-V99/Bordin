import { notFound } from "next/navigation";
import { PublicProfilePage } from "@/features/profile/components/public-profile-page";
import { getPublicProfile } from "@/server/services/profile-service";

export default async function ShowcaseRoutePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);

  if (!profile) {
    notFound();
  }

  return <PublicProfilePage profile={profile} slug={slug} />;
}
