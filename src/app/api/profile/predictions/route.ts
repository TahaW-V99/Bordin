import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getUserPredictionResultsLast7Days } from "@/server/services/settlement-service";
import { parsePredictionResultFilter } from "@/shared/types/prediction-results";

export const GET = withAuth(async (userId, request) => {
  const { searchParams } = new URL(request.url);
  const filter = parsePredictionResultFilter(searchParams.get("filter"));
  const results = await getUserPredictionResultsLast7Days(userId, filter);
  return jsonOk({ results, filter });
});
