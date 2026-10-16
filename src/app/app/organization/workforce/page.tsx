import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listWorkforce } from "@/features/workforce/api";
import { WorkforceList } from "@/features/workforce/components/WorkforceList";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("workforce") };
}

export default async function WorkforcePage() {
  const [{ organization, canManage }, t, tCommon] = await Promise.all([
    requireOrganizationContext(),
    getTranslations("organization.workforce"),
    getTranslations("common"),
  ]);
  // OD-4: members' technician data is shared with admins/managers only (RLS enforces it too).
  const members = canManage ? await listWorkforce(organization.id) : null;

  return (
    <>
      <PageHeader eyebrow={organization.name} title={t("title")} description={t("description")} />
      {!canManage ? (
        <StateMessage title={t("managersOnlyTitle")} description={t("managersOnlyDescription")} />
      ) : members === null ? (
        <StateMessage tone="danger" title={t("errorTitle")} description={tCommon("reload")} />
      ) : members.length === 0 ? (
        <StateMessage title={t("empty")} />
      ) : (
        <Panel>
          <WorkforceList members={members} />
        </Panel>
      )}
    </>
  );
}
