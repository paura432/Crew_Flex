import type { Metadata } from "next";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { getProfessionalProfile } from "@/features/professional/api";
import { ProfileForm } from "@/features/professional/components/ProfileForm";
import { requireSessionActor } from "@/server/session";

export const metadata: Metadata = { title: "Passport" };

export default async function ProfessionalProfilePage() {
  const actor = await requireSessionActor();
  if (actor.profile.account_type !== "professional") {
    return (
      <StateMessage
        title="No professional profile"
        description="The passport belongs to professional accounts."
      />
    );
  }
  const result = await getProfessionalProfile();

  return (
    <>
      <PageHeader
        eyebrow="My passport"
        title="Your profile, connected."
        description="What you update here is reflected in matching and in your dossier. Qualifications and availability have their own pages."
      />
      {result.ok ? (
        <ProfileForm profile={result.data.profile} />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
