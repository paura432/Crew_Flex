import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listRequirements } from "@/features/requirements/api";
import { RequirementsList } from "@/features/requirements/components/RequirementsList";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirements") };
}

export default async function RequirementsPage() {
  const [{ organization, canManage }, t, tDashboard] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.requirements"),
    getTranslations("organization.dashboard"),
  ]);
  const result = await listRequirements(organization.id);
  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      {tDashboard("newRequirement")}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={t("title")}
        description={t("description")}
        actions={newButton}
      />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : result.data.requirements.length === 0 ? (
        <StateMessage title={tDashboard("noRequirementsTitle")} action={newButton || undefined} />
      ) : (
        <Panel>
          <RequirementsList requirements={result.data.requirements} />
        </Panel>
      )}
    </>
  );
}
