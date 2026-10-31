import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
import { OutreachPanel } from "@/features/outreach/components/OutreachPanel";
import { CoverageMeter } from "@/features/requirements/components/CoverageMeter";
import { canActForClient } from "@/domain/recruiter";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirement") };
}

/** Request time (dynamic page), as RequirementBadges: render must stay pure for React's lint. */
const expiredNow = (r: Pick<WorkRequirement, "status" | "endsAt">) => isExpired(r, Date.now());
const requestTime = () => Date.now();

export default async function RequirementDetailPage({
  params,
  searchParams,
}: PageProps<"/app/organization/requirements/[id]">) {
  const [{ id }, { archived }, { organization, canManage }] = await Promise.all([
    params,
    searchParams,
    requireOrganizationContext(),
  ]);
  const result = await getRequirement(id);
  if (!result.ok) {
    if (MISSING.has(result.error.code)) notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement } = result.data;
  // RLS lets platform admins read every tenant; these pages show the acting organization only.
  if (requirement.organizationId !== organization.id) notFound();
  return (
    <RequirementDetail
      requirement={requirement}
      canManage={canManage}
      justArchived={archived === "1"}
    />
  );
}

/** The requirement's facts and actions, its outreach and (published needs) its capacity. */
async function RequirementDetail({
  requirement,
  canManage,
  justArchived,
}: {
  requirement: WorkRequirement;
  canManage: boolean;
  justArchived: boolean;
}) {
  const t = await getTranslations("organization.detail");
  // V1.8 evaluates published jobs only: a draft, paused or closed need shows its facts, not the pool.
  const evaluable = isEvaluable(requirement);
  const [capacity, applications] = await Promise.all([
    canManage && evaluable ? evaluateRequirementCapacity(requirement.id) : null,
    canManage && requirement.status !== "draft"
      ? listRequirementApplications(requirement.id)
      : null,
  ]);
  const list = applications?.ok ? applications.data.applications : null;
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={requirement.title} />
      <div className="space-y-6">
        <RequirementPanel
          requirement={requirement}
          canManage={canManage}
          justArchived={justArchived}
          list={list}
        />
        {/* PKG outreach (v2-17): «Distribución Urgente/AOG», admin/manager, never on planned needs. */}
        <OutreachPanel requirement={requirement} canManage={canManage} now={requestTime()} />
        {evaluable && <CapacitySection requirement={requirement} capacity={capacity} />}
      </div>
    </>
  );
}

type ApplicationList = Extract<
  Awaited<ReturnType<typeof listRequirementApplications>>,
  { ok: true }
>["data"]["applications"];

/** Facts, confirmed coverage and the actions of a closed or a live requirement. */
async function RequirementPanel({
  requirement,
  canManage,
  justArchived,
  list,
}: {
  requirement: WorkRequirement;
  canManage: boolean;
  justArchived: boolean;
  /** The requirement's applications; null when not read (draft, member) or the read failed. */
  list: ApplicationList | null;
}) {
  const [t, tApplications] = await Promise.all([
    getTranslations("organization.detail"),
    getTranslations("applications"),
  ]);
  const applicationCount = list?.length ?? 0;
  // «Cobertura por jornada» and v2-08 «{p}% cobertura confirmada» (BR-23): seats taken (confirmed +
  // finished), the same count that covers the requirement.
  const confirmedSeats = list ? seatsTaken(countStatuses(list)) : null;
  const coverage =
    confirmedSeats === null ? null : confirmedCoverage(requirement.headcount, confirmedSeats);
  const applicationsLink = list && (
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
  const draft = requirement.status === "draft";
  return (
    <Panel>
      <RequirementFacts requirement={requirement} confirmedSeats={confirmedSeats} />
      {coverage && (
        <div className="mt-4 max-w-sm">
          <CoverageMeter coverage={coverage} seats />
        </div>
      )}
      {requirement.status === "closed" ? (
        <ClosedActions
          requirement={requirement}
          canManage={canManage}
          justArchived={justArchived}
          links={
            <>
              {applicationCount > 0 && applicationsLink}
              {duplicateLink}
            </>
          }
        />
      ) : (
        <OpenActions
          requirement={requirement}
          canManage={canManage}
          applicationCount={applicationCount}
          canEdit={canManage && (draft || (list !== null && applicationCount === 0))}
          links={
            <>
              {applicationsLink}
              {duplicateLink}
            </>
          }
        />
      )}
    </Panel>
  );
}

/** A malformed or unknown id is a 404, not an error state. */
const MISSING = new Set(["NOT_FOUND", "VALIDATION_ERROR"]);

type CapacityRead = Awaited<ReturnType<typeof evaluateRequirementCapacity>> | null;

/** A closed (or archived) requirement: its note, the links and «Archivar» while it can be archived. */
async function ClosedActions({
  requirement,
  canManage,
  justArchived,
  links,
}: {
  requirement: WorkRequirement;
  canManage: boolean;
  justArchived: boolean;
  links: ReactNode;
}) {
  const t = await getTranslations("organization.detail");
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      {/* «Archivar» redirects here with ?archived=1: the one-way step confirms itself (T-64). */}
      {justArchived && requirement.archivedAt && (
        <p role="status" className="text-sm font-medium">
          {t("archive.done")}
        </p>
      )}
      <p className="text-sm text-muted">
        {requirement.archivedAt ? t("archive.note") : t("close.closedNote")}
      </p>
      <div className="flex flex-wrap gap-2">{links}</div>
      {canManage && canArchive(requirement) && (
        <RequirementStatusActions
          id={requirement.id}
          status={requirement.status}
          expired={false}
          archivedAt={requirement.archivedAt}
        />
      )}
    </div>
  );
}

/** A draft, open or paused requirement: its notes, «Editar»/«Completar», the links and the status actions. */
async function OpenActions({
  requirement,
  canManage,
  applicationCount,
  canEdit,
  links,
}: {
  requirement: WorkRequirement;
  canManage: boolean;
  applicationCount: number;
  /** Before the period check: a draft, or a published need that never received an application. */
  canEdit: boolean;
  links: ReactNode;
}) {
  const [t, tRecruiter] = await Promise.all([
    getTranslations("organization.detail"),
    getTranslations("recruiter.requirement"),
  ]);
  const draft = requirement.status === "draft";
  const expired = expiredNow(requirement);
  return (
    <div className="mt-4 space-y-3 border-t border-line pt-4">
      {requirement.status === "paused" && (
        <p className="text-sm text-muted">{t("status.pausedNote")}</p>
      )}
      {/* BR-27.5: a revoked representation hides the requirement and stops it moving forward. */}
      {requirement.client && !canActForClient(requirement.client.status) && (
        <p className="rounded-lg border border-warn/30 bg-warn-bg px-3 py-2 text-sm text-warn">
          {tRecruiter("revokedNote", { client: requirement.client.name })}
        </p>
      )}
      {draft && <p className="text-sm text-muted">{t("draft.note")}</p>}
      {/* ORG-05 #10: why «Editar» is gone once the requirement received applications. */}
      {applicationCount > 0 && <p className="text-sm text-muted">{t("activeApplicationsNote")}</p>}
      <div className="flex flex-wrap gap-2">
        {/* M05: editable only while it never received an application (the server re-checks). */}
        {/* 7682e92: no edit once the period ended (an expired need is closed, not edited). */}
        {canEdit && (draft || !expired) && (
          <ButtonLink
            href={`/app/organization/requirements/${requirement.id}/edit`}
            variant={draft ? "primary" : "secondary"}
          >
            {draft ? t("draft.complete") : t("edit")}
          </ButtonLink>
        )}
        {links}
      </div>
      {canManage && (
        <RequirementStatusActions
          id={requirement.id}
          status={requirement.status}
          expired={expired}
          archivedAt={requirement.archivedAt}
        />
      )}
    </div>
  );
}

/** The published need's capacity: the gap and its internal workforce (admin/manager only). */
async function CapacitySection({
  requirement,
  capacity,
}: {
  requirement: WorkRequirement;
  capacity: CapacityRead;
}) {
  const [t, tDashboard] = await Promise.all([
    getTranslations("organization.detail"),
    getTranslations("organization.dashboard"),
  ]);
  if (!capacity) {
    return (
      <StateMessage
        title={tDashboard("managersOnlyTitle")}
        description={tDashboard("managersOnlyDescription")}
      />
    );
  }
  if (!capacity.ok) return <ApiErrorState error={capacity.error} requestId={capacity.requestId} />;
  const { internal } = capacity.data;
  return (
    <>
      <CapacityOverview requirement={requirement} capacity={capacity.data.capacity} />
      <section aria-labelledby="internal-title">
        <h2 id="internal-title" className="mb-3 text-lg font-semibold tracking-tight">
          {t("internalWorkforce", { count: internal.length })}
        </h2>
        {internal.length === 0 ? (
          <StateMessage
            title={t("noTechniciansTitle")}
            description={t("noTechniciansDescription")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {internal.map((item) => (
              <MatchCard key={item.candidate.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
