"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { NavLinks, type NavItem } from "./NavLinks";
import { sectionsOfView, viewOfPath, WORKSPACE_VIEWS, type WorkspaceView } from "./views";

export interface NavSection {
  label: string;
  view?: WorkspaceView;
  items: NavItem[];
}

/**
 * The sidebar sections. With the switcher (`byView`), only the current view's section plus the
 * untagged ones; on shared pages (tools, settings) the last view chosen stays — the shell lives in
 * the layout, so this state survives navigation (adjusted while rendering, as in NavDrawer).
 */
export function ViewSections({ sections, byView }: { sections: NavSection[]; byView: boolean }) {
  const view = viewOfPath(usePathname());
  const [last, setLast] = useState(view);
  if (view !== null && view !== last) setLast(view);
  return (byView ? sectionsOfView(sections, view ?? last) : sections).map((section) => (
    <div key={section.label}>
      <p className="hidden px-3 pb-2 text-[11px] font-semibold tracking-[0.16em] text-[#91aac1] uppercase lg:block">
        {section.label}
      </p>
      <NavLinks items={section.items} label={section.label} />
    </div>
  ));
}

/**
 * V1.8 «Probar como» for platform admins: one link per workspace, the current one marked. Links,
 * not a `<select>` that navigates on change (WCAG 3.2.2); client only for the current marker.
 */
export function ViewSwitcher({
  label,
  views,
}: {
  label: string;
  views: { view: WorkspaceView; label: string }[];
}) {
  const pathname = usePathname();
  const current = viewOfPath(pathname);
  const id = useId();
  return (
    <nav aria-labelledby={id}>
      <p
        id={id}
        className="px-3 pb-2 text-[11px] font-semibold tracking-[0.16em] text-[#91aac1] uppercase"
      >
        {label}
      </p>
      <ul className="grid grid-cols-2 gap-1 px-1">
        {views.map((item) => (
          <li key={item.view}>
            <Link
              href={WORKSPACE_VIEWS[item.view]}
              aria-current={
                current !== item.view
                  ? undefined
                  : pathname === WORKSPACE_VIEWS[item.view]
                    ? "page"
                    : "true"
              }
              className="flex items-center justify-center rounded-lg border border-white/15 px-2 py-2 text-center text-sm text-[#c4d3e1] pointer-coarse:min-h-11 hover:bg-white/5 hover:text-white [&[aria-current]]:border-accent [&[aria-current]]:bg-navy-700 [&[aria-current]]:text-white"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
