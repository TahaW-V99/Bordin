import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listCups } from "@/server/services/competition-service";

export const GET = withAuth(async (userId, request) => {
  const filter = new URL(request.url).searchParams.get("filter") ?? "upcoming";
  const cups = await listCups(userId, filter as "upcoming" | "joined" | "finished");
  return jsonOk({ cups });
});
