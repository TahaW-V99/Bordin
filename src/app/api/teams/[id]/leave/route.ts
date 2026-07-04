import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { leaveTeam } from "@/server/services/team-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (userId) => {
    const result = await leaveTeam(userId, id);
    return jsonOk(result);
  })(request);
}
