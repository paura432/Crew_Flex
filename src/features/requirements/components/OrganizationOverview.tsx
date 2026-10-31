import type { ReactNode } from "react";
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
import { getVisibleNetworkCount } from "@/features/organizations/api";
import { CoverageGuide } from "@/features/requirements/components/CoverageGuide";
import { OrganizationHero } from "@/features/requirements/components/OrganizationHero";

import type { OrganizationRow } from "@/types/database";

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

/** The overview's reads, in parallel; the hiring counters only for admins and managers. */
const readOverview = (organizationId: string, canManage: boolean) =>
  Promise.all([
    // Archived needs (v1.8 «Archivada», T-64) leave the working lists.
    listRequirements(organizationId, { archived: "exclude" }),
    listFocusCandidates(organizationId),
    // Per requirement (v2-08): the organization's counters are their sums (admin/manager, T-93).
    canManage ? getRequirementApplicationCounts(organizationId) : null,
    // v1.8 «Red visible» (area 50 #13, T-146): admin/manager, like the other hiring counters.
    canManage ? getVisibleNetworkCount(organizationId) : null,
  ]);

/**
 * The organization's «Resumen» (v1.8 `CompanyHome`): open requirements, applications in progress, covered shifts,
 * the focus requirement's capacity and the requirements list. Shared by `/app/organization` and the recruiter's
 * «Espacio recruiter» (`/app/recruiter`, v1.8 «ESPACIO RECRUITER», same KPIs), which only change the heading and
 * add their own panels below (`children`).
 */
export async function OrganizationOverview({
  organization,
  canManage,
  eyebrow,
  title,
  description,
  children,
}: {
  organization: Pick<OrganizationRow, "id" | "name">;
  canManage: boolean;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  const [[t, tHome], [result, open, counts, network]] = await Promise.all([
    Promise.all([getTranslations("organization.dashboard"), getTranslations("orgHome")]),
    readOverview(organization.id, canManage),
  ]);
  // v1.8 CompanyHome: «Candidaturas · {n} pendientes de confirmar» and «Jornadas cubiertas» (D-06).
  const perRequirement = counts?.ok ? counts.data.requirements : null;
  const current = open.ok ? currentAtRequestTime(open.data.requirements) : [];

  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      {t("newRequirement")}
    </ButtonLink>
  );
  // v1.8 quick link «Red profesional» (ORG-01 #26) → the candidate directory (BR-28), admin/manager like it.
  const headerActions = canManage && (
    <>
      <ButtonLink href="/app/organization/candidates" variant="ghost">
        {tHome("network")}
      </ButtonLink>
      {newButton}
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={headerActions}
      />
      {/* v1.8 order (`Dashboard.jsx:24`): title → hero → the four KPIs → the two panels. */}
      <div className="mb-6">
        <OrganizationHero canManage={canManage} />
      </div>
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.requirements.length === 0 ? (
        <StateMessage
          title={t("noRequirementsTitle")}
          description={t("noRequirementsDescription")}
          action={newButton || undefined}
        />
      ) : (
        <OverviewBody
          requirements={result.data.requirements}
          open={open}
          current={current}
          perRequirement={perRequirement}
          canManage={canManage}
          network={network}
        />
      )}
      {children && <div className="mt-6 space-y-6">{children}</div>}
      <div className="mt-6">
        <CoverageGuide canManage={canManage} />
      </div>
    </>
  );
}

type OpenRead = Extract<Awaited<ReturnType<typeof listFocusCandidates>>, { ok: true }>["data"];
type PerRequirement = Extract<
  Awaited<ReturnType<typeof getRequirementApplicationCounts>>,
  { ok: true }
>["data"]["requirements"];

/** The four v1.8 KPIs: open requirements, applications, covered shifts and the visible network. */
async function OverviewKpis({
  currentCount,
  open,
  perRequirement,
  network,
}: {
  currentCount: number;
  open: OpenRead;
  /** Per-requirement counters (admin/manager); null hides the two application KPIs. */
  perRequirement: PerRequirement | null;
  /** «Red visible» (admin/manager); undefined hides it, null shows «—». */
  network: number | null | undefined;
}) {
  const [t, tHiring, tHome] = await Promise.all([
    getTranslations("organization.dashboard"),
    getTranslations("hiring.dashboard"),
    getTranslations("orgHome"),
  ]);
  // v1.8 CompanyHome: «Candidaturas · {n} pendientes de confirmar» and «Jornadas cubiertas» (D-06).
  const applicationCounts = perRequirement ? sumCounts(perRequirement) : null;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Metric
        label={t("openRequirements")}
        value={openRequirementsValue(
          currentCount,
          open.requirements.length,
          DEFAULT_LIST_LIMIT,
          open.total,
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
      {network !== undefined && (
        <Metric
          label={tHome("visibleNetwork")}
          value={network ?? "—"}
          detail={tHome("visibleNetworkDetail")}
        />
      )}
    </dl>
  );
}

/** The KPIs, the focus requirement's capacity (or the members' notice) and the requirements panel. */
async function OverviewBody({
  requirements,
  open,
  current,
  perRequirement,
  canManage,
  network,
}: {
  requirements: WorkRequirement[];
  open: Awaited<ReturnType<typeof listFocusCandidates>>;
  current: WorkRequirement[];
  perRequirement: PerRequirement | null;
  canManage: boolean;
  network: number | null;
}) {
  const t = await getTranslations("organization.dashboard");
  const focus = current[0];
  return (
    <div className="space-y-6">
      {open.ok ? (
        <OverviewKpis
          currentCount={current.length}
          open={open.data}
          perRequirement={perRequirement}
          network={canManage ? network : undefined}
        />
      ) : (
        <ApiErrorState error={open.error} requestId={open.requestId} />
      )}
      {focus && canManage && <FocusCapacity requirement={focus} />}
      {focus && !canManage && (
        <StateMessage title={t("managersOnlyTitle")} description={t("managersOnlyDescription")} />
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
          requirements={dashboardRequirements(requirements, current)}
          seats={perRequirement ? seatsByRequirement(perRequirement) : undefined}
          coverageLabel="covered"
        />
      </Panel>
    </div>
  );
}
