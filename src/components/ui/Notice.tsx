import { useEffect, useRef } from "react";
import type { NoticeState } from "./action-result";

export type { NoticeState } from "./action-result";

export function Notice({
  notice,
  referenceLabel,
}: {
  notice: NoticeState | null;
  referenceLabel: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  // X-08: an outcome that arrives after the focus was lost (the confirmed row is gone, or its button
  // was disabled while pending) takes it, instead of leaving keyboard users on <body>. Never steals
  // focus from a control and never scrolls (review R-X M1: the page jumped to the notice). Keyed on
  // the content: some callers build a new notice object on every render.
  const text = notice?.text;
  useEffect(() => {
    const active = document.activeElement;
    if (text && (!active || active === document.body)) ref.current?.focus({ preventScroll: true });
  }, [text]);
  if (!notice) return null;
  return (
    <p
      ref={ref}
      tabIndex={-1}
      role={notice.tone === "danger" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${
        notice.tone === "danger"
          ? "border-danger/30 bg-danger-bg text-danger"
          : "border-ok/30 bg-ok-bg text-ok"
      }`}
    >
      {notice.text}
      {notice.requestId && <span className="mt-1 block font-mono text-xs">{referenceLabel}</span>}
    </p>
  );
}
