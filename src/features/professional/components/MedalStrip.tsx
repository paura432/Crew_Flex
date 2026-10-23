"use client";

import { useState } from "react";
import { PLANE_PATH } from "@/components/layout/BrandMark";
import type { BadgeKind } from "@/domain/badges";

/** One medal, already in the reader's language (the server translates; this only toggles). */
export interface MedalView {
  id: string;
  kind: BadgeKind;
  /** What the medal shows: «B1.1», «A320», «SM»; for experience the number. */
  short: string;
  /** Experience only: the unit under the number («AÑOS»). */
  unit?: string;
  label: string;
  status: string;
  detail: string;
  /** v1.8 `.tiny-medal.expired`: dashed border («Revisar vigencia»). */
  expired: boolean;
}

const WRENCH_PATH =
  "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-8 8l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 8-8z";

/** v1.8 `.tiny-medal` colours as tokens; every pair ≥ 4.5:1 (globals.css). */
const KIND_STYLE: Record<BadgeKind, string> = {
  experience: "size-12 rounded-full border-medal-gold-line bg-medal-gold-bg text-medal-gold",
  category: "rounded-[9px] border-blue/25 bg-info-bg px-2 font-extrabold text-blue",
  aircraft: "rounded-[9px] border-ok/25 bg-ok-bg px-2 text-ok",
  specialty: "rounded-[9px] border-medal-violet-line bg-medal-violet-bg px-2 text-medal-violet",
};

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/**
 * v1.8 `MedalStrip` (N-15): up to four medals (experience, category, aircraft, specialty) and «+N» for
 * the rest, or every medal with `all` (the passport's «Pasaporte visual»). A medal opens its detail with
 * the v1.8 footnote; «×» closes it. The detail lives in a polite status region.
 */
export function MedalStrip({
  medals,
  primaryIds,
  all = false,
  labels,
}: {
  medals: MedalView[];
  primaryIds: string[];
  all?: boolean;
  labels: { strip: string; more: string; less: string; close: string; footnote: string };
}) {
  const [more, setMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // v1.8: the main strip in its own order (experience, category, aircraft, specialty); expanded, all.
  const primary = primaryIds.flatMap((id) => medals.filter((m) => m.id === id));
  const visible = all || more ? medals : primary;
  const extra = medals.length - primaryIds.length;
  const selected = medals.find((m) => m.id === selectedId);
  if (medals.length === 0) return null;
  return (
    <>
      <div
        role="group"
        aria-label={labels.strip}
        className="my-2.5 flex flex-wrap items-center gap-1.5"
      >
        {visible.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-label={`${m.label}: ${m.status}`}
            title={`${m.label} · ${m.status}`}
            aria-expanded={selectedId === m.id}
            onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}
            className={`inline-flex min-h-[38px] max-w-full items-center justify-center border text-xs leading-tight pointer-coarse:min-h-11 ${KIND_STYLE[m.kind]} ${m.expired ? "border-dashed border-warn" : ""}`}
          >
            {m.kind === "experience" ? (
              <span className="flex flex-col items-center">
                <b className="text-base leading-none tabular-nums">{m.short}</b>
                <span className="mt-0.5 text-xs leading-none">{m.unit}</span>
              </span>
            ) : m.kind === "category" ? (
              <span className="min-w-[30px] text-center">{m.short}</span>
            ) : (
              <span className="flex items-center gap-1 font-semibold">
                <Icon path={m.kind === "aircraft" ? PLANE_PATH : WRENCH_PATH} />
                <span className="break-words">{m.short}</span>
              </span>
            )}
          </button>
        ))}
        {!all && extra > 0 && (
          <button
            type="button"
            aria-expanded={more}
            aria-label={more ? labels.less : labels.more}
            onClick={() => setMore(!more)}
            className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-[9px] border border-current/40 px-2 text-xs font-semibold pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          >
            {more ? "−" : `+${extra}`}
          </button>
        )}
      </div>
      <div role="status">
        {selected && (
          <div className="my-2.5 rounded-[9px] border border-ok/25 bg-canvas p-3.5 text-xs leading-relaxed text-ink">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold">
                {selected.label} · {selected.status}
              </p>
              <button
                type="button"
                aria-label={labels.close}
                onClick={() => setSelectedId(null)}
                className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded text-xl leading-none pointer-coarse:size-11"
              >
                ×
              </button>
            </div>
            <p className="mt-1 break-words">{selected.detail}</p>
            <p className="mt-1 text-muted">{labels.footnote}</p>
          </div>
        )}
      </div>
    </>
  );
}
