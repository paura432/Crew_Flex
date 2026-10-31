import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { evidenceByQualification } from "@/domain/documents";
import { listOwnDocumentLinks } from "@/features/documents/api";
import { listQualificationTypes, listQualifications } from "@/features/qualifications/api";
import { QualificationsManager } from "@/features/qualifications/components/QualificationsManager";
import { isDocumentWalletEnabled } from "@/server/feature-flags";
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
  const [result, catalog, walletEnabled] = await Promise.all([
    listQualifications(),
    listQualificationTypes(),
    isDocumentWalletEnabled(),
  ]);
  // Evidence line only when the wallet is on; nothing is asked from it otherwise.
  const links = walletEnabled ? await listOwnDocumentLinks() : null;
  const evidence = links ? evidenceByQualification(links) : undefined;
  // Server component: «today» is decided once, on the server (UTC), and sent as a prop.
  const today = new Date().toISOString().slice(0, 10);

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
        <QualificationsManager
          qualifications={result.data.qualifications}
          catalog={catalog}
          today={today}
          evidence={evidence}
        />
      )}
    </>
  );
}
