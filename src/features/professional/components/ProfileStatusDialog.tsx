"use client";

import { useRef } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export interface StatusItem {
  key: string;
  label: string;
  done: boolean;
  /** Where «Completar» leads (pending items only). */
  href: string;
}

/**
 * v1.8 «Estado de mi perfil ↗» (N-18, S-MOD-TEC-01): a native modal `<dialog>` with every completeness
 * item (BR-11) and «Completar» on the pending ones. Escape or «Cerrar» closes it and focus goes back to
 * the button that opened it. Strings come translated from the server.
 */
export function ProfileStatusDialog({
  trigger,
  title,
  intro,
  items,
  labels,
}: {
  trigger: string;
  title: string;
  intro: string;
  items: StatusItem[];
  labels: { complete: string; done: string; pending: string; allDone: string; close: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const missing = items.filter((item) => !item.done);
  return (
    <>
      <Button
        ref={opener}
        variant="inverseLink"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {trigger} <span aria-hidden>↗</span>
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="profile-status-title"
        // The browser returns focus on close too; this keeps it when the opener re-rendered meanwhile.
        onClose={() => opener.current?.focus()}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-line bg-white p-0 text-ink backdrop:bg-navy/60"
      >
        <div className="space-y-3 p-5 sm:p-6">
          <header className="flex items-start justify-between gap-3">
            <h2 id="profile-status-title" className="text-lg font-semibold">
              {title}
            </h2>
            <Button size="sm" onClick={() => dialog.current?.close()}>
              {labels.close}
            </Button>
          </header>
          <p className="text-sm text-muted">{intro}</p>
          <ul className="divide-y divide-line text-sm">
            {items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className={item.done ? "font-bold text-ok" : "text-muted"}>
                    {item.done ? "✓" : "○"}
                  </span>
                  <span className={item.done ? "text-muted" : undefined}>{item.label}</span>
                  <span className="sr-only">{item.done ? labels.done : labels.pending}</span>
                </span>
                {!item.done && (
                  <ButtonLink href={item.href} onClick={() => dialog.current?.close()}>
                    {labels.complete}
                  </ButtonLink>
                )}
              </li>
            ))}
          </ul>
          {missing.length === 0 && <p className="text-sm">{labels.allDone}</p>}
        </div>
      </dialog>
    </>
  );
}
