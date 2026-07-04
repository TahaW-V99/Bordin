import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getMembershipRequestPreview } from "@/server/services/team-service";

export const GET = withAuth(async (userId) => {
  const preview = await getMembershipRequestPreview(userId);
  return jsonOk({ preview });
});
