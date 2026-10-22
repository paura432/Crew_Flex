import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listDocuments } from "@/features/documents/api";
import { DocumentWallet } from "@/features/documents/components/DocumentWallet";
import { walletView } from "@/features/documents/map";
import { listQualifications } from "@/features/qualifications/api";
import { notFound } from "next/navigation";
import { isDocumentWalletEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("documents") };
}

export default async function ProfessionalDocumentsPage({
  searchParams,
}: PageProps<"/app/professional/documents">) {
  if (!(await isDocumentWalletEnabled())) notFound();
  const [{ view: viewParam }, actor, t, tProfessional] = await Promise.all([
    searchParams,
    requireSessionActor(),
    getTranslations("documents"),
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
  const [documents, qualifications] = await Promise.all([listDocuments(), listQualifications()]);
  const today = new Date().toISOString().slice(0, 10);
  // v1.8 «Papelera» / «Ver wallet» (N-19); anything else is the wallet.
  const view = walletView(viewParam);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {documents.ok ? (
        <DocumentWallet
          key={view}
          view={view}
          trashRetentionDays={documents.data.trashRetentionDays}
          documents={documents.data.documents}
          // Linking is optional: if the qualifications cannot be loaded, the wallet still works.
          qualifications={
            qualifications.ok
              ? qualifications.data.qualifications.map((q) => ({
                  id: q.id,
                  label: `${q.type.code} · ${q.type.name}`,
                }))
              : []
          }
          today={today}
        />
      ) : (
        <ApiErrorState error={documents.error} requestId={documents.requestId} />
      )}
    </>
  );
}
