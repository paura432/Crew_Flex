import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { evaluateRequirementMatches } from "@/features/matching/api";
import { MatchCard } from "@/features/matching/components/MatchCard";
import { getRequirement } from "@/features/requirements/api";
import { QualificationChips } from "@/features/requirements/components/RequirementBadges";
import { formatPeriod } from "@/lib/format";
import { requireOrganizationContext } from "@/server/session";

export const metadata: Metadata = { title: "Eligible professionals" };

export default async function RequirementMatchesPage({
  params,
}: PageProps<"/app/organization/requirements/[id]/matches">) {
  const { id } = await params;
  await requireOrganizationContext();
  const [requirementResult, matchesResult] = await Promise.all([
    getRequirement(id),
    evaluateRequirementMatches(id),
  ]);
  if (!requirementResult.ok) {
    if (
      requirementResult.error.code === "NOT_FOUND" ||
      requirementResult.error.code === "VALIDATION_ERROR"
    )
      notFound();
    return (
      <ApiErrorState error={requirementResult.error} requestId={requirementResult.requestId} />
    );
  }
  const { requirement } = requirementResult.data;
  const back = (
    <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>
      Back to requirement
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow="External network · matching preview"
        title={requirement.title}
        description={`${requirement.location} · ${formatPeriod(requirement.startsAt, requirement.endsAt)}. Hard requirements are filters: no score compensates a missing one.`}
        actions={back}
      />
      <div className="mb-6">
        <QualificationChips qualifications={requirement.qualifications} />
      </div>
      {!matchesResult.ok ? (
        <ApiErrorState error={matchesResult.error} requestId={matchesResult.requestId} />
      ) : matchesResult.data.candidates.length === 0 ? (
        <StateMessage
          title="No matchable professionals for these qualifications"
          description="Only professionals who chose to be matchable and hold at least one of the required qualifications are evaluated."
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-muted" role="status">
            <strong className="text-ink">{matchesResult.data.summary.eligible}</strong> eligible of{" "}
            {matchesResult.data.summary.evaluated} evaluated. Anonymous professionals are shown with
            a reference that is only valid for this requirement.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {matchesResult.data.candidates.map((item) => (
              <MatchCard key={item.candidate.id} item={item} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
