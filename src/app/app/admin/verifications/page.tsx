import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StatusChip } from "@/components/ui/StatusChip";
import { getReviewQueue } from "@/features/reviews/api";
import { ReviewQueue } from "@/features/reviews/components/ReviewQueue";
import type { Locale } from "@/i18n/config";
import { formatDateTime } from "@/i18n/format";
import { canOpenQualificationReview, isQualificationReviewEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("verifications") };
}

/**
 * Platform-admin review queue (phase 6). Not a public page: while the review is disabled (OD-3,
 * server-side flag, off by default) everyone gets a 404 before any session or Edge Function call;
 * when enabled, anyone but a platform admin still gets a 404, and the Edge Function + RPC refuse
 * them anyway.
 */
export default async function VerificationsPage() {
  if (!isQualificationReviewEnabled()) notFound();
  const actor = await requireSessionActor();
  if (!canOpenQualificationReview(actor.profile)) notFound();
  const [t, locale, result] = await Promise.all([
    getTranslations("admin.reviews"),
    getLocale() as Promise<Locale>,
    getReviewQueue(),
  ]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <p className="mb-6 rounded-lg border border-line bg-info-bg px-4 py-3 text-sm text-blue">
        {t("evidenceNote")}
      </p>
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="pending-heading">
            <h2 id="pending-heading" className="mb-3 text-base font-semibold">
              {t("pendingTitle", { count: result.data.pending.length })}
            </h2>
            <ReviewQueue items={result.data.pending} />
          </section>
          <Panel title={t("historyTitle")}>
            {result.data.recent.length === 0 ? (
              <p className="text-sm text-muted">{t("historyEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <caption className="sr-only">{t("historyTitle")}</caption>
                  <thead className="bg-canvas text-[11px] text-muted">
                    <tr>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        {t("when")}
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        {t("decision")}
                      </th>
                      <th scope="col" className="py-2 pr-4 font-medium">
                        {t("reasonGiven")}
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        {t("reference")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.recent.map((event) => (
                      <tr
                        key={`${event.qualificationId}-${event.at}`}
                        className="border-t border-line"
                      >
                        <td className="py-2 pr-4 whitespace-nowrap">
                          {formatDateTime(locale, event.at)}
                        </td>
                        <td className="py-2 pr-4">
                          <StatusChip tone={event.decision === "verified" ? "ok" : "danger"}>
                            {t(
                              event.decision === "verified"
                                ? "decisionVerified"
                                : "decisionRejected",
                            )}
                          </StatusChip>
                        </td>
                        <td className="py-2 pr-4">{event.noteProvided ? t("yes") : t("no")}</td>
                        <td className="py-2 font-mono text-xs text-muted">
                          {event.requestId ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
