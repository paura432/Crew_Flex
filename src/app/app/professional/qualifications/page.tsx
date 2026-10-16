import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listQualificationTypes, listQualifications } from "@/features/qualifications/api";
import { QualificationsManager } from "@/features/qualifications/components/QualificationsManager";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("qualifications") };
}

export default async function ProfessionalQualificationsPage() {
  const [actor, t, tProfessional] = await Promise.all([
    requireSessionActor(),
    getTranslations("qualifications"),
    getTranslations("professional"),
  ]);
  if (actor.profile.account_type !== "professional") {
    return (
      <StateMessage
        title={tProfessional("noProfileTitle")}
        description={t("noProfileDescription")}
      />
    );
  }
  const [result, catalog] = await Promise.all([listQualifications(), listQualificationTypes()]);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : catalog === null ? (
        <StateMessage
          tone="danger"
          title={t("catalogErrorTitle")}
          description={t("catalogErrorDescription")}
        />
      ) : (
        <QualificationsManager qualifications={result.data.qualifications} catalog={catalog} />
      )}
    </>
  );
}
