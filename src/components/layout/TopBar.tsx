"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { activeItem } from "./nav-active";

/**
 * v1.8 `.workspace-header` from `lg` (area 50 #3, T-142): a white bar above the content with
 * «CrewFlex / {menu entry}» and the notices bell. Without «Probar como» and «Vista móvil» (demo only).
 * Below `lg` the navy bar carries the brand and the bell instead. Client only for the current entry.
 */
export function TopBar({
  items,
  home,
  label,
  bell,
}: {
  /** Every menu entry the account has; the breadcrumb names the one the path belongs to. */
  items: { href: string; label: string }[];
  home: string;
  /** Accessible name of the breadcrumb navigation. */
  label: string;
  bell: ReactNode;
}) {
  const current = activeItem(items, usePathname());
  return (
    <header className="hidden min-h-[72px] items-center justify-between gap-4 border-b border-line bg-white px-10 lg:flex">
      <nav aria-label={label}>
        <ol className="flex items-center gap-3 text-xs font-semibold text-muted">
          <li>
            <Link
              href="/app"
              className="inline-flex items-center hover:text-ink hover:underline pointer-coarse:min-h-11"
            >
              {home}
            </Link>
          </li>
          {current && (
            <>
              <li aria-hidden>/</li>
              <li className="text-ink">{current.label}</li>
            </>
          )}
        </ol>
      </nav>
      {bell}
    </header>
  );
}
