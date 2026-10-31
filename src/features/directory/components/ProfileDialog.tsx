"use client";

import { useId, useRef, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button-class";

/**
 * v1.8 «Abrir perfil» → modal «Perfil profesional» (MKT-02 #13) as a native `<dialog>`: Escape and the close
 * button close it and the focus returns to the button that opened it. The content is server-rendered (the
 * card already holds every datum shown; nothing is fetched on open).
 */
export function ProfileDialog({
  title,
  openLabel,
  closeLabel,
  children,
}: {
  title: string;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={buttonClass()}
        onClick={() => dialog.current?.showModal()}
      >
        {openLabel}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        onClose={() => trigger.current?.focus()}
        className="m-auto w-[min(100%_-_2rem,40rem)] max-h-[calc(100dvh_-_2rem)] rounded-xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-navy/60"
      >
        <div className="p-5 sm:p-6">
          <header className="mb-4 flex items-start justify-between gap-3">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            <button
              type="button"
              aria-label={closeLabel}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-xl text-muted hover:bg-canvas pointer-coarse:min-h-11 pointer-coarse:min-w-11"
              onClick={() => dialog.current?.close()}
            >
              <span aria-hidden>×</span>
            </button>
          </header>
          {children}
        </div>
      </dialog>
    </>
  );
}
