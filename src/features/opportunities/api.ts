import "server-only";
import type { ListOpportunitiesQuery } from "@/lib/validation/applications";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  NetworkOpportunityListResponse,
  NetworkOpportunityResponse,
  OpportunityListResponse,
  OpportunityResponse,
} from "@/types/api";

/** Published, current requirements with the caller's own eligibility (M07, D-12). */
export const listOpportunities = (query: Partial<Omit<ListOpportunitiesQuery, "id">>) =>
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

/** v2-20 «Ofertas en la red» for organization members: the same projection, no eligibility. */
export const listNetworkOpportunities = (
  query: Pick<ListOpportunitiesQuery, "offset" | "limit"> &
    Partial<Pick<ListOpportunitiesQuery, "urgency" | "q">>,
) =>
  invokeEdgeFunction<NetworkOpportunityListResponse>("opportunities", {
    query: {
      view: "network",
      offset: String(query.offset),
      limit: String(query.limit),
      ...(query.urgency ? { urgency: query.urgency } : {}),
      ...(query.q ? { q: query.q } : {}),
    },
  });

/** One published requirement of another organization (v2-20); 404 as `getOpportunity`. */
export const getNetworkOpportunity = (id: string) =>
  invokeEdgeFunction<NetworkOpportunityResponse>("opportunities", {
    query: { view: "network", id },
  });
