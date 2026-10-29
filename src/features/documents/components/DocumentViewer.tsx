"use client";

// N-21 in-app viewer (v1.8 demo `Professional2.jsx:159`: a modal with the title, the PDF in a 450 px
// frame with «Usa Descargar para abrir este PDF.», images in <img>). Owner only (D-07/D-10 unchanged): it
// asks for the usual 60-second signed URL, fetches the bytes once and shows them as a blob typed with the
// SERVER-sniffed mime type, so the page CSP only needs `blob:` (frame-src for the PDF; img-src already
// had it) and the Storage origin is never framed (T-103). A refused or expired link is an error with
// «Try again» inside the dialog, never an empty frame. Escape (native <dialog>) and «Close» end it; the
// caller puts the focus back on the row's «Open». The new-tab path stays as the fallback.
import { useTranslations } from "next-intl";
import { Suspense, use, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { actionErrorCopy, callAction } from "@/components/ui/Notice";
import type { DocumentMime } from "@/domain/documents";
import { documentUrlAction } from "../actions";
import { viewerBytesMatch, viewerFailure, viewerKind } from "../map";

export interface ViewerTarget {
  id: string;
  title: string;
  mimeType: DocumentMime;
}

export type ViewerResult =
  | { status: "ready"; src: string }
  | { status: "error"; reason: "expired" | "failed" }
  | { status: "refused"; code: string; message: string; requestId?: string };

/**
 * Started from the click (never from an effect): a fresh signed URL, then its bytes as a typed blob.
 * Never throws. The caller revokes a ready result's object URL when the dialog closes (`releaseViewer`).
 */
export async function loadForViewer(target: ViewerTarget): Promise<ViewerResult> {
  const signed = await callAction(() => documentUrlAction(target.id));
  if (!signed.ok) {
    return {
      status: "refused",
      code: signed.code,
      message: signed.message,
      requestId: signed.requestId,
    };
  }
  if (!signed.data) return { status: "error", reason: "failed" };
  let response: Response;
  try {
    response = await fetch(signed.data, { cache: "no-store", credentials: "omit" });
  } catch {
    return { status: "error", reason: "failed" };
  }
  const failure = viewerFailure(response.status);
  if (failure) return { status: "error", reason: failure };
  const bytes = await response.arrayBuffer().catch(() => null);
  // Only bytes that really are the recorded type become a blob (review LOW-3); never `sandbox` the frame:
  // Chrome refuses to run its PDF viewer in a sandboxed iframe.
  if (!bytes || !viewerBytesMatch(new Uint8Array(bytes), target.mimeType)) {
    return { status: "error", reason: "failed" };
  }
  // Re-typed with the sniffed type: the browser never guesses from the bytes (PDF, PNG or JPEG only).
  return {
    status: "ready",
    src: URL.createObjectURL(new Blob([bytes], { type: target.mimeType })),
  };
}

/** Frees the blob of a request once its dialog is gone (also when it resolves after closing). */
export function releaseViewer(request: Promise<ViewerResult>) {
  void request.then((r) => {
    if (r.status === "ready") URL.revokeObjectURL(r.src);
  });
}

export function DocumentViewer({
  target,
  request,
  attempt,
  onRetry,
  onClose,
  onOpenInTab,
}: {
  target: ViewerTarget;
  request: Promise<ViewerResult>;
  /** Increases with each retry: a new attempt starts from a clean body. */
  attempt: number;
  /** Starts a new request (a fresh signed URL). */
  onRetry: () => void;
  /** After the dialog closed (Escape or «Close»): the caller unmounts it and restores the focus. */
  onClose: () => void;
  /** The fallback: a fresh signed link in a new tab (opened synchronously from the click). */
  onOpenInTab: () => void;
}) {
  const t = useTranslations("documents.viewer");
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-[90vh] w-[min(100%-2rem,56rem)] overflow-auto rounded-xl border border-line bg-white p-0 text-ink backdrop:bg-navy/60"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line p-4">
        <h2 id={titleId} className="min-w-0 font-semibold [overflow-wrap:anywhere]">
          {target.title}
        </h2>
        <Button size="sm" onClick={() => dialog.current?.close()}>
          {t("close")}
        </Button>
      </header>
      <div className="p-4">
        <Suspense
          fallback={
            <p role="status" className="text-sm text-muted">
              {t("loading")}
            </p>
          }
        >
          <ViewerBody key={attempt} target={target} request={request} onRetry={onRetry} />
        </Suspense>
        {viewerKind(target.mimeType) === "pdf" && (
          <p className="mt-3 text-sm text-muted">{t("pdfHint")}</p>
        )}
      </div>
      <footer className="flex flex-wrap justify-end gap-2 border-t border-line p-4">
        <Button size="sm" onClick={onOpenInTab}>
          {t("newTab")}
        </Button>
      </footer>
    </dialog>
  );
}

function ViewerBody({
  target,
  request,
  onRetry,
}: {
  target: ViewerTarget;
  request: Promise<ViewerResult>;
  onRetry: () => void;
}) {
  const t = useTranslations("documents.viewer");
  const tRoot = useTranslations();
  const result = use(request);
  // An image the browser cannot decode (a damaged file) is an error too, never an empty box.
  const [broken, setBroken] = useState(false);

  if (result.status !== "ready" || broken) {
    const refusal = result.status === "refused" ? actionErrorCopy(tRoot, result) : null;
    const reason = result.status === "error" ? result.reason : "failed";
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-danger/30 bg-danger-bg p-4">
        <p className="text-sm text-danger">{refusal ? refusal.text : t(reason)}</p>
        {refusal?.requestId && (
          <p className="font-mono text-xs text-danger">
            {tRoot("common.reference", { id: refusal.requestId })}
          </p>
        )}
        <Button size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  return viewerKind(target.mimeType) === "image" ? (
    // eslint-disable-next-line @next/next/no-img-element -- a same-origin blob: URL of the owner's own file; next/image cannot load it
    <img
      src={result.src}
      alt={target.title}
      onError={() => setBroken(true)}
      className="mx-auto max-h-[65vh] max-w-full object-contain"
    />
  ) : (
    <iframe
      src={result.src}
      title={t("pdfFrame", { title: target.title })}
      className="h-[60vh] w-full rounded-lg border border-line md:h-[450px]"
    />
  );
}
