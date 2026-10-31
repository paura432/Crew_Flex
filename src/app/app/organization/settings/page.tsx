import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { activityLabelKey } from "@/features/organizations/activity";
import { getOrganizationProfile } from "@/features/organizations/api";
import { OrganizationForm } from "@/features/organizations/components/OrganizationForm";
import { countryName } from "@/features/organizations/countries";
import type { Locale } from "@/i18n/config";
import { formatDate, formatDateTime } from "@/i18n/format";
import { translateKey } from "@/i18n/validation";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("organizationProfile") };
}

/**
 * «Organización» (v1.8 connected `#org`, OD-5 default): the organization's own data and its review
 * state. Every member reads it; only its admin edits (RLS + the function decide, not this page).
 * The review is registered from the platform's administration, never here.
 */
export default async function OrganizationSettingsPage() {
  const [{ organization }, t, tRoot, locale] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.profile"),
    getTranslations(),
    getLocale() as Promise<Locale>,
  ]);
  const result = await getOrganizationProfile(organization.id);
  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow={organization.name} title={t("title")} />
        <ApiErrorState error={result.error} requestId={result.requestId} />
      </>
    );
  }
  const { organization: org, canEdit, activity } = result.data;
  const reviewed = org.reviewStatus === "reviewed";
  const facts: [string, string][] = [
    [t("name"), org.name],
    [t("type"), tRoot(`auth.orgType.${org.type}`)],
    [t("taxId"), org.taxId ?? t("notGiven")],
    [t("country"), org.country ? countryName(locale, org.country) : t("notGiven")],
    [t("taxAddress"), org.taxAddress ?? t("notGiven")],
  ];
  const activityLabel = (action: string) => {
    const key = activityLabelKey(action);
    return key ? translateKey(tRoot, `organization.profile.${key}`) : action;
  };

  return (
    <>
      <PageHeader
        eyebrow={org.name}
        title={t("title")}
        description={t("description")}
        actions={
          <StatusChip tone={reviewed ? "ok" : "warn"}>
            {t(reviewed ? "statusReviewed" : "statusPending")}
          </StatusChip>
        }
      />
      <div className="space-y-6">
        <Panel title={t("reviewTitle")}>
          <p className="max-w-prose text-sm text-muted">
            {reviewed && org.reviewedAt
              ? t("reviewedOn", { date: formatDate(locale, org.reviewedAt) })
              : t("pendingText")}
          </p>
          <p className="mt-2 max-w-prose text-sm text-muted">{t("selfReviewNote")}</p>
        </Panel>
        <Panel title={t("dataTitle")}>
          {canEdit ? (
            <OrganizationForm organization={org} />
          ) : (
            <>
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold tracking-wide text-muted uppercase">
                      {label}
                    </dt>
                    <dd className="font-medium break-words">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm text-muted">{t("adminOnly")}</p>
            </>
          )}
        </Panel>
        {activity && (
          <Panel title={t("activity.title")}>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">{t("activity.empty")}</p>
            ) : (
              <ol className="divide-y divide-line text-sm">
                {activity.map((item, i) => (
                  // react-doctor-disable-next-line no-array-index-as-key -- read-only audit log rendered once on the server; never reordered
                  <li
                    key={`${item.at}-${i}`}
                    className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2"
                  >
                    <span className="font-medium">{activityLabel(item.action)}</span>
                    <span className="text-muted tabular-nums">
                      {formatDateTime(locale, item.at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 text-xs text-muted">{t("activity.note")}</p>
          </Panel>
        )}
      </div>
    </>
  );
}
