import { isExpired, type WorkRequirement } from "@/domain/work-requirement";

/** Open and not yet ended at `now` (V1.8: expired or closed needs are never «current»). */
export const currentRequirements = (requirements: WorkRequirement[], now: number) =>
  requirements.filter((r) => r.status === "open" && !isExpired(r, now));

/**
 * The dashboard's short list: current requirements first (in the order given, soonest first),
 * then the rest of the organization's list in its own order, without repeats. The full list stays
 * on the requirements page.
 */
export function dashboardRequirements(
  all: WorkRequirement[],
  current: WorkRequirement[],
  limit = 5,
): WorkRequirement[] {
  const ids = new Set(current.map((r) => r.id));
  return [...current, ...all.filter((r) => !ids.has(r.id))].slice(0, limit);
}

/**
 * «Necesidades abiertas» value: the current count, or «{limit}+» when the filtered request came back
 * full (more may exist beyond the page).
 */
export function openRequirementsValue(current: number, returned: number, limit: number): string {
  return returned >= limit ? `${limit}+` : String(current);
}
