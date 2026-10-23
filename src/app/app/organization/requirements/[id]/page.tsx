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
import { confirmedCoverage, countStatuses, seatsTaken } from "@/domain/coverage";
import {
  canArchive,
  isEvaluable,
  isExpired,
  type WorkRequirement,
} from "@/domain/work-requirement";
import { listRequirementApplications } from "@/features/applications/api";
import { CoverageMeter } from "@/features/requirements/components/CoverageMeter";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirement") };
}

/** Request time (dynamic page), as RequirementBadges: render must stay pure for React's lint. */
const expiredNow = (r: Pick<WorkRequirement, "status" | "endsAt">) => isExpired(r, Date.now());

export default async function RequirementDetailPage({
  params,
  searchParams,
}: PageProps<"/app/organization/requirements/[id]">) {
  const [{ id }, { archived }, { organization, canManage }, t, tDashboard, tApplications] =
    await Promise.all([
      params,
      searchParams,
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
  const draft = requirement.status === "draft";
  // V1.8 evaluates published jobs only: a draft, paused or closed need shows its facts, not the pool.
  const evaluable = isEvaluable(requirement);
  const [capacity, applications] = await Promise.all([
    canManage && evaluable ? evaluateRequirementCapacity(requirement.id) : null,
    canManage && !draft ? listRequirementApplications(requirement.id) : null,
  ]);
  const applicationCount = applications?.ok ? applications.data.applications.length : 0;
  // «Cobertura por jornada» and v2-08 «{p}% cobertura confirmada» (BR-23): seats taken (confirmed +
  // finished), the same count that covers the requirement.
  const confirmedSeats = applications?.ok
    ? seatsTaken(countStatuses(applications.data.applications))
    : null;
  const coverage =
    confirmedSeats === null ? null : confirmedCoverage(requirement.headcount, confirmedSeats);
  const applicationsLink = applications?.ok && (
    <ButtonLink href={`/app/organization/requirements/${requirement.id}/applications`}>
      {tApplications("view", { count: applicationCount })}
    </ButtonLink>
  );
  // v1.8 «Duplicar» (v2-14, T-65): the builder prefilled with a copy; nothing is saved until the user saves.
  const duplicateLink = canManage && (
    <ButtonLink href={`/app/organization/requirements/new?from=${requirement.id}`}>
      {t("duplicate")}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={requirement.title} />
      <div className="space-y-6">
        <Panel>
          <RequirementFacts requirement={requirement} confirmedSeats={confirmedSeats} />
          {coverage && (
            <div className="mt-4 max-w-sm">
              <CoverageMeter coverage={coverage} seats />
            </div>
          )}
          {closed ? (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {/* «Archivar» redirects here with ?archived=1: the one-way step confirms itself (T-64). */}
              {archived === "1" && requirement.archivedAt && (
                <p role="status" className="text-sm font-medium">
                  {t("archive.done")}
                </p>
              )}
              <p className="text-sm text-muted">
                {requirement.archivedAt ? t("archive.note") : t("close.closedNote")}
              </p>
              <div className="flex flex-wrap gap-2">
                {applicationCount > 0 && applicationsLink}
                {duplicateLink}
              </div>
              {canManage && canArchive(requirement) && (
                <RequirementStatusActions
                  id={requirement.id}
                  status={requirement.status}
                  expired={false}
                  archivedAt={requirement.archivedAt}
                />
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {requirement.status === "paused" && (
                <p className="text-sm text-muted">{t("status.pausedNote")}</p>
              )}
              {draft && <p className="text-sm text-muted">{t("draft.note")}</p>}
              {/* ORG-05 #10: why «Editar» is gone once the requirement received applications. */}
              {applicationCount > 0 && (
                <p className="text-sm text-muted">{t("activeApplicationsNote")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {/* M05: editable only while it never received an application (the server re-checks). */}
                {/* 7682e92: no edit once the period ended (an expired need is closed, not edited). */}
                {canManage &&
                  (draft ||
                    (applications?.ok && applicationCount === 0 && !expiredNow(requirement))) && (
                    <ButtonLink
                      href={`/app/organization/requirements/${requirement.id}/edit`}
                      variant={draft ? "primary" : "secondary"}
                    >
                      {draft ? t("draft.complete") : t("edit")}
                    </ButtonLink>
                  )}
                {applicationsLink}
                {duplicateLink}
              </div>
              {canManage && (
                <RequirementStatusActions
                  id={requirement.id}
                  status={requirement.status}
                  expired={expiredNow(requirement)}
                  archivedAt={requirement.archivedAt}
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
