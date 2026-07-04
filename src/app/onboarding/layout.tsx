import { redirect, unstable_rethrow } from "next/navigation";
import { getSession } from "@/shared/lib/auth";
import { getUserOnboardingStatus } from "@/server/services/auth-service";
import { lookupSessionUser } from "@/server/ensure-db-user";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  try {
    const user = await lookupSessionUser(session);
    if (!user) {
      redirect("/api/auth/logout?redirect=/login");
    }

    const onboardingComplete = await getUserOnboardingStatus(user.id, session.phone);
    if (onboardingComplete) {
      redirect("/home");
    }
  } catch (error) {
    unstable_rethrow(error);
    console.error("[onboarding-layout] failed to resolve session user", {
      phone: session.phone,
      error: error instanceof Error ? error.message : error,
    });
    redirect("/api/auth/logout?redirect=/login");
  }

  return children;
}
