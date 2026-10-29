import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listOpportunities } from "@/features/opportunities/api";
import { OpportunityCard } from "@/features/opportunities/components/OpportunityCard";
import {
  OpportunitiesPager,
  OpportunitiesToolbar,
} from "@/features/opportunities/components/OpportunitiesToolbar";
import {
  NETWORK_PATH,
  OPPORTUNITIES_PATH,
  OPPORTUNITY_PILLS,
  opportunitiesHref,
  parseOpportunityFilters,
} from "@/features/opportunities/view";
import { OPPORTUNITIES_PAGE_SIZE } from "@/lib/validation/applications";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("opportunities") };
}

/**
 * M07 (D-12, owner 2026-10-22): every professional sees the published, current requirements, each
 * with their OWN eligibility explained separately (v1.8 `Marketplace.jsx` «Oportunidades»).
 */
export default async function OpportunitiesPage({
  searchParams,
}: PageProps<"/app/professional/opportunities">) {
  const [search, actor, t] = await Promise.all([
    searchParams,
    requireSessionActor(),
    getTranslations("opportunities"),
  ]);
  const header = (
    <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
  );
  if (actor.profile.account_type !== "professional") {
    const tNetwork = await getTranslations("nav");
    return (
      <>
        {header}
        <StateMessage
          title={t("orgOnlyTitle")}
          description={t("orgOnlyDescription")}
          // v2-20: an organization account reads the network in its own view.
          action={
            actor.memberships.length > 0 ? (
              <ButtonLink href={NETWORK_PATH}>{tNetwork("network")}</ButtonLink>
            ) : undefined
          }
        />
      </>
    );
  }
  const filters = parseOpportunityFilters(search);
  const { page } = filters;
  const result = await listOpportunities({
    urgency: filters.urgency,
    eligible: filters.eligible,
    q: filters.q,
    offset: (page - 1) * OPPORTUNITIES_PAGE_SIZE,
    limit: OPPORTUNITIES_PAGE_SIZE,
  });
  // `?page=` past the end lands on the last page, as the requirements list (X-04, v2 diff MKT-03).
  if (result.ok && result.data.total > 0) {
    const last = Math.ceil(result.data.total / OPPORTUNITIES_PAGE_SIZE);
    if (page > last) redirect(opportunitiesHref(filters, { page: last }));
  }

  return (
    <>
      {header}
      <OpportunitiesToolbar filters={filters} base={OPPORTUNITIES_PATH} pills={OPPORTUNITY_PILLS} />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.opportunities.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {result.data.opportunities.map((opportunity) => (
              <OpportunityCard key={opportunity.requirement.id} opportunity={opportunity} />
            ))}
          </div>
          <OpportunitiesPager
            filters={filters}
            base={OPPORTUNITIES_PATH}
            total={result.data.total}
            capped={result.data.considered >= result.data.cap ? result.data.cap : null}
          />
        </>
      )}
    </>
  );
}
