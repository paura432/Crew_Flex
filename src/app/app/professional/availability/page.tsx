import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listAvailability } from "@/features/availability/api";
import { AvailabilityManager } from "@/features/availability/components/AvailabilityManager";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("availability") };
}

export default async function ProfessionalAvailabilityPage() {
  const [actor, t, tProfessional] = await Promise.all([
    requireSessionActor(),
    getTranslations("availability"),
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
  const result = await listAvailability();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {result.ok ? (
        <AvailabilityManager
          windows={result.data.windows}
          initialMonth={today.slice(0, 7)}
          today={today}
        />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
