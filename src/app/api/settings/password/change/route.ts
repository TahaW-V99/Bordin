import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { changePasswordWithOtp } from "@/server/services/settings-service";

export const POST = withAuth(async (userId, request) => {
  const body = (await request.json()) as { code?: string; password?: string };
  if (!body.code || !body.password) {
    return jsonOk({ error: "کد تأیید و رمز جدید الزامی است" }, 400);
  }

  await changePasswordWithOtp(userId, body.code, body.password);
  return jsonOk({ success: true });
});
