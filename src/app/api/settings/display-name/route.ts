import { withAuth, jsonOk } from "@/shared/lib/api-route";
import {
  checkDisplayNameAvailability,
  updateDisplayName,
} from "@/server/services/settings-service";

export const GET = withAuth(async (userId, request) => {
  const { searchParams } = new URL(request.url);
  const displayName = searchParams.get("displayName");
  if (!displayName?.trim()) {
    return jsonOk({ error: "نام الزامی است" }, 400);
  }
  const result = await checkDisplayNameAvailability(userId, displayName);
  return jsonOk(result);
});

export const PATCH = withAuth(async (userId, request) => {
  const body = (await request.json()) as { displayName?: string };
  if (!body.displayName?.trim()) {
    return jsonOk({ error: "نام الزامی است" }, 400);
  }
  const result = await updateDisplayName(userId, body.displayName);
  return jsonOk({ success: true, ...result });
});
