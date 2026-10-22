// Presentation decisions for opportunities (M07), kept out of JSX: the card's verdict line (v1.8
// `Marketplace.jsx:90`) and the list URL with its filters. Pure.
import type { MatchResult } from "@/domain/matching";
import type { ListOpportunitiesQuery } from "@/lib/validation/applications";

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

/** The list URL for these filters (page 1 and empty values are left out). */
export function opportunitiesHref(
  filters: OpportunityFilters,
  patch: Partial<OpportunityFilters> = {},
) {
  const next = { ...filters, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.urgency) params.set("urgency", next.urgency);
  if (next.eligible) params.set("eligible", next.eligible);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return `/app/professional/opportunities${query ? `?${query}` : ""}`;
}
