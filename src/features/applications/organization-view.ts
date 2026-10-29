// URL state of the organization's «Candidaturas» (v2-05, v1.8 `Workflow.jsx:53-56`): the requirement
// filter, the status tab and the page. Pure; parsed leniently (anything unknown = the default).
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/domain/applications";
import { type StatusCounts, sumCounts } from "@/domain/coverage";
import { ORGANIZATION_APPLICATIONS_PAGE_SIZE } from "@/lib/validation/applications";

export const ORGANIZATION_APPLICATIONS_PATH = "/app/organization/applications";

export interface OrganizationApplicationsFilters {
  requirementId: string | null;
  status: ApplicationStatus | null;
  page: number;
}

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The list schema caps `offset` at 10 000. */
const MAX_PAGE = Math.floor(10000 / ORGANIZATION_APPLICATIONS_PAGE_SIZE) + 1;

export function parseOrganizationApplicationsFilters(
  params: Record<string, Param>,
): OrganizationApplicationsFilters {
  const requirementId = first(params.requirementId) ?? "";
  const status = first(params.status);
  const page = Number(first(params.page));
  return {
    requirementId: UUID.test(requirementId) ? requirementId.toLowerCase() : null,
    status: APPLICATION_STATUSES.find((s) => s === status) ?? null,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
  };
}

/** The list URL with some filters replaced (a new tab or requirement starts on page 1). */
export function organizationApplicationsHref(
  filters: OrganizationApplicationsFilters,
  patch: Partial<OrganizationApplicationsFilters> = {},
) {
  const next = { ...filters, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.requirementId) params.set("requirementId", next.requirementId);
  if (next.status) params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return `${ORGANIZATION_APPLICATIONS_PATH}${query ? `?${query}` : ""}`;
}

export const applicationsPageCount = (total: number) =>
  Math.max(1, Math.ceil(total / ORGANIZATION_APPLICATIONS_PAGE_SIZE));

export const applicationsPageOffset = (page: number) =>
  (page - 1) * ORGANIZATION_APPLICATIONS_PAGE_SIZE;

/** «Todas ({n})»: every application of the organization, or of the selected requirement. */
export function tabCounts(
  rows: readonly { requirementId: string; counts: StatusCounts }[],
  requirementId: string | null,
): StatusCounts {
  return sumCounts(requirementId ? rows.filter((r) => r.requirementId === requirementId) : rows);
}

export const countAll = (counts: StatusCounts) =>
  Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);
