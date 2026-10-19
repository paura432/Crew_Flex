// Shared by the document wallet UI, the server actions and the `professional-documents` Edge
// Function (D-10, docs/product/DOCUMENT_WALLET.md). Deno-compatible imports (relative, `.ts`, bare
// "zod"). Messages are i18n keys (`v.document.*`, messages/*.json).
//
// Identity and storage never travel in a payload: the owner is the JWT subject, the object path,
// mime type, size and hash are derived by the function from the uploaded bytes. Every schema is
// strict, so `ownerId`, `storagePath`, `mimeType`, `scanStatus`… are rejected.
import { z } from "zod";
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

export const documentIdQuery = z.strictObject({
  id: z.uuid("v.document.id"),
});

/** `GET ?id=<uuid>&url=1` → a signed URL valid for 60 seconds, owner only. */
export const documentUrlQuery = z.strictObject({
  id: z.uuid("v.document.id"),
  url: z.literal("1", "v.invalid"),
});
