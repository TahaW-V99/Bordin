import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getWalletDetails } from "@/server/services/store-service";

export const GET = withAuth(async (userId) => {
  const wallet = await getWalletDetails(userId);
  return jsonOk(wallet);
});
