import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { evaluateRequirementMatches } from "@/features/matching/api";
import { MatchCard } from "@/features/matching/components/MatchCard";
import {
  CompareForm,
  CompareTable,
  CompareToggle,
  MatchListControls,
  matchListHref,
  MatchPager,
} from "@/features/matching/components/MatchList";
import { listMatches, parseMatchListQuery } from "@/features/matching/list";
import { PoolCoverageNote } from "@/features/matching/components/PoolCoverageNote";
import { getRequirement } from "@/features/requirements/api";
import { QualificationChips } from "@/features/requirements/components/RequirementBadges";
import { formatPeriod } from "@/i18n/format";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("matches") };
}

export default async function RequirementMatchesPage({
  params,
  searchParams,
}: PageProps<"/app/organization/requirements/[id]/matches">) {
  const [{ id }, search, , t, locale] = await Promise.all([
    params,
    searchParams,
    requireOrganizationContext(),
    getTranslations("organization.matches"),
    getLocale(),
  ]);
  const [requirementResult, matchesResult] = await Promise.all([
    getRequirement(id),
    evaluateRequirementMatches(id),
  ]);
  if (!requirementResult.ok) {
    if (
      requirementResult.error.code === "NOT_FOUND" ||
      requirementResult.error.code === "VALIDATION_ERROR"
    )
      notFound();
    return (
      <ApiErrorState error={requirementResult.error} requestId={requirementResult.requestId} />
    );
  }
  const { requirement } = requirementResult.data;
  const base = `/app/organization/requirements/${requirement.id}/matches`;
  const query = parseMatchListQuery(search);
  const list = matchesResult.ok ? listMatches(matchesResult.data.candidates, query) : null;
  const selected = new Set(query.compare);
  const back = (
    <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>{t("back")}</ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={requirement.title}
        description={t("description", {
          location: requirement.location,
          period: formatPeriod(locale, requirement.startsAt, requirement.endsAt),
        })}
        actions={back}
      />
      <div className="mb-6">
        <QualificationChips qualifications={requirement.qualifications} />
      </div>
      {!matchesResult.ok ? (
        <ApiErrorState error={matchesResult.error} requestId={matchesResult.requestId} />
      ) : matchesResult.data.candidates.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        list && (
          <>
            <p className="mb-2 text-sm text-muted" role="status">
              {t.rich("summary", {
                eligible: matchesResult.data.summary.eligible,
                evaluated: matchesResult.data.summary.evaluated,
                b: (chunks) => <strong className="text-ink">{chunks}</strong>,
              })}
            </p>
            <PoolCoverageNote
              evaluated={matchesResult.data.summary.evaluated}
              pool={matchesResult.data.summary.pool}
            />
            <MatchListControls query={query} base={base} />
            {list.compared.length > 0 && (
              <CompareTable
                items={list.compared}
                truncated={list.compareTruncated}
                clearHref={matchListHref(base, query, { compare: [] })}
              />
            )}
            {list.total === 0 ? (
              <StateMessage title={t("list.noResults")} description={t("list.noResultsHint")} />
            ) : (
              <>
                <div className="mb-4">
                  <CompareForm query={query} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {list.items.map((item) => (
                    <MatchCard
                      key={item.candidate.id}
                      item={item}
                      footer={
                        <CompareToggle
                          id={item.candidate.id}
                          checked={selected.has(item.candidate.id)}
                        />
                      }
                    />
                  ))}
                </div>
              </>
            )}
            <MatchPager
              base={base}
              query={query}
              page={list.page}
              pages={list.pages}
              total={list.total}
            />
          </>
        )
      )}
    </>
  );
}
