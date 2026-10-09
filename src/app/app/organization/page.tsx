import type { Metadata } from "next";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import type { WorkRequirement } from "@/domain/work-requirement";
import { evaluateRequirementCapacity } from "@/features/capacity/api";
import { CapacityOverview } from "@/features/capacity/components/CapacityOverview";
import { listRequirements } from "@/features/requirements/api";
import { RequirementsList } from "@/features/requirements/components/RequirementsList";
import { requireOrganizationContext } from "@/server/session";

export const metadata: Metadata = { title: "Organization dashboard" };

/** Next open requirement that has not ended yet (request time), else the earliest open one. */
function focusRequirement(requirements: WorkRequirement[]) {
  const now = Date.now();
  const open = requirements.filter((r) => r.status === "open");
  return open.find((r) => Date.parse(r.endsAt) > now) ?? open[0];
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
  const { organization, canManage } = await requireOrganizationContext();
  const result = await listRequirements(organization.id);
  const focus = result.ok ? focusRequirement(result.data.requirements) : undefined;

  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      New requirement
    </ButtonLink>
  );

  return (
    <>
      <PageHeader eyebrow={organization.name} title="Operations" actions={newButton} />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.requirements.length === 0 ? (
        <StateMessage
          title="No requirements yet"
          description="Create a requirement to see your technical capacity and the gap to cover."
          action={newButton || undefined}
        />
      ) : (
        <div className="space-y-6">
          {focus && canManage && <FocusCapacity requirement={focus} />}
          {focus && !canManage && (
            <StateMessage
              title="Capacity analysis is available to managers and admins"
              description="Ask an organization admin for the manager role."
            />
          )}
          <Panel
            title="Requirements"
            actions={
              <ButtonLink href="/app/organization/requirements" variant="ghost">
                View all
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
