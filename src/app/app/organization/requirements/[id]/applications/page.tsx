import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { StatusChip } from "@/components/ui/StatusChip";
import { canFinish } from "@/domain/applications";
import type { WorkRequirement } from "@/domain/work-requirement";
import { listRequirementApplications } from "@/features/applications/api";
import { ApplicationActions } from "@/features/applications/components/ApplicationActions";
import { ApplicationDetails } from "@/features/applications/components/ApplicationDetails";
import { APPLICATION_TONE } from "@/features/applications/view";
import { MatchExplanation } from "@/features/matching/components/MatchCard";
import { getRequirement } from "@/features/requirements/api";
import { RequirementStatusChip } from "@/features/requirements/components/RequirementBadges";
import { formatPeriod } from "@/i18n/format";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirementApplications") };
}

/** Request time (dynamic page): render must stay pure for React's lint. */
const periodEndedNow = (r: Pick<WorkRequirement, "endsAt">) => canFinish(r, Date.now());

/**
 * M08, organization side (v1.8 «Candidaturas» filtered by one job): applicants as the candidate pool
 * shows them (pseudonym rules, T-04), their live eligibility, proposal, history and the actions of
 * an admin/manager. Plain members see the managers-only state (the function refuses them anyway).
 */
export default async function RequirementApplicationsPage({
  params,
}: PageProps<"/app/organization/requirements/[id]/applications">) {
  const [{ id }, { organization, canManage }, t, tMatching, tDashboard, tDomain, locale] =
    await Promise.all([
      params,
      requireOrganizationContext(),
      getTranslations("applications"),
      getTranslations("matching"),
      getTranslations("organization.dashboard"),
      getTranslations("domain"),
      getLocale(),
    ]);
  if (!canManage) {
    return (
      <StateMessage
        title={tDashboard("managersOnlyTitle")}
        description={tDashboard("managersOnlyDescription")}
      />
    );
  }
  const [requirementResult, applicationsResult] = await Promise.all([
    getRequirement(id),
    listRequirementApplications(id),
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
  const periodEnded = periodEndedNow(requirement);

  return (
    <>
      <PageHeader
        eyebrow={t("orgEyebrow")}
        title={requirement.title}
        description={`${requirement.location} · ${formatPeriod(locale, requirement.startsAt, requirement.endsAt)}`}
        actions={
          <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>
            {t("back")}
          </ButtonLink>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RequirementStatusChip requirement={requirement} />
        <p className="text-sm text-muted">{t("orgDescription")}</p>
      </div>
      {!applicationsResult.ok ? (
        <ApiErrorState error={applicationsResult.error} requestId={applicationsResult.requestId} />
      ) : applicationsResult.data.applications.length === 0 ? (
        <StateMessage title={t("orgEmptyTitle")} description={t("orgEmptyDescription")} />
      ) : (
        <div className="space-y-4">
          {applicationsResult.data.applications.map((application) => {
            const { candidate, match } = application;
            const title = candidate.displayName ?? tMatching("anonymous", { ref: candidate.id });
            return (
              <article
                key={application.id}
                aria-label={title}
                className="space-y-3 rounded-xl border border-line bg-white p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip tone={APPLICATION_TONE[application.status]}>
                    {tDomain(`applicationStatus.${application.status}`)}
                  </StatusChip>
                  <StatusChip tone={match.eligible ? "ok" : "danger"}>
                    {match.eligible ? tMatching("eligible") : tMatching("notEligible")}
                  </StatusChip>
                </div>
                <div>
                  <h2 className="text-lg font-semibold break-words">{title}</h2>
                  <p className="text-sm text-muted">
                    {candidate.baseLocation ?? tMatching("baseNotShared")}
                    {candidate.yearsExperience !== null &&
                      ` · ${tMatching("years", { count: candidate.yearsExperience })}`}
                  </p>
                </div>
                <MatchExplanation match={match} />
                <ApplicationDetails application={application} />
                <ApplicationActions
                  applicationId={application.id}
                  status={application.status}
                  updatedAt={application.updatedAt}
                  actor="organization"
                  proposal={
                    application.currentProposal
                      ? {
                          id: application.currentProposal.id,
                          version: application.currentProposal.version,
                        }
                      : null
                  }
                  periodEnded={periodEnded}
                  requirementOpen={requirement.status === "open"}
                />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
