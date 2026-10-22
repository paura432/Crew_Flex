import type { EvaluatedCandidate } from "@/types/api";

/** List controls of the matches page (V1.8 `CandidateDirectory`: search, eligible-only, sort, pages, compare). */
export const MATCH_SORTS = ["relevance", "years"] as const;
export type MatchSort = (typeof MATCH_SORTS)[number];
export const MATCH_PAGE_SIZE = 20;
export const MAX_COMPARE = 3;

export interface MatchListQuery {
  q: string;
  eligibleOnly: boolean;
  sort: MatchSort;
  page: number;
  compare: string[];
}

type Param = string | string[] | undefined;
const first = (v: Param) => (Array.isArray(v) ? v[0] : v);

/**
 * v1.8 «Solo elegibles con cobertura» is ON by default (v2-25, T-94): only an explicit `eligible=0`
 * turns it off. The GET form sends a hidden `eligible=0` before the checkbox (`eligible=1` when ticked),
 * so an unticked box reads as off and a ticked one as on.
 */
const eligibleOnlyParam = (v: Param) => {
  const values = [v ?? []].flat();
  return values.includes("1") || !values.includes("0");
};

/** Parses URL search params leniently: anything unknown falls back to the default. */
export function parseMatchListQuery(params: Record<string, Param>): MatchListQuery {
  const sort = first(params.sort);
  const page = Number.parseInt(first(params.page) ?? "", 10);
  const compare = [params.compare ?? []].flat().filter((id) => /^[A-Za-z0-9-]{1,64}$/.test(id));
  return {
    q: (first(params.q) ?? "").trim().slice(0, 80),
    eligibleOnly: eligibleOnlyParam(params.eligible),
    sort: MATCH_SORTS.includes(sort as MatchSort) ? (sort as MatchSort) : "relevance",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    // Bounded: a crafted URL with thousands of ids must not inflate the page (review S-5).
    compare: [...new Set(compare)].slice(0, MAX_COMPARE * 3),
  };
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * Filters and orders the evaluated pool for display only. "relevance" keeps the engine's
 * deterministic order (eligible first, soft score, id — `compareMatches`); "years" orders by declared
 * experience, unknown last, ties in engine order. Eligibility itself is never recomputed here.
 */
export function listMatches(items: EvaluatedCandidate[], query: MatchListQuery) {
  const needle = fold(query.q);
  const filtered = items.filter(
    ({ candidate, match }) =>
      (!query.eligibleOnly || match.eligible) &&
      (!needle ||
        [candidate.id, candidate.displayName ?? "", candidate.baseLocation ?? ""].some((field) =>
          fold(field).includes(needle),
        )),
  );
  const ordered =
    query.sort === "years"
      ? filtered
          .map((item, index) => ({ item, index }))
          .sort(
            (a, b) =>
              (b.item.candidate.yearsExperience ?? -1) - (a.item.candidate.yearsExperience ?? -1) ||
              a.index - b.index,
          )
          .map(({ item }) => item)
      : filtered;
  const pages = Math.max(1, Math.ceil(ordered.length / MATCH_PAGE_SIZE));
  const page = Math.min(query.page, pages);
  return {
    total: ordered.length,
    page,
    pages,
    items: ordered.slice((page - 1) * MATCH_PAGE_SIZE, page * MATCH_PAGE_SIZE),
    // Compared candidates come from the whole evaluated pool, in the order they were picked.
    compared: query.compare
      .map((id) => items.find((item) => item.candidate.id === id))
      .filter((item): item is EvaluatedCandidate => item !== undefined)
      .slice(0, MAX_COMPARE),
    // Stale ids (no longer in the pool) do not count towards the cap.
    compareTruncated:
      query.compare.filter((id) => items.some((item) => item.candidate.id === id)).length >
      MAX_COMPARE,
  };
}
