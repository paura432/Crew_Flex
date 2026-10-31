import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { NavIcon } from "@/components/layout/NavLinks";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { parseMonth } from "@/features/availability/calendar";
import { countOwnDocuments, listOwnDocumentExpiries } from "@/features/documents/api";
import { medalInputOf } from "@/features/professional/medals";
import { ProfessionalHero } from "@/features/professional/components/ProfessionalHero";
import { ProfileFacts } from "@/features/professional/components/ProfessionalSections";
import { UpcomingReviews } from "@/features/professional/components/UpcomingReviews";
import { upcomingReviews } from "@/features/professional/reviews";
import { ProfessionalActivity } from "@/features/applications/components/ProfessionalActivity";
import { activityCounts, loadActivity } from "@/features/applications/activity";
import { LearningAchievements } from "@/features/tools/components/LearningAchievements";
import { completenessOf } from "@/features/professional/completeness";
import { loadProfessionalContext } from "@/features/professional/load";
import { formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { isDocumentWalletEnabled } from "@/server/feature-flags";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("professional") };
}

export default async function ProfessionalOverviewPage({
  searchParams,
}: PageProps<"/app/professional">) {
  const [{ month: monthParam }, { actor, overview }, t, tDomain, tNav, locale, walletEnabled] =
    await Promise.all([
      searchParams,
      loadProfessionalContext(),
      getTranslations("professional"),
      getTranslations("domain"),
      getTranslations("nav"),
      getLocale() as Promise<Locale>,
      isDocumentWalletEnabled(),
    ]);
  if (!overview) {
    return <StateMessage title={t("noProfileTitle")} description={t("noProfileDescription")} />;
  }
  const today = new Date().toISOString().slice(0, 10);
  // V1.8 Badges «Documentos y cursos próximos a revisar» (TD-44): declared expiries within 60 days,
  // expired included, over active qualifications and (when the wallet is on) own documents. The
  // activity reads feed both the hero's counters and the section below (read once).
  const [[documents, documentCount], activity] = await Promise.all([
    walletEnabled
      ? Promise.all([listOwnDocumentExpiries(), countOwnDocuments()])
      : Promise.resolve([[], null] as const),
    loadActivity(),
  ]);
  const documentsFailed = documents === null;
  const toReview = upcomingReviews(overview.qualifications, documents, today);
  const active = overview.qualifications.filter((q) => q.status === "active");
  const verified = active.filter((q) => q.verification_status === "verified").length;
  const awaiting = active.filter((q) => q.verification_status === "pending").length;
  const rejected = active.filter((q) => q.verification_status === "rejected").length;
  // BR-11 / T-36: the ten v1.8 items; «Documento aportado» only while the wallet is on.
  const completeness = completenessOf(
    actor.profile.display_name,
    overview,
    documentCount,
    new Date(),
  );
  const nextStep = completeness.missing[0];
  const month = parseMonth(monthParam) ?? today.slice(0, 7);
  const windows = overview.availability.map((w) => ({
    id: w.id,
    startsAt: w.starts_at,
    endsAt: w.ends_at,
    status: w.status,
  }));
  const counts = activityCounts(activity);

  return (
    <>
      {/* V1.8 home: the promise as the heading (the `br` flows on phones, as v1.8 ≤ 390 px). */}
      <PageHeader
        eyebrow={t("overview.eyebrow")}
        title={t.rich("overview.headline", { br: () => <br className="max-sm:hidden" /> })}
        actions={
          <ButtonLink href="/app/tools">
            <NavIcon href="/app/tools" className="size-[18px]" />
            {tNav("tools")}
          </ButtonLink>
        }
      />
      <div className="space-y-6">
        {/* v1.8 order (T-161): [passport | month] → «Oportunidades para ti» → «Mis candidaturas». */}
        <ProfessionalActivity
          reads={activity}
          windows={windows}
          month={month}
          today={today}
          hero={
            <ProfessionalHero
              userId={actor.id}
              name={actor.profile.display_name}
              baseLocation={overview.profile.base_location}
              yearsExperience={overview.profile.years_experience}
              medals={medalInputOf(overview, today)}
              today={today}
              completeness={completeness}
              compatible={counts.compatible}
              confirmed={counts.confirmed}
            />
          }
        />
        {/* Next-only figures, folded below the v1.8 blocks. */}
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {/* Completeness of the profile items (BR-11) is not a verification status (8.2). */}
          <Metric
            label={t("overview.passport")}
            value={formatPercent(locale, completeness.percent)}
            detail={nextStep ? t(`hint.${nextStep}`) : t("overview.complete")}
            tone={completeness.percent === 100 ? "ok" : "neutral"}
          />
          {/* Held ones only: a withdrawn qualification is one the professional no longer has. */}
          <Metric label={t("overview.qualifications")} value={active.length} />
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
          <Metric label={t("activity.active")} value={counts.active ?? "—"} />
          <Metric
            label={t("activity.toAccept")}
            value={counts.toAccept ?? "—"}
            tone={counts.toAccept ? "warn" : "neutral"}
          />
        </dl>
        {(awaiting > 0 || rejected > 0) && (
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
            </ul>
          </Panel>
        )}
        <Panel title={t("overview.reviewTitle")}>
          <UpcomingReviews items={toReview} failed={documentsFailed} today={today} />
        </Panel>
        {/* V1.8 Badges «Logros de aprendizaje» (L-3): read from this browser, after hydration. */}
        <LearningAchievements userId={actor.id} />
        {/* «Estado de mi perfil» is the hero's dialog (N-18); the facts stay below. */}
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
