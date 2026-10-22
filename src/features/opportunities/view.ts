// Presentation decisions for opportunities (M07), kept out of JSX: the card's verdict line (v1.8
// `Marketplace.jsx:90`) and the list URL with its filters. Pure.
import type { MatchResult } from "@/domain/matching";
import { type ListOpportunitiesQuery, listOpportunitiesQuery } from "@/lib/validation/applications";

export type OpportunityVerdict =
  { kind: "eligible" } | { kind: "qualifications"; count: number } | { kind: "availability" };

/** «Cumples requisitos y disponibilidad» · «{n} requisitos obligatorios pendientes» · «Fechas insuficientes». */
export function opportunityVerdict(match: MatchResult): OpportunityVerdict {
  if (match.eligible) return { kind: "eligible" };
  const count = match.blockers.filter(
    (b) => b.code !== "NOT_AVAILABLE" && b.code !== "PARTIAL_AVAILABILITY",
  ).length;
  return count > 0 ? { kind: "qualifications", count } : { kind: "availability" };
}

export type OpportunityFilters = Pick<ListOpportunitiesQuery, "urgency" | "eligible" | "q"> & {
  page: number;
};

type Param = string | string[] | undefined;

/** The list's URL state, parsed leniently (anything invalid = no filter, page 1; pages up to 500). */
export function parseOpportunityFilters(search: Record<string, Param>): OpportunityFilters {
  const parsed = listOpportunitiesQuery.safeParse({
    urgency: search.urgency,
    eligible: search.eligible,
    q: typeof search.q === "string" ? search.q : undefined,
  });
  const query = parsed.success ? parsed.data : listOpportunitiesQuery.parse({});
  const pageParam = Number(search.page);
  const page = Number.isInteger(pageParam) && pageParam > 1 ? Math.min(pageParam, 500) : 1;
  return { urgency: query.urgency, eligible: query.eligible, q: query.q, page };
}

export const OPPORTUNITIES_PATH = "/app/professional/opportunities";
/** v2-20 «Ofertas en la red» of an organization. */
export const NETWORK_PATH = "/app/organization/network";

/** The list URL for these filters (page 1 and empty values are left out). */
export function opportunitiesHref(
  filters: OpportunityFilters,
  patch: Partial<OpportunityFilters> = {},
  base: string = OPPORTUNITIES_PATH,
) {
  const next = { ...filters, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.urgency) params.set("urgency", next.urgency);
  if (next.eligible) params.set("eligible", next.eligible);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}`;
}

/** v1.8 pills «Todas · Compatibles · Planificado · Urgente · AOG»; «Compatibles» is professional-only. */
export const OPPORTUNITY_PILLS = [
  { key: "all", patch: { urgency: undefined, eligible: undefined } },
  { key: "eligible", patch: { urgency: undefined, eligible: "1" as const } },
  { key: "planned", patch: { urgency: "planned" as const, eligible: undefined } },
  { key: "urgent", patch: { urgency: "urgent" as const, eligible: undefined } },
  { key: "aog", patch: { urgency: "aog" as const, eligible: undefined } },
] as const;
export const NETWORK_PILLS = OPPORTUNITY_PILLS.filter((pill) => pill.key !== "eligible");

/** The pill of these filters. */
export const activePill = (filters: Pick<OpportunityFilters, "eligible" | "urgency">) =>
  filters.eligible ? "eligible" : (filters.urgency ?? "all");
