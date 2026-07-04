import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { updateTeamLogo } from "@/server/services/team-service";

const schema = z.object({ logoKey: z.number().int().min(1).max(10) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (userId, req) => {
    const { logoKey } = schema.parse(await req.json());
    const team = await updateTeamLogo(userId, id, logoKey);
    return jsonOk({ team });
  })(request);
}
