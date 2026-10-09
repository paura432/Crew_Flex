import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listWorkforce } from "@/features/workforce/api";
import { WorkforceList } from "@/features/workforce/components/WorkforceList";
import { requireOrganizationContext } from "@/server/session";

export const metadata: Metadata = { title: "Workforce" };

export default async function WorkforcePage() {
  const { organization } = await requireOrganizationContext();
  const members = await listWorkforce(organization.id);

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title="Internal workforce"
        description="Members of your organization and their qualification status. Adding members (invitations with consent) comes next."
      />
      {members === null ? (
        <StateMessage
          tone="danger"
          title="The workforce could not be loaded"
          description="Reload the page."
        />
      ) : members.length === 0 ? (
        <StateMessage title="No members yet" />
      ) : (
        <Panel>
          <WorkforceList members={members} />
        </Panel>
      )}
    </>
  );
}
