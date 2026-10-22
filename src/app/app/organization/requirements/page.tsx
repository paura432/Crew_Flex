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
  const [{ page: pageParam, archived }, { organization, canManage }, t, tDashboard, tArchive] =
    await Promise.all([
      searchParams,
      requireOrganizationContext(),
      getTranslations("organization.requirements"),
      getTranslations("organization.dashboard"),
      getTranslations("organization.detail.archive"),
    ]);
  // v1.8 «Archivada» (T-64): archived requirements leave the working list and have their own view.
  const archivedView = archived === "1";
  const base = archivedView ? "/app/organization/requirements?archived=1" : undefined;
  // Newest first, 20 per page: the old ascending 50-row read hid every need after the 50th.
  const page = parseRequirementsPage(pageParam);
  const result = await listRequirements(organization.id, {
    order: "created_desc",
    archived: archivedView ? "only" : "exclude",
    offset: pageOffset(page),
    limit: REQUIREMENTS_PAGE_SIZE,
  });
  const total = result.ok ? (result.data.total ?? result.data.requirements.length) : 0;
  // `?page=` past the end (hand-edited, or rows closed meanwhile) lands on the last page (X-04).
  if (total > 0 && page > pageCount(total)) {
    redirect(`${base ? `${base}&` : "/app/organization/requirements?"}page=${pageCount(total)}`);
  }
  const newButton = canManage && (
    <ButtonLink href="/app/organization/requirements/new" variant="primary">
      {tDashboard("newRequirement")}
    </ButtonLink>
  );
  const viewToggle = (
    <ButtonLink
      href={
        archivedView
          ? "/app/organization/requirements"
          : "/app/organization/requirements?archived=1"
      }
    >
      {archivedView ? tArchive("listBack") : tArchive("listLink")}
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        eyebrow={organization.name}
        title={archivedView ? tArchive("listTitle") : t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            {viewToggle}
            {newButton}
          </div>
        }
      />
      {!result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : total === 0 ? (
        <StateMessage
          title={archivedView ? tArchive("emptyTitle") : tDashboard("noRequirementsTitle")}
          action={(archivedView ? viewToggle : newButton) || undefined}
        />
      ) : (
        <Panel>
          <RequirementsList requirements={result.data.requirements} />
          <RequirementsPager page={page} pages={pageCount(total)} total={total} base={base} />
        </Panel>
      )}
    </>
  );
}
