import type { Metadata } from "next";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { listAvailability } from "@/features/availability/api";
import { AvailabilityManager } from "@/features/availability/components/AvailabilityManager";
import { requireSessionActor } from "@/server/session";

export const metadata: Metadata = { title: "Availability" };

export default async function ProfessionalAvailabilityPage() {
  const actor = await requireSessionActor();
  if (actor.profile.account_type !== "professional") {
    return (
      <StateMessage
        title="No professional profile"
        description="Availability belongs to professional accounts."
      />
    );
  }
  const result = await listAvailability();
  const initialMonth = new Date().toISOString().slice(0, 7);

  return (
    <>
      <PageHeader
        eyebrow="My time"
        title="Chosen availability"
        description="A free day only enters the market when you mark it as available. Times are UTC; blocked windows override available ones."
      />
      {result.ok ? (
        <AvailabilityManager windows={result.data.windows} initialMonth={initialMonth} />
      ) : (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      )}
    </>
  );
}
