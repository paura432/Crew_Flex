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
  const [search, { organization, canManage }, t, tApplications, tDomain] = await Promise.all([
    searchParams,
    requireOrganizationContext(),
    getTranslations("hiring.applications"),
    getTranslations("applications"),
    getTranslations("domain"),
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
    if (selected.error.code === "NOT_FOUND" || selected.error.code === "VALIDATION_ERROR")
      notFound();
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
  // `?page=` past the end lands on the last page (X-04).
  if (list.ok && list.data.total > 0) {
    const last = applicationsPageCount(list.data.total);
    if (filters.page > last) redirect(organizationApplicationsHref(filters, { page: last }));
  }
  const all = counts.ok
    ? countAll(tabCounts(counts.data.requirements, filters.requirementId))
    : filters.status === null && list.ok
      ? list.data.total
      : null;

  return (
    <>
      {header}
      {requirement && (
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
      )}
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
      {!list.ok ? (
        <ApiErrorState error={list.error} requestId={list.requestId} />
      ) : list.data.applications.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <div className="space-y-4">
            {list.data.applications.map((application) => (
              <OrgApplicationCard
                key={application.id}
                application={application}
                requirement={application.requirement}
                showRequirement
              />
            ))}
          </div>
          <ApplicationsPager filters={filters} total={list.data.total} />
        </>
      )}
    </>
  );
}

async function ApplicationsPager({
  filters,
  total,
}: {
  filters: ReturnType<typeof parseOrganizationApplicationsFilters>;
  total: number;
}) {
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
