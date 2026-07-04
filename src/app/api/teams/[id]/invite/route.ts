import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { sendTeamInvite } from "@/server/services/team-service";

const schema = z.object({ inviteeId: z.string().min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (userId, req) => {
    const { inviteeId } = schema.parse(await req.json());
    const invite = await sendTeamInvite(userId, id, inviteeId);
    return jsonOk({ invite });
  })(request);
}
