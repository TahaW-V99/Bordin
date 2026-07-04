import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { clearSession, getSession } from "@/shared/lib/auth";
import { completeOnboarding } from "@/server/services/auth-service";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { reconcileSessionUser } from "@/server/ensure-db-user";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await reconcileSessionUser(session);

    if (!user) {
      await clearSession();
      return NextResponse.json(
        { error: "حساب کاربری یافت نشد. لطفاً دوباره وارد شوید." },
        { status: 401 },
      );
    }

    await completeOnboarding(user.id, session.phone);

    revalidatePath("/home");
    revalidatePath("/onboarding");

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error, "خطا در تکمیل آشنایی") },
      { status: 400 },
    );
  }
}
