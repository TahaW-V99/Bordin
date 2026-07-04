import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { payFormationFee } from "@/server/services/team-service";

export const POST = withAuth(async (userId) => {
  const result = await payFormationFee(userId);
  return jsonOk(result);
});
