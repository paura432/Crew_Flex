import type { Metadata } from "next";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listRequirements } from "@/features/requirements/api";
import { RequirementsList } from "@/features/requirements/components/RequirementsList";
import { requireOrganizationContext } from "@/server/session";

export const metadata: Metadata = { title: "Requirements" };

export default async function RequirementsPage() {
  const { organization, canManage } = await requireOrganizationContext();
  const result = await listRequirements(organization.id);
  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      New requirement
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title="Work requirements"
        description="Operational needs, their qualifications and period. Times in UTC."
        actions={newButton}
      />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.requirements.length === 0 ? (
        <StateMessage title="No requirements yet" action={newButton || undefined} />
      ) : (
        <Panel>
          <RequirementsList requirements={result.data.requirements} />
        </Panel>
      )}
    </>
  );
}
