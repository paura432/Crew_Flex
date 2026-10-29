import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { logbookToday } from "@/domain/logbook";
import { listLogbook } from "@/features/logbook/api";
import { LogbookManager } from "@/features/logbook/components/LogbookManager";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("logbook") };
}

export default async function ProfessionalLogbookPage({
  searchParams,
}: PageProps<"/app/professional/logbook">) {
  const [{ view: viewParam }, actor, t, tProfessional] = await Promise.all([
    searchParams,
    requireSessionActor(),
    getTranslations("logbook"),
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
  // v1.8 «Ver archivo» / «Ver activas»; anything else is the active list.
  const view = viewParam === "archived" ? "archived" : "active";
  const result = await listLogbook(view);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {result.ok ? (
        <LogbookManager
          key={view}
          entries={result.data.entries}
          total={result.data.total}
          view={view}
          today={logbookToday()}
        />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
