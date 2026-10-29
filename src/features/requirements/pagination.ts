export const REQUIREMENTS_PAGE_SIZE = 20;
/** The list schema caps `offset` at 10 000. */
const MAX_PAGE = Math.floor(10000 / REQUIREMENTS_PAGE_SIZE) + 1;

/** `?page=` as a 1-based page; anything else is page 1. */
export function parseRequirementsPage(param: unknown): number {
  const n = typeof param === "string" ? Number(param) : Number.NaN;
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_PAGE) : 1;
}

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / REQUIREMENTS_PAGE_SIZE));
export const pageOffset = (page: number) => (page - 1) * REQUIREMENTS_PAGE_SIZE;
