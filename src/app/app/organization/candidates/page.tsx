import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ApiErrorState } from "@/components/ui/ApiErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StateMessage } from "@/components/ui/StateMessage";
import { DIRECTORY_PAGE_SIZE, utcDay } from "@/domain/directory";
import { isStaffingAgency } from "@/domain/recruiter";
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
  type DirectoryQuery,
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
  const [search, { organization, canManage }, t, tDashboard, tRecruiter] = await Promise.all([
    searchParams,
    requireOrganizationContext(),
    getTranslations("directory"),
    getTranslations("organization.dashboard"),
    getTranslations("recruiter"),
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
  // `?page=` past the end lands on the last page.
  if (result?.ok && result.data.total > 0 && query.page > pageCount(result.data.total)) {
    redirect(directoryHref(query, { page: pageCount(result.data.total) }));
  }
  const evaluable = open.ok ? evaluableAtRequestTime(open.data.requirements) : [];

  return (
    <>
      {/* v1.8 CandidateDirectory.jsx:20: «RED RECRUITER» for an agency, «RED PROFESIONAL» otherwise (ORG-08 #2). */}
      <PageHeader
        eyebrow={
          isStaffingAgency(organization.type) ? tRecruiter("directoryEyebrow") : t("eyebrow")
        }
        title={t("title")}
        description={t("description")}
      />
      <p className="mb-4 text-sm text-muted">{t("visibleNote")}</p>
      <EvaluateForm requirements={evaluable} />
      <DirectoryFilters query={query} errors={errors} />
      {result === null ? null : !result.ok ? (
        <ApiErrorState error={result.error} requestId={result.requestId} />
      ) : (
        <DirectoryResults data={result.data} query={query} />
      )}
    </>
  );
}

const pageCount = (total: number) => Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));

type DirectoryData = Extract<
  Awaited<ReturnType<typeof searchCandidateDirectory>>,
  { ok: true }
>["data"];

/** One page of the directory: the summary, the cards (or the empty state) and the pager. */
async function DirectoryResults({ data, query }: { data: DirectoryData; query: DirectoryQuery }) {
  const t = await getTranslations("directory");
  const pages = pageCount(data.total);
  return (
    <DirectoryView
      labels={{
        group: t("view.label"),
        compact: t("view.compact"),
        expanded: t("view.expanded"),
      }}
      summary={
        <p className="text-sm text-muted" role="status">
          {t.rich("summary", {
            total: data.total,
            page: data.page,
            pages,
            b: (chunks) => <strong className="text-ink">{chunks}</strong>,
          })}
        </p>
      }
    >
      {data.candidates.length === 0 ? (
        <StateMessage title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Position in the key: two visible professionals may (rarely) share a 40-bit ref (T-151). */}
          {data.candidates.map((candidate, index) => (
            // react-doctor-disable-next-line no-array-index-as-key -- refs may collide (T-151); the server-ordered page never reorders on the client
            <DirectoryCard key={`${index}:${candidate.ref}`} candidate={candidate} />
          ))}
        </div>
      )}
      {data.total > 0 && <DirectoryPager query={query} page={data.page} pages={pages} />}
    </DirectoryView>
  );
}
