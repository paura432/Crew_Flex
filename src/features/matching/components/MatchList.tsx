import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { StatusChip } from "@/components/ui/StatusChip";
import type { Locale } from "@/i18n/config";
import { formatPercent } from "@/i18n/format";
import type { EvaluatedCandidate } from "@/types/api";
import { explainAvailability, explainCheck } from "../explain";
import { MAX_COMPARE, MATCH_SORTS, type MatchListQuery } from "../list";

/** `?…` for the same page with some params replaced (plain links: works without JavaScript). */
export function matchListHref(base: string, query: MatchListQuery, over: Partial<MatchListQuery>) {
  const next = { ...query, ...over };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  // «Solo elegibles» is the default (v2-25): only «off» is written.
  if (!next.eligibleOnly) params.set("eligible", "0");
  if (next.sort !== "relevance") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  for (const id of next.compare) params.append("compare", id);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** Search, eligible-only and sort as a native GET form; the compare selection is kept. */
export async function MatchListControls({ query, base }: { query: MatchListQuery; base: string }) {
  const t = await getTranslations("organization.matches.list");
  return (
    <form
      method="get"
      role="search"
      className="mb-4 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-end"
    >
      {query.compare.map((id) => (
        <input key={id} type="hidden" name="compare" value={id} />
      ))}
      <label className="text-sm font-semibold">
        {t("search")}
        <input
          name="q"
          type="search"
          defaultValue={query.q}
          placeholder={t("searchPlaceholder")}
          className={`${controlClass} mt-1 font-normal`}
        />
      </label>
      <label className="text-sm font-semibold">
        {t("sort")}
        <select
          name="sort"
          defaultValue={query.sort}
          className={`${controlClass} mt-1 font-normal`}
        >
          {MATCH_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`sortBy.${sort}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-10 pointer-coarse:min-h-11 items-center gap-2 text-sm">
        {/* Unticked sends only this one: off. Ticked sends both; `1` wins (parseMatchListQuery). */}
        <input type="hidden" name="eligible" value="0" />
        <input type="checkbox" name="eligible" value="1" defaultChecked={query.eligibleOnly} />
        {t("eligibleOnly")}
      </label>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary")}>
          {t("apply")}
        </button>
        <Link href={base} className={buttonClass()}>
          {t("clear")}
        </Link>
      </div>
    </form>
  );
}

/**
 * Checkbox bound to the compare form (`form` attribute), so it can sit inside each card. Once 3 are
 * selected the others are disabled (V1.8 `CandidateDirectory`); the name says which candidate it is.
 */
export async function CompareToggle({
  id,
  checked,
  full,
}: {
  id: string;
  checked: boolean;
  full: boolean;
}) {
  const t = await getTranslations("organization.matches.list");
  return (
    <label className="mt-3 flex min-h-8 pointer-coarse:min-h-11 items-center gap-2 text-sm text-muted">
      <input
        // Remount when the selection changes: after a soft navigation (e.g. «Clear comparison») an
        // uncontrolled checkbox would otherwise keep its old ticked state and be submitted again.
        key={String(checked)}
        type="checkbox"
        form="compare-form"
        name="compare"
        value={id}
        defaultChecked={checked}
        disabled={full && !checked}
        aria-label={t("compareCandidate", { ref: id })}
      />
      {t("compareThis")}
    </label>
  );
}

/**
 * Submits the selection; keeps the current filters and the candidates selected on other pages or
 * hidden by the filter (their checkboxes are not on this page). More than 3 → the first 3 are compared.
 */
export async function CompareForm({
  query,
  selectedIds,
  visibleIds,
}: {
  query: MatchListQuery;
  /** Selected ids that exist in the pool (stale or forged ids are dropped here). */
  selectedIds: string[];
  visibleIds: string[];
}) {
  const t = await getTranslations("organization.matches.list");
  return (
    <form id="compare-form" method="get" className="flex flex-wrap items-center gap-3">
      {query.q && <input type="hidden" name="q" value={query.q} />}
      {!query.eligibleOnly && <input type="hidden" name="eligible" value="0" />}
      {query.sort !== "relevance" && <input type="hidden" name="sort" value={query.sort} />}
      {query.page > 1 && <input type="hidden" name="page" value={query.page} />}
      {selectedIds
        .filter((id) => !visibleIds.includes(id))
        .map((id) => (
          <input key={id} type="hidden" name="compare" value={id} />
        ))}
      <button type="submit" className={buttonClass()}>
        {t("compareSubmit", { max: MAX_COMPARE })}
      </button>
    </form>
  );
}

/** Side-by-side view of up to 3 candidates: verdict, facts, each required qualification, availability. */
export async function CompareTable({
  items,
  truncated,
  clearHref,
}: {
  items: EvaluatedCandidate[];
  truncated: boolean;
  clearHref: string;
}) {
  const [t, tm, locale] = await Promise.all([
    getTranslations("organization.matches.list"),
    getTranslations("matching"),
    getLocale() as Promise<Locale>,
  ]);
  const labels = [
    ...new Set(items.flatMap((i) => i.match.qualificationChecks.map((c) => explainCheck(c).label))),
  ];
  const cell = (item: EvaluatedCandidate, label: string) => {
    const check = item.match.qualificationChecks.map(explainCheck).find((c) => c.label === label);
    return check ? (check.met ? "✓" : "✗") : "—";
  };
  return (
    <section
      aria-labelledby="compare-title"
      className="mb-6 rounded-xl border border-line bg-white p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="compare-title" className="font-semibold">
          {t("compareTitle", { count: items.length })}
        </h2>
        <Link
          href={clearHref}
          className="inline-flex items-center text-sm font-semibold text-blue hover:underline pointer-coarse:min-h-11"
        >
          {t("compareClear")}
        </Link>
      </div>
      {truncated && (
        <p role="status" className="mb-2 text-sm text-warn">
          {t("compareTruncated", { max: MAX_COMPARE })}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-canvas text-[11px] font-semibold text-muted">
            <tr>
              <th scope="col" className="py-2 pr-3">
                <span className="sr-only">{t("compareCriterion")}</span>
              </th>
              {items.map(({ candidate }) => (
                <th key={candidate.id} scope="col" className="py-2 pr-3 break-words">
                  {candidate.displayName ?? tm("anonymous", { ref: candidate.id })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {t("verdict")}
              </th>
              {items.map(({ candidate, match }) => (
                <td key={candidate.id} className="py-2 pr-3">
                  <StatusChip tone={match.eligible ? "ok" : "danger"}>
                    {match.eligible ? tm("eligible") : tm("notEligible")}
                  </StatusChip>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {t("base")}
              </th>
              {items.map(({ candidate }) => (
                <td key={candidate.id} className="py-2 pr-3">
                  {candidate.baseLocation ?? tm("baseNotShared")}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {t("experience")}
              </th>
              {items.map(({ candidate }) => (
                <td key={candidate.id} className="py-2 pr-3 tabular-nums">
                  {candidate.yearsExperience === null
                    ? "—"
                    : tm("years", { count: candidate.yearsExperience })}
                </td>
              ))}
            </tr>
            {labels.map((label) => (
              <tr key={label}>
                <th scope="row" className="py-2 pr-3 font-mono font-semibold">
                  {label}
                </th>
                {items.map((item) => (
                  <td key={item.candidate.id} className="py-2 pr-3">
                    {cell(item, label)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {tm("availabilityLabel")}
              </th>
              {items.map(({ candidate, match }) => (
                <td key={candidate.id} className="py-2 pr-3">
                  {explainAvailability(match.availability.coveredPercent).met ? "✓" : "✗"}{" "}
                  {formatPercent(locale, match.availability.coveredPercent)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="py-2 pr-3 font-normal text-muted">
                {tm("softScore")}
              </th>
              {items.map(({ candidate, match }) => (
                <td key={candidate.id} className="py-2 pr-3 tabular-nums">
                  {match.eligible ? match.softScore : "—"}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Previous / next page links keeping every other control. */
export async function MatchPager({
  base,
  query,
  page,
  pages,
  total,
}: {
  base: string;
  query: MatchListQuery;
  page: number;
  pages: number;
  total: number;
}) {
  const t = await getTranslations("organization.matches.list");
  return (
    <nav
      aria-label={t("pagination")}
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted" role="status">
        {t("pageInfo", { total, page, pages })}
      </p>
      {pages > 1 && (
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={matchListHref(base, query, { page: page - 1 })} className={buttonClass()}>
              {t("previous")}
            </Link>
          ) : null}
          {page < pages ? (
            <Link href={matchListHref(base, query, { page: page + 1 })} className={buttonClass()}>
              {t("next")}
            </Link>
          ) : null}
        </div>
      )}
    </nav>
  );
}
