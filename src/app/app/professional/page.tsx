import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { profileCompleteness } from "@/domain/professional";
import {
  COMPLETENESS_HINT,
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
  const completeness = profileCompleteness({
    profile: {
      displayName: actor.profile.display_name,
      baseLocation: overview.profile.base_location,
      yearsExperience: overview.profile.years_experience,
      visibility: overview.profile.visibility,
    },
    qualifications: overview.qualifications.map((q) => ({
      category: q.qualification_types.category,
      verificationStatus: q.verification_status,
      status: q.status,
    })),
    availableWindows: overview.availability.filter((w) => w.status === "available").length,
  });
  const nextStep = completeness.missing[0];

  return (
    <>
      <PageHeader eyebrow="Professional space" title={actor.profile.display_name} />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric
            label="Passport"
            value={`${completeness.percent}%`}
            detail={nextStep ? COMPLETENESS_HINT[nextStep] : "Complete"}
            tone={completeness.percent === 100 ? "ok" : "neutral"}
          />
          <Metric label="Qualifications" value={overview.qualifications.length} />
          <Metric label="Verified" value={verified} tone={verified > 0 ? "ok" : "neutral"} />
          <Metric label="Availability windows" value={overview.availability.length} />
          <Metric label="Visibility" value={visibility.label} detail={visibility.detail} />
        </dl>
        <Panel
          title="Profile"
          actions={<ButtonLink href="/app/professional/profile">Edit passport</ButtonLink>}
        >
          <ProfileFacts profile={overview.profile} />
        </Panel>
      </div>
    </>
  );
}
