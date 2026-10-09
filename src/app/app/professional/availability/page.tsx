import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { AvailabilityTable } from "@/features/professional/components/ProfessionalSections";
import { loadProfessionalContext } from "@/features/professional/load";

export const metadata: Metadata = { title: "Availability" };

export default async function ProfessionalAvailabilityPage() {
  const { overview } = await loadProfessionalContext();
  if (!overview) return <StateMessage title="No professional profile" />;
  return (
    <>
      <PageHeader
        title="Availability"
        description="Time windows (UTC). Unavailable windows override available ones. Editing comes next."
      />
      <Panel>
        <AvailabilityTable windows={overview.availability} />
      </Panel>
    </>
  );
}
