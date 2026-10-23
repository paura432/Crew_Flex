"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isActiveHref } from "./nav-active";
import { NavIcon, type NavItem } from "./NavLinks";
import { viewOfPath, type WorkspaceView } from "./views";

/** Static classes (an inline `style` would need `unsafe-inline` under the CSP). */
const COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/**
 * v1.8 `nav.mobile-dock` «Accesos rápidos» below `lg` (C-12 → v1.8 default, T-141): up to five
 * shortcuts of the current workspace, fixed at the bottom, 44 px targets, the current one marked
 * with `aria-current`. The «Menú» drawer in the top bar keeps every other entry. On shared pages
 * (tools, settings, notices) the last workspace stays, as in the sidebar's view switcher.
 */
export function MobileDock({
  label,
  docks,
  initial,
}: {
  label: string;
  docks: Partial<Record<WorkspaceView, NavItem[]>>;
  /** The workspace of the account's own home (`/app` redirects there). */
  initial: WorkspaceView;
}) {
  const pathname = usePathname();
  const view = viewOfPath(pathname);
  const [last, setLast] = useState(view && docks[view] ? view : initial);
  if (view !== null && docks[view] && view !== last) setLast(view);
  const items = docks[last] ?? [];
  if (items.length === 0) return null;
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-0.5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgb(22_68_91/0.05)] lg:hidden"
    >
      <ul className={`grid ${COLUMNS[items.length] ?? "grid-cols-5"}`}>
        {items.map((item) => (
          <li key={item.href} className="min-w-0">
            <Link
              href={item.href}
              aria-current={isActiveHref(item.href, pathname) ? "page" : undefined}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg py-1 text-[11px] leading-tight tracking-tight text-muted hover:bg-canvas aria-[current=page]:bg-ok-bg aria-[current=page]:font-semibold aria-[current=page]:text-ok"
            >
              <NavIcon href={item.href} className="size-5 shrink-0" />
              <span className="max-w-full">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
