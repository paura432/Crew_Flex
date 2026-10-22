import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { StateMessage } from "@/components/ui/StateMessage";
import { listRequirements } from "@/features/requirements/api";
import { RequirementsList } from "@/features/requirements/components/RequirementsList";
import { RequirementsPager } from "@/features/requirements/components/RequirementsPager";
import {
  pageCount,
  pageOffset,
  parseRequirementsPage,
  REQUIREMENTS_PAGE_SIZE,
} from "@/features/requirements/pagination";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("requirements") };
}

export default async function RequirementsPage({
  searchParams,
}: PageProps<"/app/organization/requirements">) {
  const [{ page: pageParam }, { organization, canManage }, t, tDashboard] = await Promise.all([
    searchParams,
    requireOrganizationContext(),
    getTranslations("organization.requirements"),
    getTranslations("organization.dashboard"),
  ]);
  // Newest first, 20 per page: the old ascending 50-row read hid every need after the 50th.
  const page = parseRequirementsPage(pageParam);
  const result = await listRequirements(organization.id, {
    order: "created_desc",
    offset: pageOffset(page),
    limit: REQUIREMENTS_PAGE_SIZE,
  });
  const total = result.ok ? (result.data.total ?? result.data.requirements.length) : 0;
  // `?page=` past the end (hand-edited, or rows closed meanwhile) lands on the last page (X-04).
  if (total > 0 && page > pageCount(total)) {
    redirect(`/app/organization/requirements?page=${pageCount(total)}`);
  }
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
      ) : total === 0 ? (
        <StateMessage title={tDashboard("noRequirementsTitle")} action={newButton || undefined} />
      ) : (
        <Panel>
          <RequirementsList requirements={result.data.requirements} />
          <RequirementsPager page={page} pages={pageCount(total)} total={total} />
        </Panel>
      )}
    </>
  );
}
