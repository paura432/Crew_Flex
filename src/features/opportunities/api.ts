import "server-only";
import type { ListOpportunitiesQuery } from "@/lib/validation/applications";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { OpportunityListResponse, OpportunityResponse } from "@/types/api";

/** Published, current requirements with the caller's own eligibility (M07, D-12). */
export const listOpportunities = (query: Partial<ListOpportunitiesQuery>) =>
  invokeEdgeFunction<OpportunityListResponse>("opportunities", {
    query: Object.fromEntries(
      Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== "")
        .map(([key, value]) => [key, String(value)]),
    ),
  });

/** One published requirement; 404 when it is not published (any more) or does not exist. */
export const getOpportunity = (id: string) =>
  invokeEdgeFunction<OpportunityResponse>("opportunities", { query: { id } });
