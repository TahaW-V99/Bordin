import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { claimMissionTierReward } from "@/server/services/mission-service";

const claimSchema = z.object({
  missionSlug: z.string().min(1),
  tierKey: z.string().min(1).optional(),
});

export const POST = withAuth(async (userId, request) => {
  const body = claimSchema.parse(await request.json());
  const result = await claimMissionTierReward(userId, body.missionSlug, body.tierKey);
  return jsonOk({ success: true, reward: result });
});
