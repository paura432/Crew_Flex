import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listAvailability } from "@/features/availability/api";
import { listMyApplications } from "@/features/applications/api";
import { assignmentDays, parseMonth } from "@/features/availability/calendar";
import { AvailabilityManager } from "@/features/availability/components/AvailabilityManager";
import { getMySessions } from "@/features/training/api";
import { isTrainingEnabled } from "@/server/feature-flags";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("availability") };
}

export default async function ProfessionalAvailabilityPage({
  searchParams,
}: PageProps<"/app/professional/availability">) {
  const [{ month: monthParam }, actor, t, tProfessional] = await Promise.all([
    searchParams,
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
  const [result, applications, sessions] = await Promise.all([
    listAvailability(),
    listMyApplications(),
    isTrainingEnabled().then((on) => (on ? getMySessions() : null)),
  ]);
  // Confirmed assignments are shown on their days (v1.8 «Asignado»); a failed read just omits them.
  const assigned = applications.ok
    ? [
        ...assignmentDays(
          applications.data.applications
            .filter((a) => a.status === "confirmed")
            .map((a) => a.requirement),
        ),
      ]
    : [];
  // v1.9 «F» (V19-029): days with a confirmed training session; marked, not protected. A failed read omits them.
  const training = sessions?.ok ? [...assignmentDays(sessions.data.sessions)] : [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {result.ok ? (
        <AvailabilityManager
          windows={result.data.windows}
          rotation={result.data.rotation}
          version={result.data.version}
          initialMonth={parseMonth(monthParam) ?? today.slice(0, 7)}
          today={today}
          assignedDays={assigned}
          trainingDays={training}
        />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
