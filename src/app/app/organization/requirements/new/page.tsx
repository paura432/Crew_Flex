import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listQualificationTypes } from "@/features/qualifications/api";
import { RequirementForm } from "@/features/requirements/components/RequirementForm";
import { requireOrganizationContext } from "@/server/session";

export const metadata: Metadata = { title: "New requirement" };

export default async function NewRequirementPage() {
  const { organization, canManage } = await requireOrganizationContext();
  if (!canManage) {
    return (
      <StateMessage
        tone="danger"
        title="You don't have permission"
        description="Only organization managers and admins can create requirements."
      />
    );
  }
  const qualificationTypes = await listQualificationTypes();

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title="New work requirement"
        description="Describe the real operational need. Crew Flex evaluates your internal capacity first."
      />
      {qualificationTypes === null ? (
        <StateMessage
          tone="danger"
          title="The qualification catalog could not be loaded"
          description="Reload the page."
        />
      ) : (
        <Panel>
          <RequirementForm
            organizationId={organization.id}
            qualificationTypes={qualificationTypes}
          />
        </Panel>
      )}
    </>
  );
}
