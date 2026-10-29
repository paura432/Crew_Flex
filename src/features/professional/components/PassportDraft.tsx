"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface PassportDraft {
  /** 0 = the saved passport; each «Preparar borrador» starts a new, empty draft. */
  generation: number;
  reset: () => void;
}

const PassportDraftContext = createContext<PassportDraft>({ generation: 0, reset: () => {} });

/**
 * v1.8 «Empezar perfil vacío» (T-162): the header button and the form live in different subtrees of the
 * passport page, so the draft generation is shared here. Nothing is stored: the saved passport is
 * untouched until «Guardar pasaporte».
 */
export function PassportDraftProvider({ children }: { children: ReactNode }) {
  const [generation, setGeneration] = useState(0);
  return (
    <PassportDraftContext value={{ generation, reset: () => setGeneration((g) => g + 1) }}>
      {children}
    </PassportDraftContext>
  );
}

export const usePassportDraft = () => useContext(PassportDraftContext);

/**
 * «Empezar perfil vacío» → modal «Empezar desde cero» → «Preparar borrador» (v1.8 `Professional2.jsx`).
 * A native `<dialog>`: Escape or «Cancelar» closes it and focus goes back to the button.
 */
export function EmptyDraftButton({
  labels,
}: {
  labels: { trigger: string; title: string; text: string; confirm: string; cancel: string };
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const { reset } = usePassportDraft();
  return (
    <>
      <Button ref={opener} aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
        {labels.trigger}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="passport-empty-title"
        onClose={() => opener.current?.focus()}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-line bg-white p-0 text-ink backdrop:bg-navy/60"
      >
        <div className="space-y-3 p-5 sm:p-6">
          <h2 id="passport-empty-title" className="text-lg font-semibold">
            {labels.title}
          </h2>
          <p className="text-sm text-muted">{labels.text}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => dialog.current?.close()}>{labels.cancel}</Button>
            <Button
              variant="primary"
              onClick={() => {
                dialog.current?.close();
                reset();
              }}
            >
              {labels.confirm}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
