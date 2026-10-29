"use client";

import { useSyncExternalStore, type ReactNode } from "react";

type View = "compact" | "expanded";
/** v1.8 `localStorage['crewflex-directory-view']` (MKT-01 #23), per browser, never sent anywhere. */
const KEY = "crewflex-directory-view";
const EVENT = "crewflex-directory-view-change";
let memory: View = "compact"; // when the browser refuses storage the choice still holds for this page

const read = (): View => {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "expanded" || stored === "compact" ? stored : memory;
  } catch {
    return memory;
  }
};
function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
function choose(view: View) {
  memory = view;
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // blocked storage: the in-memory choice applies to this page
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * «Compacta» / «Ampliada» with `aria-pressed`, remembered per viewer. The server renders compact (the
 * stored choice is applied after hydration); the cards show their extra block through
 * `group-data-[view=expanded]:block`, so the server-rendered content never changes, only its visibility.
 */
export function DirectoryView({
  labels,
  summary,
  children,
}: {
  labels: { group: string; compact: string; expanded: string };
  summary: ReactNode;
  children: ReactNode;
}) {
  const view = useSyncExternalStore(subscribe, read, () => "compact" as View);
  const toggle = (value: View, label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => choose(value)}
      className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-canvas pointer-coarse:min-h-11 aria-pressed:border-navy aria-pressed:bg-navy aria-pressed:text-white"
    >
      {label}
    </button>
  );
  return (
    <div className="group" data-view={view}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {summary}
        <div role="group" aria-label={labels.group} className="flex gap-2">
          {toggle("compact", labels.compact)}
          {toggle("expanded", labels.expanded)}
        </div>
      </div>
      {children}
    </div>
  );
}
