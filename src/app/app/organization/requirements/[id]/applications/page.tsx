import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listRequirementApplications } from "@/features/applications/api";
import { OrgApplicationCard } from "@/features/applications/components/OrgApplicationCard";
import { getRequirement } from "@/features/requirements/api";
import { RequirementStatusChip } from "@/features/requirements/components/RequirementBadges";
import { formatPeriod } from "@/i18n/format";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirementApplications") };
}

/**
 * M08, organization side (v1.8 «Candidaturas» filtered by one job): applicants as the candidate pool
 * shows them (pseudonym rules, T-04), their live eligibility, proposal, history and the actions of
 * an admin/manager. Plain members see the managers-only state (the function refuses them anyway).
 */
export default async function RequirementApplicationsPage({
  params,
}: PageProps<"/app/organization/requirements/[id]/applications">) {
  const [{ id }, { organization, canManage }, t, locale] = await Promise.all([
    params,
    requireOrganizationContext(),
    getTranslations("applications"),
    getLocale(),
  ]);
  if (!canManage) {
    return (
      <StateMessage title={t("managersOnlyTitle")} description={t("managersOnlyDescription")} />
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
          {applicationsResult.data.applications.map((application) => (
            <OrgApplicationCard
              key={application.id}
              application={application}
              requirement={requirement}
            />
          ))}
        </div>
      )}
    </>
  );
}
