import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getTeamDraft, saveTeamDraft } from "@/server/services/team-service";

export const GET = withAuth(async (userId) => {
  const draft = await getTeamDraft(userId);
  return jsonOk({ draft });
});

const schema = z.object({
  introCompleted: z.boolean().optional(),
  step: z.string().optional(),
  name: z.string().nullable().optional(),
  capacity: z.number().int().nullable().optional(),
  logoKey: z.number().int().nullable().optional(),
});

export const PUT = withAuth(async (userId, request) => {
  const body = schema.parse(await request.json());
  const draft = await saveTeamDraft(userId, body);
  return jsonOk({ draft });
});
