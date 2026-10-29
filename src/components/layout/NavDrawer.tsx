"use client";

import { usePathname } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

/**
 * Below `lg` the sections fold behind a «Menu» disclosure (V1.8 ≤ 760 px drawer, `v17.css`) instead of
 * wrapped rows pushing the page down; from `lg` the sidebar is always open. Any path change (link,
 * back/forward, redirect) closes it — state adjusted while rendering, React's «reset on prop change».
 */
export function NavDrawer({
  brand,
  bell,
  toolbar,
  label,
  children,
}: {
  brand: ReactNode;
  /** Always visible next to the brand (desktop sidebar and the mobile bar): the notices bell. */
  bell?: ReactNode;
  toolbar: ReactNode;
  label: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [state, setState] = useState({ path: pathname, open: false });
  if (state.path !== pathname) setState({ path: pathname, open: false });
  const open = state.open && state.path === pathname;
  const id = useId();
  return (
    <>
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-5 lg:py-6">
        {brand}
        <div className="flex items-center gap-1">
          {bell}
          <div className="contents lg:hidden">{toolbar}</div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setState({ path: pathname, open: !open })}
            onKeyDown={(e) => e.key === "Escape" && setState({ path: pathname, open: false })}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/5 pointer-coarse:min-h-11 lg:hidden"
          >
            {label}
          </button>
        </div>
      </div>
      <div
        id={id}
        className={`${open ? "block" : "hidden"} space-y-1 px-2 pb-3 lg:block lg:min-h-0 lg:flex-1 lg:space-y-4 lg:overflow-y-auto lg:px-3`}
      >
        {children}
      </div>
    </>
  );
}
