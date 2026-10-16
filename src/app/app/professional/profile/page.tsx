import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { getProfessionalProfile } from "@/features/professional/api";
import { ProfileForm } from "@/features/professional/components/ProfileForm";
import { requireSessionActor } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("passport") };
}

export default async function ProfessionalProfilePage() {
  const [actor, t] = await Promise.all([requireSessionActor(), getTranslations("professional")]);
  if (actor.profile.account_type !== "professional") {
    return (
      <StateMessage title={t("noProfileTitle")} description={t("passport.noProfileDescription")} />
    );
  }
  const result = await getProfessionalProfile();

  return (
    <>
      <PageHeader
        eyebrow={t("passport.eyebrow")}
        title={t("passport.title")}
        description={t("passport.description")}
      />
      {result.ok ? (
        <ProfileForm profile={result.data.profile} />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
