// Shared by the document wallet UI, the server actions and the `professional-documents` Edge
// Function (D-10, docs/product/DOCUMENT_WALLET.md). Deno-compatible imports (relative, `.ts`, bare
// "zod"). Messages are i18n keys (`v.document.*`, messages/*.json).
//
// Identity and storage never travel in a payload: the owner is the JWT subject, the object path,
// mime type, size and hash are derived by the function from the uploaded bytes. Every schema is
// strict, so `ownerId`, `storagePath`, `mimeType`, `scanStatus`… are rejected.
import { z } from "./zod.ts";
import {
  DOCUMENT_KINDS,
  InvalidDocumentTitleError,
  sanitizeDocumentTitle,
} from "../../domain/documents.ts";

const title = z.string("v.document.title.required").transform((value, ctx) => {
  try {
    return sanitizeDocumentTitle(value);
  } catch (error) {
    if (!(error instanceof InvalidDocumentTitleError)) throw error;
    ctx.addIssue({ code: "custom", message: error.code });
    return z.NEVER;
  }
});

const metadata = {
  kind: z.enum(DOCUMENT_KINDS, "v.document.kind"),
  title,
  expiresAt: z.iso.date("v.document.expiresAt").nullable(),
  qualificationId: z.uuid("v.document.qualificationId").nullable(),
};

/**
 * Metadata fields of the multipart upload (`file` travels separately). The function maps empty
 * form fields to null and defaults `title` to the file name before parsing.
 */
export const uploadDocumentMetadata = z.strictObject(metadata);
export type UploadDocumentMetadata = z.infer<typeof uploadDocumentMetadata>;

/** Full replacement of the editable fields (PATCH): all four are required. */
export const updateDocumentInput = z.strictObject(metadata);
export type UpdateDocumentInput = z.infer<typeof updateDocumentInput>;

/**
 * N-19 trash (`PATCH ?id=` with this body instead of the metadata): `true` archives, `false` restores.
 * The database stamps the date itself (migration 20261024200000).
 */
export const archiveDocumentInput = z.strictObject({
  archived: z.boolean("v.invalid"),
});
export type ArchiveDocumentInput = z.infer<typeof archiveDocumentInput>;

/** A PATCH body that names `archived` is an archive/restore, anything else a metadata update. */
export const isArchivePatch = (raw: unknown): boolean =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw) && "archived" in raw;

export const documentIdQuery = z.strictObject({
  id: z.uuid("v.document.id"),
});

/** v1.8 «Ver wallet» / «Papelera» (N-19): which documents a list returns. */
export const DOCUMENT_VIEWS = ["active", "trash"] as const;
export type DocumentView = (typeof DOCUMENT_VIEWS)[number];

/**
 * `GET` list: `?view=trash` for the trash, nothing (or `active`) for the wallet — each view has its own
 * 200-row cap, and the response counts both (security review LOW-4).
 */
export const listDocumentsQuery = z.strictObject({
  view: z.enum(DOCUMENT_VIEWS, "v.invalid").default("active"),
});

/** `GET ?id=<uuid>&url=1` → a signed URL valid for 60 seconds, owner only. */
export const documentUrlQuery = z.strictObject({
  id: z.uuid("v.document.id"),
  url: z.literal("1", "v.invalid"),
});

/**
 * `POST /documents-maintenance?apply=1&limit=` (platform admin). Dry-run unless `apply=1`; at most
 * 100 objects per call.
 */
export const documentsMaintenanceQuery = z.strictObject({
  apply: z.literal("1", "v.invalid").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
