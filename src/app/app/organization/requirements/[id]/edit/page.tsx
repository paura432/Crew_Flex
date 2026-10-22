import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listRequirementApplications } from "@/features/applications/api";
import { listQualificationTypes } from "@/features/qualifications/api";
import { getRequirement } from "@/features/requirements/api";
import { RequirementForm } from "@/features/requirements/components/RequirementForm";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirementEdit") };
}

/**
 * Edit a requirement (M05, owner 2026-10-22): only while it never received an application and is not
 * closed; the database refuses anything else (CFA12, frozen closed) — this page only says so first.
 */
export default async function EditRequirementPage({
  params,
}: PageProps<"/app/organization/requirements/[id]/edit">) {
  const [{ id }, { organization, canManage }, t, tNew, tCommon] = await Promise.all([
    params,
    requireOrganizationContext(),
    getTranslations("organization.detail"),
    getTranslations("organization.new"),
    getTranslations("common"),
  ]);
  if (!canManage) {
    return (
      <StateMessage
        tone="danger"
        title={tNew("noPermissionTitle")}
        description={tNew("noPermissionDescription")}
      />
    );
  }
  const [result, applications, qualificationTypes] = await Promise.all([
    getRequirement(id),
    listRequirementApplications(id),
    listQualificationTypes(),
  ]);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION_ERROR") notFound();
    return <ApiErrorState error={result.error} requestId={result.requestId} />;
  }
  const { requirement } = result.data;
  if (requirement.organizationId !== organization.id) notFound();
  const back = (
    <ButtonLink href={`/app/organization/requirements/${requirement.id}`}>
      {tCommon("cancel")}
    </ButtonLink>
  );
  const locked =
    requirement.status === "closed" ||
    !applications.ok ||
    applications.data.applications.length > 0;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("edit")} description={requirement.title} />
      {locked ? (
        <StateMessage
          title={requirement.status === "closed" ? t("close.closedNote") : tNew("hasApplications")}
          action={back}
        />
      ) : qualificationTypes === null ? (
        <StateMessage
          tone="danger"
          title={tNew("catalogErrorTitle")}
          description={tCommon("reload")}
        />
      ) : (
        <Panel>
          <RequirementForm
            organizationId={organization.id}
            qualificationTypes={qualificationTypes}
            initial={requirement}
          />
        </Panel>
      )}
    </>
  );
}
