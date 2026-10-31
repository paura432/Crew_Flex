import { callAction } from "@/components/ui/action-result";
import type { DocumentMime } from "@/domain/documents";
import { documentUrlAction } from "./actions";
import { viewerBytesMatch, viewerFailure } from "./map";

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
  if (!response.ok) return { status: "error", reason: viewerFailure(response.status) ?? "failed" };
  const bytes = await response.arrayBuffer().catch(() => null);
  // Only bytes that really are the recorded type become a blob (review LOW-3); never `sandbox` the frame:
  // Chrome refuses to run its PDF viewer in a sandboxed iframe.
  if (!bytes || !viewerBytesMatch(new Uint8Array(bytes), target.mimeType)) {
    return { status: "error", reason: "failed" };
  }
  // Re-typed with the sniffed type: the browser never guesses from the bytes (PDF, PNG or JPEG only).
  return {
    status: "ready",
    // react-doctor-disable-next-line no-create-object-url-without-revoke -- revoked by releaseViewer() when the dialog closes
    src: URL.createObjectURL(new Blob([bytes], { type: target.mimeType })),
  };
}

/** Frees the blob of a request once its dialog is gone (also when it resolves after closing). */
export function releaseViewer(request: Promise<ViewerResult>) {
  void request.then((r) => {
    if (r.status === "ready") URL.revokeObjectURL(r.src);
  });
}
