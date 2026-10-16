import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { profileCompleteness, type CompletenessItem } from "@/domain/professional";
import { ProfileFacts } from "@/features/professional/components/ProfessionalSections";
import { loadProfessionalContext } from "@/features/professional/load";

/** Where each missing BR-11 item is completed. */
const NEXT_STEP_HREF: Record<CompletenessItem, string> = {
  display_name: "/app/professional/profile",
  base_location: "/app/professional/profile",
  years_experience: "/app/professional/profile",
  visibility: "/app/professional/profile",
  licence_or_rating: "/app/professional/qualifications",
  verified_qualification: "/app/professional/qualifications",
  availability: "/app/professional/availability",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("professional") };
}

export default async function ProfessionalOverviewPage() {
  const [{ actor, overview }, t, tDomain] = await Promise.all([
    loadProfessionalContext(),
    getTranslations("professional"),
    getTranslations("domain"),
  ]);
  if (!overview) {
    return <StateMessage title={t("noProfileTitle")} description={t("noProfileDescription")} />;
  }
  const active = overview.qualifications.filter((q) => q.status === "active");
  const verified = active.filter((q) => q.verification_status === "verified").length;
  const awaiting = active.filter((q) => q.verification_status === "pending").length;
  const rejected = active.filter((q) => q.verification_status === "rejected").length;
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
      <PageHeader eyebrow={t("overview.eyebrow")} title={actor.profile.display_name} />
      <div className="space-y-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {/* Completeness of the profile items (BR-11) is not a verification status (8.2). */}
          <Metric
            label={t("overview.passport")}
            value={`${completeness.percent}%`}
            detail={nextStep ? t(`hint.${nextStep}`) : t("overview.complete")}
            tone={completeness.percent === 100 ? "ok" : "neutral"}
          />
          <Metric label={t("overview.qualifications")} value={overview.qualifications.length} />
          <Metric
            label={t("overview.verified")}
            value={t("overview.verifiedOf", { verified, total: active.length })}
            detail={awaiting > 0 ? t("overview.awaiting", { count: awaiting }) : undefined}
            tone={
              active.length > 0 && verified === active.length
                ? "ok"
                : awaiting > 0
                  ? "warn"
                  : "neutral"
            }
          />
          <Metric label={t("overview.windows")} value={overview.availability.length} />
          <Metric
            className="col-span-2 lg:col-span-1"
            label={t("overview.visibility")}
            value={tDomain(`visibility.${overview.profile.visibility}.label`)}
            detail={tDomain(`visibility.${overview.profile.visibility}.detail`)}
          />
        </dl>
        {(awaiting > 0 || rejected > 0 || nextStep) && (
          <Panel title={t("overview.nextTitle")}>
            <ul className="space-y-3 text-sm">
              {rejected > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t("overview.rejectedNext", { count: rejected })}</span>
                  <ButtonLink href="/app/professional/qualifications">
                    {t("overview.openQualifications")}
                  </ButtonLink>
                </li>
              )}
              {awaiting > 0 && (
                <li className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t("overview.awaitingNext", { count: awaiting })}</span>
                </li>
              )}
              {nextStep && (
                <li className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t(`hint.${nextStep}`)}</span>
                  <ButtonLink href={NEXT_STEP_HREF[nextStep]}>{t("overview.doIt")}</ButtonLink>
                </li>
              )}
            </ul>
          </Panel>
        )}
        <Panel
          title={t("overview.profile")}
          actions={
            <ButtonLink href="/app/professional/profile">{t("overview.editPassport")}</ButtonLink>
          }
        >
          <ProfileFacts profile={overview.profile} />
        </Panel>
      </div>
    </>
  );
}
