import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { QualificationTable } from "@/features/professional/components/ProfessionalSections";
import { loadProfessionalContext } from "@/features/professional/load";

export const metadata: Metadata = { title: "Qualifications" };

export default async function ProfessionalQualificationsPage() {
  const { overview } = await loadProfessionalContext();
  if (!overview) return <StateMessage title="No professional profile" />;
  return (
    <>
      <PageHeader
        title="Qualifications"
        description="Self-declared qualifications stay pending until verified. Only verified ones satisfy hard requirements."
      />
      <Panel>
        <QualificationTable qualifications={overview.qualifications} />
      </Panel>
    </>
  );
}
