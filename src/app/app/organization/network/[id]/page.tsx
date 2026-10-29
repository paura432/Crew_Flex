import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getNetworkOpportunity } from "@/features/opportunities/api";
import { NETWORK_PATH } from "@/features/opportunities/view";
import { RequirementFacts } from "@/features/requirements/components/RequirementFacts";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("networkOpportunity") };
}

/**
 * v1.8 «Ver detalle» of «Ofertas en la red» (`JobDetails` for a company, without `FeeSummary`: never
 * another organization's commission, `✗`): the published facts and terms, no eligibility. Not
 * published (any more), the organization's own or missing: the same 404.
 */
export default async function NetworkOpportunityPage({
  params,
}: PageProps<"/app/organization/network/[id]">) {
  const [{ id }, , t, tDetail, tRecruiter] = await Promise.all([
    params,
    requireOrganizationContext(),
    getTranslations("hiring.network"),
    getTranslations("opportunities.detail"),
    getTranslations("recruiter.opportunity"),
  ]);
  const result = await getNetworkOpportunity(id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement } = result.data;
  return (
    <>
      <PageHeader
        eyebrow={t("detailEyebrow")}
        title={requirement.title}
        description={
          requirement.clientName
            ? tRecruiter("publishedFor", {
                organization: requirement.organizationName,
                client: requirement.clientName,
              })
            : tDetail("publishedBy", { organization: requirement.organizationName })
        }
        actions={<ButtonLink href={NETWORK_PATH}>{t("back")}</ButtonLink>}
      />
      <Panel>
        <RequirementFacts requirement={requirement} />
      </Panel>
    </>
  );
}
