import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { renameTeam } from "@/server/services/team-service";

const schema = z.object({ name: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (userId, req) => {
    const { name } = schema.parse(await req.json());
    const team = await renameTeam(userId, id, name);
    return jsonOk({ team });
  })(request);
}
