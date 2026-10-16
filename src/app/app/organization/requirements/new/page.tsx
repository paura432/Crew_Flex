import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listQualificationTypes } from "@/features/qualifications/api";
import { RequirementForm } from "@/features/requirements/components/RequirementForm";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("newRequirement") };
}

export default async function NewRequirementPage() {
  const [{ organization, canManage }, t, tCommon] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.new"),
    getTranslations("common"),
  ]);
  if (!canManage) {
    return (
      <StateMessage
        tone="danger"
        title={t("noPermissionTitle")}
        description={t("noPermissionDescription")}
      />
    );
  }
  const qualificationTypes = await listQualificationTypes();

  return (
    <>
      <PageHeader eyebrow={organization.name} title={t("title")} description={t("description")} />
      {qualificationTypes === null ? (
        <StateMessage
          tone="danger"
          title={t("catalogErrorTitle")}
          description={tCommon("reload")}
        />
      ) : (
        <Panel>
          <RequirementForm
            organizationId={organization.id}
            qualificationTypes={qualificationTypes}
          />
        </Panel>
      )}
    </>
  );
}
