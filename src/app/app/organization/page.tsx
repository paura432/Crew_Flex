import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import type { WorkRequirement } from "@/domain/work-requirement";
import { evaluateRequirementCapacity } from "@/features/capacity/api";
import { CapacityOverview } from "@/features/capacity/components/CapacityOverview";
import { listRequirements } from "@/features/requirements/api";
import { RequirementsList } from "@/features/requirements/components/RequirementsList";
import {
  currentRequirements,
  dashboardRequirements,
  openRequirementsValue,
} from "@/features/requirements/dashboard";
import { DEFAULT_LIST_LIMIT } from "@/lib/validation/work-requirement";
import { TERMINAL_APPLICATION_STATUSES, type ApplicationStatus } from "@/domain/applications";
import { coveredShifts, seatsByRequirement, sumCounts } from "@/domain/coverage";
import { getRequirementApplicationCounts } from "@/features/applications/api";
import { CoverageGuide } from "@/features/requirements/components/CoverageGuide";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("organization") };
}

/** Open and not ended at request time; expired ones are never the focus (V1.8). */
const currentAtRequestTime = (requirements: WorkRequirement[]) =>
  currentRequirements(requirements, Date.now());

/** Open, not yet ended, soonest first — filtered by the API so the 50-row page cannot hide the focus. */
const listFocusCandidates = (organizationId: string) =>
  listRequirements(organizationId, { status: "open", endsAfter: new Date().toISOString() });

async function FocusCapacity({ requirement }: { requirement: WorkRequirement }) {
  const result = await evaluateRequirementCapacity(requirement.id);
  if (!result.ok) return <ApiErrorState error={result.error} requestId={result.requestId} />;
  return (
    <CapacityOverview
      requirement={requirement}
      capacity={result.data.capacity}
      showRequirementLink
    />
  );
}

/** Applications still in progress (not finished, rejected, withdrawn or cancelled). */
const activeApplications = (counts: Partial<Record<ApplicationStatus, number>>) =>
  Object.entries(counts)
    .filter(([status]) => !TERMINAL_APPLICATION_STATUSES.includes(status as ApplicationStatus))
    .reduce((sum, [, n]) => sum + (n ?? 0), 0);

export default async function OrganizationDashboard() {
  const [{ organization, canManage }, t, tHiring] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.dashboard"),
    getTranslations("hiring.dashboard"),
  ]);
  const [result, open, counts] = await Promise.all([
    // Archived needs (v1.8 «Archivada», T-64) leave the working lists.
    listRequirements(organization.id, { archived: "exclude" }),
    listFocusCandidates(organization.id),
    // Per requirement (v2-08): the organization's counters are their sums (admin/manager, T-93).
    canManage ? getRequirementApplicationCounts(organization.id) : null,
  ]);
  // v1.8 CompanyHome: «Candidaturas · {n} pendientes de confirmar» and «Jornadas cubiertas» (D-06).
  const perRequirement = counts?.ok ? counts.data.requirements : null;
  const applicationCounts = perRequirement ? sumCounts(perRequirement) : null;
  const current = open.ok ? currentAtRequestTime(open.data.requirements) : [];
  const focus = current[0];

  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      {t("newRequirement")}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={t("title")}
        description={t("description")}
        actions={newButton}
      />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.requirements.length === 0 ? (
        <StateMessage
          title={t("noRequirementsTitle")}
          description={t("noRequirementsDescription")}
          action={newButton || undefined}
        />
      ) : (
        <div className="space-y-6">
          {open.ok ? (
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric
                label={t("openRequirements")}
                value={openRequirementsValue(
                  current.length,
                  open.data.requirements.length,
                  DEFAULT_LIST_LIMIT,
                  open.data.total,
                )}
                detail={t("openRequirementsDetail")}
              />
              {applicationCounts && (
                <>
                  <Metric
                    label={t("applications")}
                    value={activeApplications(applicationCounts)}
                    detail={t("toConfirm", { count: applicationCounts.accepted ?? 0 })}
                    tone={(applicationCounts.accepted ?? 0) > 0 ? "warn" : "neutral"}
                  />
                  <Metric
                    label={tHiring("coveredShifts")}
                    value={coveredShifts(perRequirement ?? [])}
                    detail={t("confirmedOnly")}
                  />
                </>
              )}
            </dl>
          ) : (
            <ApiErrorState error={open.error} requestId={open.requestId} />
          )}
          {focus && canManage && <FocusCapacity requirement={focus} />}
          {focus && !canManage && (
            <StateMessage
              title={t("managersOnlyTitle")}
              description={t("managersOnlyDescription")}
            />
          )}
          <Panel
            title={t("requirements")}
            actions={
              <ButtonLink href="/app/organization/requirements" variant="ghost">
                {t("viewAll")}
              </ButtonLink>
            }
          >
            <RequirementsList
              requirements={dashboardRequirements(result.data.requirements, current)}
              seats={perRequirement ? seatsByRequirement(perRequirement) : undefined}
              coverageLabel="covered"
            />
          </Panel>
        </div>
      )}
      <div className="mt-6">
        <CoverageGuide canManage={canManage} />
      </div>
    </>
  );
}
