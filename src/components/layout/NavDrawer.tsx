"use client";

import { useState, type ReactNode } from "react";

/**
 * Below `lg` the sections fold behind a «Menu» disclosure (V1.8 ≤ 760 px drawer, `v17.css`) instead of
 * wrapped rows pushing the page down; from `lg` the sidebar is always open. Following a link closes it.
 */
export function NavDrawer({
  brand,
  toolbar,
  label,
  children,
}: {
  brand: ReactNode;
  toolbar: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-5 lg:py-6">
        {brand}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="app-nav"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/5 pointer-coarse:min-h-11"
          >
            {label}
          </button>
          {toolbar}
        </div>
      </div>
      <div
        id="app-nav"
        className={`${open ? "block" : "hidden"} space-y-1 px-2 pb-3 lg:block lg:flex-1 lg:space-y-4 lg:px-3`}
        onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
      >
        {children}
      </div>
    </>
  );
}
