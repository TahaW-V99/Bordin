import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { purchaseTeamLogo } from "@/server/services/team-service";

const schema = z.object({ logoKey: z.number().int().min(1).max(10) });

export const POST = withAuth(async (userId, request) => {
  const { logoKey } = schema.parse(await request.json());
  const result = await purchaseTeamLogo(userId, logoKey);
  return jsonOk(result);
});
