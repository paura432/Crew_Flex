import type { Metadata } from "next";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import {
  ProfileFacts,
  VISIBILITY_COPY,
} from "@/features/professional/components/ProfessionalSections";
import { loadProfessionalContext } from "@/features/professional/load";

export const metadata: Metadata = { title: "Professional" };

export default async function ProfessionalOverviewPage() {
  const { actor, overview } = await loadProfessionalContext();
  if (!overview) {
    return (
      <StateMessage
        title="No professional profile"
        description="This account is an organization account."
      />
    );
  }
  const verified = overview.qualifications.filter(
    (q) => q.verification_status === "verified",
  ).length;
  const visibility = VISIBILITY_COPY[overview.profile.visibility];

  return (
    <>
      <PageHeader eyebrow="Professional space" title={actor.profile.display_name} />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Qualifications" value={overview.qualifications.length} />
          <Metric label="Verified" value={verified} tone={verified > 0 ? "ok" : "neutral"} />
          <Metric label="Availability windows" value={overview.availability.length} />
          <Metric label="Visibility" value={visibility.label} detail={visibility.detail} />
        </dl>
        <Panel title="Profile">
          <ProfileFacts profile={overview.profile} />
        </Panel>
      </div>
    </>
  );
}
