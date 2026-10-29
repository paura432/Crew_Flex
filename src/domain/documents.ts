// Document Wallet (owner decision D-10, 2026-10-19). Pure rules shared by the Next.js app and the
// `professional-documents` Edge Function (Deno: relative imports only). Architecture and threat
// model: docs/product/DOCUMENT_WALLET.md. The database re-checks the allowed kind/mime values, the
// size range and the hash format (migration 20261019160000) but cannot see the bytes: only these
// helpers, run by the function, tie mime type and hash to the actual content.

export const DOCUMENT_KINDS = ["license", "course", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type DocumentMime = (typeof DOCUMENT_MIME_TYPES)[number];

/** 5 MiB — same value as the bucket `file_size_limit` and the `size_bytes` CHECK. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const DOCUMENT_TITLE_MAX = 180;

/**
 * `not_scanned` is the only value anything writes today: no file-scanning mechanism is approved,
 * and `authenticated` cannot write the column (column grants).
 */
export const DOCUMENT_SCAN_STATUSES = ["not_scanned", "clean", "infected"] as const;
export type DocumentScanStatus = (typeof DOCUMENT_SCAN_STATUSES)[number];

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);
}

/**
 * The file type from its magic bytes. The client-declared type and the file name are never
 * trusted: a renamed `.exe` or a text file called `licence.pdf` returns null.
 */
export function sniffDocumentMime(bytes: Uint8Array): DocumentMime | null {
  if (startsWith(bytes, PDF_SIGNATURE)) return "application/pdf";
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  return null;
}

/** i18n key carried by the error when nothing printable is left of a title. */
export const DOCUMENT_TITLE_EMPTY = "v.document.title.required";

export class InvalidDocumentTitleError extends Error {
  readonly code = DOCUMENT_TITLE_EMPTY;
  constructor() {
    super(DOCUMENT_TITLE_EMPTY);
    this.name = "InvalidDocumentTitleError";
  }
}

// Control (Cc) and format (Cf: bidi overrides such as U+202E, zero-width characters) code points,
// path separators, quotes and backticks. A title is display text only: it never becomes a storage
// path, a header or a file name.
const STRIPPED = /[\p{Cc}\p{Cf}\\/"'`]/gu;

/**
 * Display title from user input or an uploaded file name: NFC, strips path separators, CR/LF,
 * quotes and control/format characters, collapses whitespace, trims, keeps at most 180 code points.
 * Throws `InvalidDocumentTitleError` (code `v.document.title.required`) when nothing is left.
 */
export function sanitizeDocumentTitle(name: string): string {
  const cleaned = name.normalize("NFC").replace(STRIPPED, " ").replace(/\s+/gu, " ").trim();
  const title = Array.from(cleaned).slice(0, DOCUMENT_TITLE_MAX).join("").trim();
  if (title.length === 0) throw new InvalidDocumentTitleError();
  return title;
}

/**
 * Third parties (organizations, recruiters, platform staff) may receive a document only once an
 * approved scanner has marked it `clean` (owner rule, D-10). No scanner exists, so nothing writes
 * `clean` and this is always false today; there is also no sharing path in the database.
 */
export function canShareWithThirdParties(doc: { scanStatus: DocumentScanStatus }): boolean {
  return doc.scanStatus === "clean";
}

/** V1.8 `documentStatus`: a document «expires soon» within this many days (inclusive). */
export const EXPIRY_SOON_DAYS = 45;
export type ExpiryState = "none" | "valid" | "soon" | "expired";

/** Expiry of a document on `today` (both `YYYY-MM-DD`, UTC). Expired = the date has passed. */
export function documentExpiryState(expiresAt: string | null, today: string): ExpiryState {
  if (expiresAt === null) return "none";
  if (expiresAt < today) return "expired";
  const days =
    (Date.parse(`${expiresAt}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000;
  return days <= EXPIRY_SOON_DAYS ? "soon" : "valid";
}

/** V1.8 `Badges.jsx` «próximos a revisar»: anything expiring within this many days, expired included. */
export const REVIEW_WINDOW_DAYS = 60;

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Declared expiry on or before `today + REVIEW_WINDOW_DAYS` (UTC dates); no date → never listed. */
export const isDueForReview = (expiresAt: string | null, today: string): boolean =>
  expiresAt !== null && expiresAt <= addDays(today, REVIEW_WINDOW_DAYS);

/** Titles of own documents per linked qualification (V1.8: the evidence named on the passport). */
export function evidenceByQualification(
  links: { qualificationId: string; title: string }[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { qualificationId, title } of links) (out[qualificationId] ??= []).push(title);
  return out;
}
