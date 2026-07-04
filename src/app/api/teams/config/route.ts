import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getTeamCapacityConfig, getUnlockedTeamLogos } from "@/server/services/team-service";

export const GET = withAuth(async (userId) => {
  const [config, unlockedLogos] = await Promise.all([
    getTeamCapacityConfig(),
    getUnlockedTeamLogos(userId),
  ]);
  return jsonOk({ config, unlockedLogos });
});
