import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { FilterPill } from "@/components/ui/FilterPill";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pager } from "@/components/ui/Pager";
import { StateMessage } from "@/components/ui/StateMessage";
import { APPLICATION_STATUSES } from "@/domain/applications";
import {
  getRequirementApplicationCounts,
  listOrganizationApplications,
} from "@/features/applications/api";
import { OrgApplicationCard } from "@/features/applications/components/OrgApplicationCard";
import {
  applicationsPageCount,
  applicationsPageOffset,
  countAll,
  organizationApplicationsHref,
  parseOrganizationApplicationsFilters,
  tabCounts,
} from "@/features/applications/organization-view";
import { getRequirement } from "@/features/requirements/api";
import { ORGANIZATION_APPLICATIONS_PAGE_SIZE } from "@/lib/validation/applications";
import type { WorkRequirement } from "@/domain/work-requirement";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("organizationApplications") };
}

/**
 * v2-05 «Candidaturas» of the organization (v1.8 `Workflow.jsx:53-74`): every application to its
 * requirements, newest first, 20 per page; «Todas ({n})» + the 9 status tabs; `?requirementId=` filters
 * by one offer («Oferta seleccionada: {título}» + «Ver todas» + «Volver a ofertas»). Each card has the
 * same actions as the requirement's own page. Admins and managers only (the function refuses the rest).
 */
export default async function OrganizationApplicationsPage({
  searchParams,
}: PageProps<"/app/organization/applications">) {
  const [search, { organization, canManage }, t, tApplications] = await Promise.all([
    searchParams,
    requireOrganizationContext(),
    getTranslations("hiring.applications"),
    getTranslations("applications"),
  ]);
  const header = (
    <PageHeader
      eyebrow={t("eyebrow")}
      title={t("title")}
      description={tApplications("description")}
    />
  );
  if (!canManage) {
    return (
      <>
        {header}
        <StateMessage
          title={tApplications("managersOnlyTitle")}
          description={tApplications("managersOnlyDescription")}
        />
      </>
    );
  }

  const filters = parseOrganizationApplicationsFilters(search);
  const [selected, list, counts] = await Promise.all([
    filters.requirementId ? getRequirement(filters.requirementId) : null,
    listOrganizationApplications(organization.id, {
      requirementId: filters.requirementId ?? undefined,
      status: filters.status ?? undefined,
      offset: applicationsPageOffset(filters.page),
      limit: ORGANIZATION_APPLICATIONS_PAGE_SIZE,
    }),
    getRequirementApplicationCounts(organization.id),
  ]);
  if (selected && !selected.ok) {
    if (MISSING.has(selected.error.code)) notFound();
    return (
      <>
        {header}
        <ApiErrorState error={selected.error} requestId={selected.requestId} />
      </>
    );
  }
  const requirement = selected?.data.requirement ?? null;
  // RLS lets platform admins read every tenant; this page shows the acting organization only.
  if (requirement && requirement.organizationId !== organization.id) notFound();
  redirectPastLastPage(filters, list);
  const all = allCount(counts, filters, list);

  return (
    <>
      {header}
      {requirement && <SelectedOffer filters={filters} requirement={requirement} />}
      <StatusTabs filters={filters} all={all} />
      <ApplicationsList list={list} filters={filters} openPack={search.pack} />
    </>
  );
}

type Filters = ReturnType<typeof parseOrganizationApplicationsFilters>;
type ApplicationsRead = Awaited<ReturnType<typeof listOrganizationApplications>>;
type CountsRead = Awaited<ReturnType<typeof getRequirementApplicationCounts>>;
type Requirement = WorkRequirement;

/** A `?requirementId=` that does not exist (or is malformed) is a 404, not an error state. */
const MISSING = new Set(["NOT_FOUND", "VALIDATION_ERROR"]);

/** `?page=` past the end lands on the last page (X-04). */
function redirectPastLastPage(filters: Filters, list: ApplicationsRead) {
  if (!list.ok || list.data.total === 0) return;
  const last = applicationsPageCount(list.data.total);
  if (filters.page > last) redirect(organizationApplicationsHref(filters, { page: last }));
}

/** «Todas ({n})»: from the counters, else the list total when no status filter is on; null if unknown. */
function allCount(counts: CountsRead, filters: Filters, list: ApplicationsRead): number | null {
  if (counts.ok) return countAll(tabCounts(counts.data.requirements, filters.requirementId));
  return filters.status === null && list.ok ? list.data.total : null;
}

/** «Oferta seleccionada: {título}» + «Ver todas» + «Volver a ofertas». */
async function SelectedOffer({
  filters,
  requirement,
}: {
  filters: Filters;
  requirement: Requirement;
}) {
  const t = await getTranslations("hiring.applications");
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-4">
      <p className="min-w-0 flex-1 basis-60 text-sm font-semibold break-words">
        {t("selected", { title: requirement.title })}
      </p>
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={organizationApplicationsHref(filters, { requirementId: null })}>
          {t("viewAll")}
        </ButtonLink>
        <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>
          {t("backToOffers")}
        </ButtonLink>
      </div>
    </div>
  );
}

/** «Todas ({n})» + the 9 status tabs. */
async function StatusTabs({ filters, all }: { filters: Filters; all: number | null }) {
  const [t, tApplications, tDomain] = await Promise.all([
    getTranslations("hiring.applications"),
    getTranslations("applications"),
    getTranslations("domain"),
  ]);
  return (
    <nav aria-label={tApplications("filtersLabel")} className="mb-6 flex flex-wrap gap-2">
      <FilterPill
        href={organizationApplicationsHref(filters, { status: null })}
        current={filters.status === null}
      >
        {all === null ? t("allTab") : tApplications("all", { count: all })}
      </FilterPill>
      {APPLICATION_STATUSES.map((status) => (
        <FilterPill
          key={status}
          href={organizationApplicationsHref(filters, { status })}
          current={filters.status === status}
        >
          {tDomain(`applicationStatus.${status}`)}
        </FilterPill>
      ))}
    </nav>
  );
}

/** The cards of the current page, its error or its empty state, and the pager. */
async function ApplicationsList({
  list,
  filters,
  openPack,
}: {
  list: ApplicationsRead;
  filters: Filters;
  openPack: string | string[] | undefined;
}) {
  if (!list.ok) return <ApiErrorState error={list.error} requestId={list.requestId} />;
  const t = await getTranslations("hiring.applications");
  if (list.data.applications.length === 0) {
    return <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />;
  }
  return (
    <>
      <div className="space-y-4">
        {list.data.applications.map((application) => (
          <OrgApplicationCard
            key={application.id}
            application={application}
            requirement={application.requirement}
            showRequirement
            pack={{
              // v2-15 «Ver expediente»: only a card of this page opens (`?pack=` matched against it).
              open: openPack === application.id,
              baseHref: organizationApplicationsHref(filters, { page: filters.page }),
            }}
          />
        ))}
      </div>
      <ApplicationsPager filters={filters} total={list.data.total} />
    </>
  );
}

async function ApplicationsPager({ filters, total }: { filters: Filters; total: number }) {
  const t = await getTranslations("hiring.applications");
  const pages = applicationsPageCount(total);
  const page = Math.min(filters.page, pages);
  return (
    <Pager
      label={t("pagination")}
      info={t("pageInfo", { total, page, pages })}
      previous={
        page > 1
          ? {
              href: organizationApplicationsHref(filters, { page: page - 1 }),
              label: t("previous"),
            }
          : null
      }
      next={
        page < pages
          ? { href: organizationApplicationsHref(filters, { page: page + 1 }), label: t("next") }
          : null
      }
    />
  );
}
