import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { getPackPreview } from "@/features/applications/api";
import { CandidatePackView } from "@/features/applications/components/CandidatePackView";
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
  const [{ id }, actor, t, tPack] = await Promise.all([
    params,
    requireSessionActor(),
    getTranslations("opportunities.detail"),
    getTranslations("candidatePack"),
  ]);
  if (actor.profile.account_type !== "professional") notFound();
  // The preview is the caller's own data: read it alongside, used only when they may apply.
  const [result, preview] = await Promise.all([getOpportunity(id), getPackPreview()]);
  if (!result.ok) {
    // Not published (paused, closed, ended), someone else's draft or nonexistent: all the same.
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement, match, myApplication, applyBlocker } = result.data.opportunity;
  // v2-15/v2-04 «Qué compartes»: the copy the organization would receive, shown before the consent (T-111).
  const previewTitleId = "pack-preview-title";
  const packPreview =
    !applyBlocker && preview.ok ? (
      <section
        aria-labelledby={previewTitleId}
        className="rounded-lg border border-line bg-canvas px-4 py-3"
      >
        <h3 id={previewTitleId} className="mb-2 text-base font-semibold tracking-tight">
          {tPack("previewTitle", { organization: requirement.organizationName })}
        </h3>
        <CandidatePackView
          pack={preview.data.pack}
          mode="preview"
          intro={tPack("previewIntro", { organization: requirement.organizationName })}
        />
      </section>
    ) : null;

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
              packPreview={packPreview}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
