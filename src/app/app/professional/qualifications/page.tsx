import type { Metadata } from "next";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listQualificationTypes, listQualifications } from "@/features/qualifications/api";
import { QualificationsManager } from "@/features/qualifications/components/QualificationsManager";
import { requireSessionActor } from "@/server/session";

export const metadata: Metadata = { title: "Qualifications" };

export default async function ProfessionalQualificationsPage() {
  const actor = await requireSessionActor();
  if (actor.profile.account_type !== "professional") {
    return (
      <StateMessage
        title="No professional profile"
        description="Qualifications belong to professional accounts."
      />
    );
  }
  const [result, catalog] = await Promise.all([listQualifications(), listQualificationTypes()]);

  return (
    <>
      <PageHeader
        eyebrow="My passport"
        title="Qualifications"
        description="Licences, type ratings, training and approvals, with issue and expiry dates. You declare; an authorized reviewer verifies. A course must stay valid through the last day of a requirement to pass its hard filter."
      />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : catalog === null ? (
        <StateMessage
          tone="danger"
          title="The qualification catalog could not be loaded"
          description="Reload the page. Your declarations are safe."
        />
      ) : (
        <QualificationsManager qualifications={result.data.qualifications} catalog={catalog} />
      )}
    </>
  );
}
