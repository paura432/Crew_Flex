import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/Button";
import { Metric } from "@/components/ui/Metric";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { EXPIRY_TONE, StatusChip } from "@/components/ui/StatusChip";
import { documentExpiryState, isDueForReview, REVIEW_WINDOW_DAYS } from "@/domain/documents";
import {
  COMPLETENESS_ITEMS,
  profileCompleteness,
  type CompletenessItem,
} from "@/domain/professional";
import { parseMonth } from "@/features/availability/calendar";
import { AvailabilityMonth } from "@/features/availability/components/AvailabilityMonth";
import { listOwnDocumentExpiries } from "@/features/documents/api";
import { IdentityCard } from "@/features/professional/components/IdentityCard";
import { ProfileFacts } from "@/features/professional/components/ProfessionalSections";
import { ProfessionalActivity } from "@/features/applications/components/ProfessionalActivity";
import { loadProfessionalContext } from "@/features/professional/load";
import { formatDate, formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/config";
import { isDocumentWalletEnabled } from "@/server/feature-flags";

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
  // expired included, over active qualifications and (when the wallet is on) own documents.
  const documents = walletEnabled ? await listOwnDocumentExpiries() : [];
  const documentsFailed = documents === null;
  const toReview = [
    ...overview.qualifications
      .filter((q) => q.status === "active" && q.expires_at !== null)
      .map((q) => ({
        key: `q-${q.id}`,
        title: `${q.qualification_types.code} · ${q.qualification_types.name}`,
        expiresAt: q.expires_at as string,
        href: "/app/professional/qualifications",
      })),
    ...(documents ?? []).map((d) => ({
      key: `d-${d.id}`,
      title: d.title,
      expiresAt: d.expiresAt,
      href: "/app/professional/documents",
    })),
  ]
    .filter((item) => isDueForReview(item.expiresAt, today))
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
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
    // BR-11: «AOG only» is published availability too (BR-4.8).
    availableWindows: overview.availability.filter((w) => w.status !== "unavailable").length,
  });
  const nextStep = completeness.missing[0];
  const month = parseMonth(monthParam) ?? today.slice(0, 7);
  const windows = overview.availability.map((w) => ({
    id: w.id,
    startsAt: w.starts_at,
    endsAt: w.ends_at,
    status: w.status,
  }));

  return (
    <>
      {/* V1.8 home: the promise as the heading, the person in the identity card below. */}
      <PageHeader
        eyebrow={t("overview.eyebrow")}
        title={t.rich("overview.headline", { br: () => <br /> })}
        actions={<ButtonLink href="/app/tools">{tNav("tools")}</ButtonLink>}
      />
      <div className="space-y-6">
        <IdentityCard
          name={actor.profile.display_name}
          baseLocation={overview.profile.base_location}
          yearsExperience={overview.profile.years_experience}
        />
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
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
        </dl>
        <ProfessionalActivity />
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
          {documentsFailed && (
            <p className="mb-3 text-sm text-danger" role="alert">
              {t("overview.reviewError")}
            </p>
          )}
          {toReview.length === 0 ? (
            <p className="text-sm text-muted">
              {t("overview.reviewNone", { days: REVIEW_WINDOW_DAYS })}
            </p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {toReview.map((item) => {
                const expired = documentExpiryState(item.expiresAt, today) === "expired";
                return (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <span>
                      <span className="font-semibold">{item.title}</span> ·{" "}
                      <span className="tabular-nums">{formatDate(locale, item.expiresAt)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <StatusChip tone={EXPIRY_TONE[expired ? "expired" : "soon"]}>
                        {expired
                          ? t("overview.reviewExpired")
                          : t("overview.reviewSoon", { days: REVIEW_WINDOW_DAYS })}
                      </StatusChip>
                      <ButtonLink
                        href={item.href}
                        aria-label={`${t("overview.reviewOpen")} · ${item.title}`}
                      >
                        {t("overview.reviewOpen")}
                      </ButtonLink>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">{t("overview.reviewHint")}</p>
        </Panel>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* V1.8 «Estado de mi perfil»: every BR-11 item with a direct link to complete it. */}
          <Panel title={t("overview.checklistTitle", { percent: completeness.percent })}>
            {/* V1.8 hides the progress from 95 %; with 7 items that is 100 %. The list stays one click away. */}
            {completeness.percent < 100 && (
              <div className="mb-3">
                <p className="text-sm font-semibold">
                  {t("overview.progressLead", { percent: completeness.percent })}
                </p>
                <progress
                  max={100}
                  value={completeness.percent}
                  aria-label={t("overview.progressLabel", { percent: completeness.percent })}
                  className="mt-2 h-2 w-full accent-accent"
                />
                <p className="mt-1 text-sm text-muted">
                  {t("overview.toComplete", { count: completeness.missing.length })}
                </p>
              </div>
            )}
            <p className="mb-3 text-xs text-muted">{t("overview.progressNote")}</p>
            <details open={completeness.percent < 100} className="group">
              <summary className="flex cursor-pointer items-center text-sm font-semibold text-blue pointer-coarse:min-h-11">
                {t("overview.showChecklist", { count: COMPLETENESS_ITEMS.length })}
              </summary>
              <ul className="divide-y divide-line text-sm">
                {COMPLETENESS_ITEMS.map((item) => {
                  const done = !completeness.missing.includes(item);
                  return (
                    <li
                      key={item}
                      className="flex flex-wrap items-center justify-between gap-3 py-2"
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden className={done ? "font-bold text-ok" : "text-muted"}>
                          {done ? "✓" : "○"}
                        </span>
                        <span className={done ? "text-muted" : undefined}>{t(`item.${item}`)}</span>
                        <span className="sr-only">
                          {done ? t("overview.itemDone") : t("overview.itemPending")}
                        </span>
                      </span>
                      {!done && (
                        <ButtonLink href={NEXT_STEP_HREF[item]}>{t("overview.doIt")}</ButtonLink>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          </Panel>
          <Panel
            title={t("overview.calendarTitle")}
            actions={
              <ButtonLink href={`/app/professional/availability?month=${month}`}>
                {t("overview.openAvailability")}
              </ButtonLink>
            }
          >
            <AvailabilityMonth
              windows={windows}
              month={month}
              today={today}
              hrefFor={(m) => `/app/professional?month=${m}`}
            />
          </Panel>
        </div>
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
