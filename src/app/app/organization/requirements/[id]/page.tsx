import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { evaluateRequirementCapacity } from "@/features/capacity/api";
import { CapacityOverview } from "@/features/capacity/components/CapacityOverview";
import { MatchCard } from "@/features/matching/components/MatchCard";
import { getRequirement } from "@/features/requirements/api";
import { RequirementStatusActions } from "@/features/requirements/components/RequirementStatusActions";
import { RequirementFacts } from "@/features/requirements/components/RequirementFacts";
import { isEvaluable, isExpired, type WorkRequirement } from "@/domain/work-requirement";
import { listRequirementApplications } from "@/features/applications/api";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirement") };
}

/** Request time (dynamic page), as RequirementBadges: render must stay pure for React's lint. */
const expiredNow = (r: Pick<WorkRequirement, "status" | "endsAt">) => isExpired(r, Date.now());

export default async function RequirementDetailPage({
  params,
}: PageProps<"/app/organization/requirements/[id]">) {
  const [{ id }, { organization, canManage }, t, tDashboard, tApplications] = await Promise.all([
    params,
    requireOrganizationContext(),
    getTranslations("organization.detail"),
    getTranslations("organization.dashboard"),
    getTranslations("applications"),
  ]);
  const result = await getRequirement(id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement } = result.data;
  // RLS lets platform admins read every tenant; these pages show the acting organization only.
  if (requirement.organizationId !== organization.id) notFound();
  const closed = requirement.status === "closed";
  // V1.8 evaluates published jobs only: a paused or closed need shows its facts, not the pool (M05).
  const evaluable = isEvaluable(requirement);
  const [capacity, applications] = await Promise.all([
    canManage && evaluable ? evaluateRequirementCapacity(requirement.id) : null,
    canManage ? listRequirementApplications(requirement.id) : null,
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={requirement.title} />
      <div className="space-y-6">
        <Panel>
          <RequirementFacts requirement={requirement} />
          {closed ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              <p className="text-sm text-muted">{t("close.closedNote")}</p>
              {applications?.ok && applications.data.applications.length > 0 && (
                <ButtonLink href={`/app/organization/requirements/${requirement.id}/applications`}>
                  {tApplications("view", { count: applications.data.applications.length })}
                </ButtonLink>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {requirement.status === "paused" && (
                <p className="text-sm text-muted">{t("status.pausedNote")}</p>
              )}
              {/* M05: editable only while it never received an application (the server re-checks). */}
              {applications?.ok &&
                applications.data.applications.length === 0 &&
                !expiredNow(requirement) && (
                  <ButtonLink href={`/app/organization/requirements/${requirement.id}/edit`}>
                    {t("edit")}
                  </ButtonLink>
                )}
              {applications?.ok && (
                <ButtonLink href={`/app/organization/requirements/${requirement.id}/applications`}>
                  {tApplications("view", { count: applications.data.applications.length })}
                </ButtonLink>
              )}
              {canManage && (
                <RequirementStatusActions
                  id={requirement.id}
                  status={requirement.status}
                  expired={expiredNow(requirement)}
                />
              )}
            </div>
          )}
        </Panel>
        {!evaluable ? null : !capacity ? (
          <StateMessage
            title={tDashboard("managersOnlyTitle")}
            description={tDashboard("managersOnlyDescription")}
          />
        ) : !capacity.ok ? (
          <ApiErrorState error={capacity.error} requestId={capacity.requestId} />
        ) : (
          <>
            <CapacityOverview requirement={requirement} capacity={capacity.data.capacity} />
            <section aria-labelledby="internal-title">
              <h2 id="internal-title" className="mb-3 text-lg font-semibold tracking-tight">
                {t("internalWorkforce", { count: capacity.data.internal.length })}
              </h2>
              {capacity.data.internal.length === 0 ? (
                <StateMessage
                  title={t("noTechniciansTitle")}
                  description={t("noTechniciansDescription")}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {capacity.data.internal.map((item) => (
                    <MatchCard key={item.candidate.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
