import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import {
  ProfileFacts,
  VISIBILITY_COPY,
} from "@/features/professional/components/ProfessionalSections";
import { loadProfessionalContext } from "@/features/professional/load";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfessionalProfilePage() {
  const { overview } = await loadProfessionalContext();
  if (!overview) return <StateMessage title="No professional profile" />;
  return (
    <>
      <PageHeader
        title="Profile"
        description="Editing your profile and visibility comes in the next phase."
      />
      <div className="space-y-6">
        <Panel title="Professional data">
          <ProfileFacts profile={overview.profile} />
        </Panel>
        <Panel title="Visibility">
          <p className="font-semibold">{VISIBILITY_COPY[overview.profile.visibility].label}</p>
          <p className="text-muted">{VISIBILITY_COPY[overview.profile.visibility].detail}</p>
        </Panel>
      </div>
    </>
  );
}
