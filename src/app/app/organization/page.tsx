import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { isExpired, type WorkRequirement } from "@/domain/work-requirement";
import { evaluateRequirementCapacity } from "@/features/capacity/api";
import { CapacityOverview } from "@/features/capacity/components/CapacityOverview";
import { listRequirements } from "@/features/requirements/api";
import { RequirementsList } from "@/features/requirements/components/RequirementsList";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("organization") };
}

/** Next open requirement that has not ended yet (request time); expired ones are not a focus (V1.8). */
function focusRequirement(requirements: WorkRequirement[]) {
  const now = Date.now();
  return requirements.find((r) => r.status === "open" && !isExpired(r, now));
}

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

export default async function OrganizationDashboard() {
  const [{ organization, canManage }, t] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.dashboard"),
  ]);
  const result = await listRequirements(organization.id);
  const focus = result.ok ? focusRequirement(result.data.requirements) : undefined;

  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      {t("newRequirement")}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader eyebrow={organization.name} title={t("title")} actions={newButton} />
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
            <RequirementsList requirements={result.data.requirements.slice(0, 5)} />
          </Panel>
        </div>
      )}
    </>
  );
}
