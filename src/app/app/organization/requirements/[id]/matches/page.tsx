import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { isStaffingAgency } from "@/domain/recruiter";
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
import { listMatches, MAX_COMPARE, parseMatchListQuery } from "@/features/matching/list";
import { PoolCoverageNote } from "@/features/matching/components/PoolCoverageNote";
import { getRequirement } from "@/features/requirements/api";
import { QualificationChips } from "@/features/requirements/components/RequirementBadges";
import { formatPeriod } from "@/i18n/format";
import { isEvaluable } from "@/domain/work-requirement";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("matches") };
}

export default async function RequirementMatchesPage({
  params,
  searchParams,
}: PageProps<"/app/organization/requirements/[id]/matches">) {
  const [{ id }, search, { organization, canManage }, t, tDashboard, tRecruiter, locale] =
    await Promise.all([
      params,
      searchParams,
      requireOrganizationContext(),
      getTranslations("organization.matches"),
      getTranslations("organization.dashboard"),
      getTranslations("recruiter"),
      getLocale(),
    ]);
  // Same gate as the detail page and the dashboard; the RPC re-checks the role on its own.
  if (!canManage) {
    return (
      <StateMessage
        title={tDashboard("managersOnlyTitle")}
        description={tDashboard("managersOnlyDescription")}
      />
    );
  }
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
  // RLS lets platform admins read every tenant; these pages show the acting organization only.
  if (requirement.organizationId !== organization.id) notFound();
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
        eyebrow={isStaffingAgency(organization.type) ? tRecruiter("networkEyebrow") : t("eyebrow")}
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
      {!isEvaluable(requirement) ? (
        // V1.8 evaluates published jobs only (M05): no pool for a paused or closed need.
        <StateMessage
          title={t(
            requirement.status === "paused"
              ? "notEvaluablePaused"
              : requirement.status === "draft"
                ? "notEvaluableDraft"
                : "notEvaluableClosed",
          )}
          description={t("notEvaluableDescription")}
          action={back}
        />
      ) : !matchesResult.ok ? (
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
                  <CompareForm
                    query={query}
                    selectedIds={list.compared.map((item) => item.candidate.id)}
                    visibleIds={list.items.map((item) => item.candidate.id)}
                  />
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
                          full={list.compared.length >= MAX_COMPARE}
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
