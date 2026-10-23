// Which menu entry a path belongs to: one rule for the sidebar, the mobile dock and the breadcrumb.

/** Workspace homes: active only on their exact path, never for the pages under them. */
export const SECTION_ROOTS: ReadonlySet<string> = new Set([
  "/app/organization",
  "/app/professional",
  "/app/admin",
]);

/** The entry is the page itself, or (not a workspace home) one of the pages under it. */
export const isActiveHref = (href: string, pathname: string) =>
  href === pathname || (!SECTION_ROOTS.has(href) && pathname.startsWith(`${href}/`));

/** The entry a path belongs to (the deepest one when several match), or undefined. */
export function activeItem<T extends { href: string }>(items: readonly T[], pathname: string) {
  return items
    .filter((item) => isActiveHref(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
}
