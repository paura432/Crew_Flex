import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { MatchExplanation } from "@/features/matching/components/MatchCard";
import { getOpportunity } from "@/features/opportunities/api";
import { ApplyPanel } from "@/features/opportunities/components/ApplyPanel";
import { RequirementFacts } from "@/features/requirements/components/RequirementFacts";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("opportunity") };
}

/**
 * One published requirement as a professional sees it (D-12): its facts, the organization's name,
 * the caller's own eligibility with every failed rule explained, and the application step.
 */
export default async function OpportunityPage({
  params,
}: PageProps<"/app/professional/opportunities/[id]">) {
  const [{ id }, actor, t] = await Promise.all([
    params,
    requireSessionActor(),
    getTranslations("opportunities.detail"),
  ]);
  if (actor.profile.account_type !== "professional") notFound();
  const result = await getOpportunity(id);
  if (!result.ok) {
    // Not published (paused, closed, ended), someone else's draft or nonexistent: all the same.
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement, match, myApplication, applyBlocker } = result.data.opportunity;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={requirement.title}
        description={t("publishedBy", { organization: requirement.organizationName })}
        actions={<ButtonLink href="/app/professional/opportunities">{t("back")}</ButtonLink>}
      />
      <div className="space-y-6">
        <Panel>
          <RequirementFacts requirement={requirement} />
        </Panel>
        <Panel title={t("eligibilityTitle")}>
          <StatusChip tone={match.eligible ? "ok" : "danger"}>
            {match.eligible ? t("eligible") : t("notEligible")}
          </StatusChip>
          <MatchExplanation match={match} />
          <p className="mt-3 text-xs text-muted">{t("eligibilityNote")}</p>
        </Panel>
        {/* «Preparar candidatura» on the list card lands here (v2-26). */}
        <div id="apply" className="scroll-mt-4">
          <Panel title={t("applyTitle")}>
            <ApplyPanel
              requirementId={requirement.id}
              organizationName={requirement.organizationName}
              blocker={applyBlocker}
              myStatus={myApplication?.status ?? null}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
