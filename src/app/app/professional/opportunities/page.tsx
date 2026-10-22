import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listOpportunities } from "@/features/opportunities/api";
import { OpportunityCard } from "@/features/opportunities/components/OpportunityCard";
import { opportunitiesHref, type OpportunityFilters } from "@/features/opportunities/view";
import { listOpportunitiesQuery, OPPORTUNITIES_PAGE_SIZE } from "@/lib/validation/applications";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("opportunities") };
}

const PILLS = [
  { key: "all", patch: { urgency: undefined, eligible: undefined } },
  { key: "eligible", patch: { urgency: undefined, eligible: "1" as const } },
  { key: "planned", patch: { urgency: "planned" as const, eligible: undefined } },
  { key: "urgent", patch: { urgency: "urgent" as const, eligible: undefined } },
  { key: "aog", patch: { urgency: "aog" as const, eligible: undefined } },
] as const;

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
    return (
      <>
        {header}
        <StateMessage title={t("orgOnlyTitle")} description={t("orgOnlyDescription")} />
      </>
    );
  }
  const parsed = listOpportunitiesQuery.safeParse({
    urgency: search.urgency,
    eligible: search.eligible,
    q: typeof search.q === "string" ? search.q : undefined,
  });
  const query = parsed.success ? parsed.data : listOpportunitiesQuery.parse({});
  const pageParam = Number(search.page);
  const page = Number.isInteger(pageParam) && pageParam > 1 ? Math.min(pageParam, 500) : 1;
  const filters: OpportunityFilters = {
    urgency: query.urgency,
    eligible: query.eligible,
    q: query.q,
    page,
  };
  const result = await listOpportunities({
    ...filters,
    offset: (page - 1) * OPPORTUNITIES_PAGE_SIZE,
    limit: OPPORTUNITIES_PAGE_SIZE,
  });
  const active = filters.eligible ? "eligible" : (filters.urgency ?? "all");

  return (
    <>
      {header}
      <form
        action="/app/professional/opportunities"
        className="mb-4 flex flex-wrap items-end gap-2"
        role="search"
      >
        <label className="min-w-0 flex-1 basis-60 text-sm font-semibold">
          {t("searchLabel")}
          <input
            name="q"
            type="search"
            defaultValue={filters.q ?? ""}
            placeholder={t("searchPlaceholder")}
            maxLength={80}
            className={`${controlClass} mt-1`}
          />
        </label>
        {filters.urgency && <input type="hidden" name="urgency" value={filters.urgency} />}
        {filters.eligible && <input type="hidden" name="eligible" value={filters.eligible} />}
        <button type="submit" className={buttonClass()}>
          {t("searchSubmit")}
        </button>
      </form>
      <nav aria-label={t("filtersLabel")} className="mb-6 flex flex-wrap gap-2">
        {PILLS.map((pill) => (
          <Link
            key={pill.key}
            href={opportunitiesHref(filters, pill.patch)}
            aria-current={active === pill.key ? "page" : undefined}
            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-muted pointer-coarse:min-h-11 aria-[current=page]:border-navy aria-[current=page]:bg-navy aria-[current=page]:text-white"
          >
            {t(`filter.${pill.key}`)}
          </Link>
        ))}
      </nav>
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
            total={result.data.total}
            capped={result.data.considered >= result.data.cap ? result.data.cap : null}
          />
        </>
      )}
    </>
  );
}

async function OpportunitiesPager({
  filters,
  total,
  capped,
}: {
  filters: OpportunityFilters;
  total: number;
  capped: number | null;
}) {
  const t = await getTranslations("opportunities");
  const pages = Math.max(1, Math.ceil(total / OPPORTUNITIES_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return (
    <nav aria-label={t("pagination")} className="mt-6 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status">
          {t("pageInfo", { total, page, pages })}
        </p>
        {pages > 1 && (
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={opportunitiesHref(filters, { page: page - 1 })} className={buttonClass()}>
                {t("previous")}
              </Link>
            )}
            {page < pages && (
              <Link href={opportunitiesHref(filters, { page: page + 1 })} className={buttonClass()}>
                {t("next")}
              </Link>
            )}
          </div>
        )}
      </div>
      {capped !== null && <p className="text-xs text-muted">{t("cappedNote", { cap: capped })}</p>}
    </nav>
  );
}
