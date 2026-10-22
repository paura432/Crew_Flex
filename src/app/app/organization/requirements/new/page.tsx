import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { duplicateSchedule } from "@/domain/work-requirement";
import { listQualificationTypes } from "@/features/qualifications/api";
import { getRequirement } from "@/features/requirements/api";
import { RequirementForm } from "@/features/requirements/components/RequirementForm";
import { requireOrganizationContext } from "@/server/session";
import { z } from "@/lib/validation/zod";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("newRequirement") };
}

/** Request time (dynamic page): the copy starts 45 days from today (v1.8 `duplicate`). */
const nowMs = () => Date.now();

/**
 * New requirement; `?from=<id>` opens the builder prefilled with a copy of one of the organization's
 * requirements (v1.8 «Duplicar», v2-14, T-65) — nothing is saved until the organization saves it.
 */
export default async function NewRequirementPage({
  searchParams,
}: PageProps<"/app/organization/requirements/new">) {
  const [{ from }, { organization, canManage }, t, tCommon] = await Promise.all([
    searchParams,
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
  const sourceId = z.uuid().safeParse(from);
  const [qualificationTypes, source] = await Promise.all([
    listQualificationTypes(),
    sourceId.success ? getRequirement(sourceId.data) : null,
  ]);
  // Someone else's or a missing requirement is simply not copied (RLS hides it; no oracle either way).
  const original =
    source?.ok && source.data.requirement.organizationId === organization.id
      ? source.data.requirement
      : null;
  const copy = original ? duplicateSchedule(original, nowMs(), t("copyPrefix")) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={original ? t("copyTitle") : t("title")}
        description={original ? t("copyDescription", { title: original.title }) : t("description")}
      />
      {qualificationTypes === null ? (
        <StateMessage
          tone="danger"
          title={t("catalogErrorTitle")}
          description={tCommon("reload")}
        />
      ) : (
        <RequirementForm
          organizationId={organization.id}
          qualificationTypes={qualificationTypes}
          copyOf={copy}
        />
      )}
    </>
  );
}
