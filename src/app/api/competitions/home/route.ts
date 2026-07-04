import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getHomeSliders } from "@/server/services/competition-service";

export const GET = withAuth(async (userId) => {
  const sliders = await getHomeSliders(userId);
  return jsonOk(sliders);
});
