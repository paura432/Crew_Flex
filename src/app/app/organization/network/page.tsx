import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listNetworkOpportunities } from "@/features/opportunities/api";
import { NetworkOpportunityCard } from "@/features/opportunities/components/OpportunityCard";
import {
  OpportunitiesPager,
  OpportunitiesToolbar,
} from "@/features/opportunities/components/OpportunitiesToolbar";
import {
  NETWORK_PATH,
  NETWORK_PILLS,
  opportunitiesHref,
  parseOpportunityFilters,
} from "@/features/opportunities/view";
import { OPPORTUNITIES_PAGE_SIZE } from "@/lib/validation/applications";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("network") };
}

/**
 * v2-20 «Ofertas en la red.» (v1.8 `Marketplace.jsx:87` for a company, minus the commission — `✗`):
 * the requirements other organizations publish, as the fixed projection professionals see, without
 * any eligibility. The organization's own are in «Necesidades» (T-90). Every member may read it.
 */
export default async function NetworkPage({
  searchParams,
}: PageProps<"/app/organization/network">) {
  const [search, , t, tNetwork] = await Promise.all([
    searchParams,
    requireOrganizationContext(),
    getTranslations("opportunities"),
    getTranslations("hiring.network"),
  ]);
  // «Compatibles» is a professional's filter: never sent from here.
  const filters = { ...parseOpportunityFilters(search), eligible: undefined };
  const result = await listNetworkOpportunities({
    urgency: filters.urgency,
    q: filters.q,
    offset: (filters.page - 1) * OPPORTUNITIES_PAGE_SIZE,
    limit: OPPORTUNITIES_PAGE_SIZE,
  });
  if (result.ok && result.data.total > 0) {
    const last = Math.ceil(result.data.total / OPPORTUNITIES_PAGE_SIZE);
    if (filters.page > last) redirect(opportunitiesHref(filters, { page: last }, NETWORK_PATH));
  }

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={tNetwork("title")} description={t("description")} />
      <p className="mb-4 text-sm text-muted">{tNetwork("ownNote")}</p>
      <OpportunitiesToolbar filters={filters} base={NETWORK_PATH} pills={NETWORK_PILLS} />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.opportunities.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {result.data.opportunities.map((requirement) => (
              <NetworkOpportunityCard key={requirement.id} requirement={requirement} />
            ))}
          </div>
          <OpportunitiesPager
            filters={filters}
            base={NETWORK_PATH}
            total={result.data.total}
            capped={result.data.considered >= result.data.cap ? result.data.cap : null}
          />
        </>
      )}
    </>
  );
}
