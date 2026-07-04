import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { assignTeamMemberRole } from "@/server/services/team-service";

const schema = z.object({ role: z.enum(["CAPTAIN", "MEMBER"]) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  return withAuth(async (userId, req) => {
    const { role } = schema.parse(await req.json());
    const result = await assignTeamMemberRole(userId, id, memberId, role);
    return jsonOk(result);
  })(request);
}
