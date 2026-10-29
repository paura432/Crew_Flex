// Pure view model of the document wallet page (no I/O; `map.test.ts`): the trash (N-19, T-100/T-101),
// the filter by type (N-20, T-102) and the in-app viewer's decisions (N-21, T-103). Rules about the
// documents themselves stay in `src/domain/documents.ts`.
import { DOCUMENT_KINDS, sniffDocumentMime, type DocumentMime } from "@/domain/documents";
import type { DocumentView } from "@/lib/validation/documents";
import type { DocumentListResponse, ProfessionalDocument } from "@/types/api";

/** v1.8 «Papelera» / «Ver wallet»: `?view=trash`, anything else is the wallet. */
export type WalletView = DocumentView;
export const walletView = (raw: unknown): WalletView => (raw === "trash" ? "trash" : "active");

/**
 * v1.8 tabs «Todos», «Licencias», «Cursos» + the rest (T-102): the three Next kinds, so v1.8's «CV y
 * experiencia» and «Permisos y seguridad» are «Otros».
 */
export const WALLET_FILTERS = ["all", ...DOCUMENT_KINDS] as const;
export type WalletFilter = (typeof WALLET_FILTERS)[number];

export interface WalletList {
  /** What the list shows: the view, then the filter. Its length is the panel's counter. */
  shown: ProfessionalDocument[];
  /** Documents of the view before the filter (tells «nothing of this type» from «nothing at all»). */
  inView: number;
  /** Documents in the trash (the server's count), whatever the view. */
  inTrash: number;
  /** Documents of the view in total: more than `inView` when the server cut the list at 200. */
  total: number;
}

export function walletList(
  documents: ProfessionalDocument[],
  view: WalletView,
  filter: WalletFilter,
  counts: DocumentListResponse["counts"] | undefined,
): WalletList {
  // The server sends one view. Truthiness, not `!== null`, and optional counts: a function older than
  // N-19 sends neither `archivedAt` nor `counts`, and all its documents are in the wallet.
  const inView = documents.filter((d) => Boolean(d.archivedAt) === (view === "trash"));
  const counted = counts ? counts[view] : 0;
  return {
    shown: filter === "all" ? inView : inView.filter((d) => d.kind === filter),
    inView: inView.length,
    inTrash: counts ? counts.trash : 0,
    total: Math.max(counted, inView.length),
  };
}

/**
 * First UTC day on which `documents-maintenance` may purge a document archived at `archivedAt`
 * (`archived_at + archive_retention`, migration 20261024200000), `YYYY-MM-DD`. The purge itself runs
 * when an operator runs the maintenance, so the page says «from», never «on».
 */
export const trashPurgeDate = (archivedAt: string, retentionDays: number): string =>
  new Date(Date.parse(archivedAt) + retentionDays * 86_400_000).toISOString().slice(0, 10);

/** How the viewer shows a file: PDFs in a frame, images in `<img>` (the three wallet types only). */
export const viewerKind = (mime: DocumentMime): "pdf" | "image" =>
  mime === "application/pdf" ? "pdf" : "image";

/**
 * The viewer fetched the 60-second signed URL: what to tell the person when it did not work. Storage
 * answers 400 (invalid or expired token), 401 or 403 for a link that is no longer valid, 404 when the
 * object is gone; a network failure has no status. Null = show the file.
 */
export function viewerFailure(status: number | null): "expired" | "failed" | null {
  if (status !== null && status >= 200 && status < 300) return null;
  return status === 400 || status === 401 || status === 403 ? "expired" : "failed";
}

/**
 * The viewer shows bytes only when their magic bytes are the type the server recorded (security review
 * LOW-3): a direct Storage upload could hold anything under an allowed name, so the blob is never typed
 * from a claim alone. Otherwise the dialog shows its error and the new-tab fallback.
 */
export const viewerBytesMatch = (bytes: Uint8Array, mime: DocumentMime): boolean =>
  sniffDocumentMime(bytes) === mime;
