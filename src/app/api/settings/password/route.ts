import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { setInitialPassword } from "@/server/services/settings-service";

export const POST = withAuth(async (userId, request) => {
  const body = (await request.json()) as { password?: string };
  if (!body.password) {
    return jsonOk({ error: "رمز عبور الزامی است" }, 400);
  }
  await setInitialPassword(userId, body.password);
  return jsonOk({ success: true });
});
