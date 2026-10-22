// Pure view model of the document wallet page (no I/O; `map.test.ts`): the trash (N-19, T-100/T-101),
// the filter by type (N-20, T-102) and the in-app viewer's decisions (N-21, T-103). Rules about the
// documents themselves stay in `src/domain/documents.ts`.
import { DOCUMENT_KINDS, type DocumentMime } from "@/domain/documents";
import type { ProfessionalDocument } from "@/types/api";

/** v1.8 «Papelera» / «Ver wallet»: `?view=trash`, anything else is the wallet. */
export const WALLET_VIEWS = ["active", "trash"] as const;
export type WalletView = (typeof WALLET_VIEWS)[number];
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
  /** Documents in the trash, whatever the view. */
  inTrash: number;
}

export function walletList(
  documents: ProfessionalDocument[],
  view: WalletView,
  filter: WalletFilter,
): WalletList {
  // Truthiness, not `!== null`: a list from a function older than N-19 has no `archivedAt` at all, and
  // those documents are in the wallet (deploy order: migration → function → frontend).
  const trash = documents.filter((d) => Boolean(d.archivedAt));
  const inView = view === "trash" ? trash : documents.filter((d) => !d.archivedAt);
  return {
    shown: filter === "all" ? inView : inView.filter((d) => d.kind === filter),
    inView: inView.length,
    inTrash: trash.length,
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
