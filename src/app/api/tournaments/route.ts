import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listTournaments } from "@/server/services/competition-service";

export const GET = withAuth(async (userId, request) => {
  const filter = new URL(request.url).searchParams.get("filter") ?? "upcoming";
  const tournaments = await listTournaments(userId, filter as "upcoming" | "joined" | "finished");
  return jsonOk({ tournaments });
});
