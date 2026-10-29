import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { listRepresentationReviews } from "@/features/recruiter/api";
import { RepresentationReviewList } from "@/features/recruiter/components/RepresentationReviewList";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("representations") };
}

/**
 * Agencies' represented clients (D-12 provisional model, RECRUITER_MODEL §1 «verifiable representation»; T-130):
 * a platform admin records the evidence and activates a pending one. Platform admins only: the proxy answers 404 to
 * anyone else, this page re-checks, and the Edge Function and the DEFINER RPC check the platform role on their own.
 */
export default async function RepresentationsPage() {
  const actor = await requireSessionActor();
  if (actor.profile.platform_role !== "platform_admin") notFound();
  const [t, result] = await Promise.all([
    getTranslations("recruiter.review"),
    listRepresentationReviews(),
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
        <RepresentationReviewList items={result.data.clients} />
      )}
    </>
  );
}
