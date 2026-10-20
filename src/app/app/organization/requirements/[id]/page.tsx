import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { evaluateRequirementCapacity } from "@/features/capacity/api";
import { CapacityOverview } from "@/features/capacity/components/CapacityOverview";
import { MatchCard } from "@/features/matching/components/MatchCard";
import { getRequirement } from "@/features/requirements/api";
import { CloseRequirement } from "@/features/requirements/components/CloseRequirement";
import { RequirementFacts } from "@/features/requirements/components/RequirementFacts";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirement") };
}

export default async function RequirementDetailPage({
  params,
}: PageProps<"/app/organization/requirements/[id]">) {
  const [{ id }, { canManage }, t, tDashboard] = await Promise.all([
    params,
    requireOrganizationContext(),
    getTranslations("organization.detail"),
    getTranslations("organization.dashboard"),
  ]);
  const result = await getRequirement(id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement } = result.data;
  const capacity = canManage ? await evaluateRequirementCapacity(requirement.id) : null;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={requirement.title} />
      <div className="space-y-6">
        <Panel>
          <RequirementFacts requirement={requirement} />
          {requirement.status === "closed" ? (
            <p className="mt-4 border-t border-line pt-4 text-sm text-muted">
              {t("close.closedNote")}
            </p>
          ) : (
            canManage && (
              <div className="mt-4 border-t border-line pt-4">
                <CloseRequirement id={requirement.id} />
              </div>
            )
          )}
        </Panel>
        {!capacity ? (
          <StateMessage
            title={tDashboard("managersOnlyTitle")}
            description={tDashboard("managersOnlyDescription")}
          />
        ) : !capacity.ok ? (
          <ApiErrorState error={capacity.error} requestId={capacity.requestId} />
        ) : (
          <>
            <CapacityOverview requirement={requirement} capacity={capacity.data.capacity} />
            <section aria-labelledby="internal-title">
              <h2 id="internal-title" className="mb-3 text-lg font-semibold tracking-tight">
                {t("internalWorkforce", { count: capacity.data.internal.length })}
              </h2>
              {capacity.data.internal.length === 0 ? (
                <StateMessage
                  title={t("noTechniciansTitle")}
                  description={t("noTechniciansDescription")}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {capacity.data.internal.map((item) => (
                    <MatchCard key={item.candidate.id} item={item} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
