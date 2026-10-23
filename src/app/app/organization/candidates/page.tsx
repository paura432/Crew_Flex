import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { DIRECTORY_PAGE_SIZE, utcDay } from "@/domain/directory";
import type { WorkRequirement } from "@/domain/work-requirement";
import { searchCandidateDirectory } from "@/features/directory/api";
import { DirectoryCard } from "@/features/directory/components/DirectoryCard";
import {
  DirectoryFilters,
  DirectoryPager,
  EvaluateForm,
} from "@/features/directory/components/DirectoryFilters";
import { DirectoryView } from "@/features/directory/components/DirectoryView";
import {
  directoryHref,
  parseDirectoryQuery,
  toDirectorySearchParams,
} from "@/features/directory/query";
import { listRequirements } from "@/features/requirements/api";
import { currentRequirements } from "@/features/requirements/dashboard";
import { requireOrganizationContext } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("candidates") };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
/** The UTC day at request time: the one the database compares the availability window against. */
const todayUtc = () => utcDay(Date.now());
/** Open and not ended at request time (the dashboard's rule): the needs «Evaluar para la oferta» offers. */
const evaluableAtRequestTime = (requirements: WorkRequirement[]) =>
  currentRequirements(requirements, Date.now());

/**
 * v1.8 «Buscar candidatos» (v2-22 / v2-23; BR-28): the organization's free directory over its external
 * pool rules, 20 a page, the seven filters, «Compacta/Ampliada» and the profile dialog. Read-only: the page
 * runs no mutation (the organization-side block is not ported — v1.8 has none). Admins and managers only (a
 * member sees the same notice as the matches page); the Edge Function and the database re-check the role.
 */
export default async function CandidatesPage({
  searchParams,
}: PageProps<"/app/organization/candidates">) {
  const [search, { organization, canManage }, t, tDashboard] = await Promise.all([
    searchParams,
    requireOrganizationContext(),
    getTranslations("directory"),
    getTranslations("organization.dashboard"),
  ]);
  if (!canManage) {
    return (
      <StateMessage
        title={tDashboard("managersOnlyTitle")}
        description={tDashboard("managersOnlyDescription")}
      />
    );
  }
  // «Evaluar para la oferta»: the matches page of that need (404 there for another organization's id).
  const requirement = first(search.requirement);
  if (UUID.test(requirement)) redirect(`/app/organization/requirements/${requirement}/matches`);

  const { query, errors } = parseDirectoryQuery(search, todayUtc());
  const hasErrors = errors.window || errors.minYears;
  const [result, open] = await Promise.all([
    // v1.8: an invalid filter shows its error and no list (the search is not run).
    hasErrors ? null : searchCandidateDirectory(toDirectorySearchParams(organization.id, query)),
    listRequirements(organization.id, { status: "open", endsAfter: new Date().toISOString() }),
  ]);
  if (result?.ok && result.data.total > 0) {
    const last = Math.max(1, Math.ceil(result.data.total / DIRECTORY_PAGE_SIZE));
    if (query.page > last) redirect(directoryHref(query, { page: last }));
  }
  const evaluable = open.ok ? evaluableAtRequestTime(open.data.requirements) : [];
  const pages = result?.ok ? Math.max(1, Math.ceil(result.data.total / DIRECTORY_PAGE_SIZE)) : 1;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <p className="mb-4 text-sm text-muted">{t("visibleNote")}</p>
      <EvaluateForm requirements={evaluable} />
      <DirectoryFilters query={query} errors={errors} />
      {result === null ? null : !result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : (
        <DirectoryView
          labels={{
            group: t("view.label"),
            compact: t("view.compact"),
            expanded: t("view.expanded"),
          }}
          summary={
            <p className="text-sm text-muted" role="status">
              {t.rich("summary", {
                total: result.data.total,
                page: result.data.page,
                pages,
                b: (chunks) => <strong className="text-ink">{chunks}</strong>,
              })}
            </p>
          }
        >
          {result.data.candidates.length === 0 ? (
            <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Position in the key: two visible professionals may (rarely) share a 40-bit ref (T-151). */}
              {result.data.candidates.map((candidate, index) => (
                <DirectoryCard key={`${index}:${candidate.ref}`} candidate={candidate} />
              ))}
            </div>
          )}
          {result.data.total > 0 && (
            <DirectoryPager query={query} page={result.data.page} pages={pages} />
          )}
        </DirectoryView>
      )}
    </>
  );
}
