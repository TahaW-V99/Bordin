import { withAuth, jsonOk } from "@/shared/lib/api-route";
import {
  listTeamCompetitionsForUser,
  type TeamCompetitionUserFilter,
} from "@/server/services/team-competition-user-service";

export const GET = withAuth(async (userId, request) => {
  const raw = new URL(request.url).searchParams.get("filter") ?? "upcoming";
  const filter: TeamCompetitionUserFilter =
    raw === "active" || raw === "finished" ? raw : raw === "joined" ? "active" : "upcoming";
  const teamCompetitions = await listTeamCompetitionsForUser(userId, filter);
  return jsonOk({ teamCompetitions });
});
