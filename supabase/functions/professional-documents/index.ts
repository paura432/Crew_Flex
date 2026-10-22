// Professional document wallet (owner decision D-10) — own documents only. LOCAL ONLY.
//   GET    /professional-documents[?view=trash]     → own documents of one view (RLS, ≤ 200),
//          `counts` of both views and `trashRetentionDays` (N-19, T-100)
//   GET    /professional-documents?id=<uuid>&url=1  → { url, expiresInSeconds: 60 } signed URL (owner)
//   POST   (only while app_private.feature_flags('document_wallet') is on, else 404)
//          /professional-documents  multipart/form-data: file, kind, title?, expiresAt?, qualificationId?
//          Idempotency-Key REQUIRED → 201 created · 200 replay · 409 same key, other request
//   PATCH  /professional-documents?id=<uuid> { kind, title, expiresAt, qualificationId }
//          or { archived: true|false } → to the trash / restored (N-19; the database stamps the date)
//   DELETE /professional-documents?id=<uuid>  → row first, then the object
// Design and threat model: docs/product/DOCUMENT_WALLET.md. User-JWT client ONLY (no service role):
// the table's RLS and the bucket's Storage policies are the authorization; ownership is the JWT
// subject. On THIS path mime type, size, hash and object path are derived from the bytes. The
// database cannot see the bytes: a caller using Storage + PostgREST directly can assert other
// mime/hash values for their own files (owner-only; any future scanner must re-derive both).
// No organization, manager or platform-admin path exists, and none may be added before an approved
// file-scanning mechanism (`canShareWithThirdParties`).
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireActor, requireFeature, requireTechnician } from "../_shared/auth.ts";
import { ApiError, fromDatabaseError } from "../_shared/errors.ts";
import { createHandler, type RequestContext } from "../_shared/http.ts";
import { logEvent } from "../_shared/logger.ts";
import {
  createdRow,
  idempotencyKey,
  parseJsonBody,
  parseQuery,
  parseValue,
} from "../_shared/validation.ts";
import {
  DOCUMENT_KINDS,
  DOCUMENT_MIME_TYPES,
  DOCUMENT_SCAN_STATUSES,
  MAX_DOCUMENT_BYTES,
  sniffDocumentMime,
} from "../../../src/domain/documents.ts";
import {
  archiveDocumentInput,
  documentIdQuery,
  documentUrlQuery,
  isArchivePatch,
  listDocumentsQuery,
  updateDocumentInput,
  uploadDocumentMetadata,
} from "../../../src/lib/validation/documents.ts";
import type {
  DocumentDeleteResponse,
  DocumentListResponse,
  DocumentResponse,
  DocumentUrlResponse,
  ProfessionalDocument,
} from "../../../src/types/api.ts";

const FN = "professional-documents";
export const BUCKET = "professional-documents";
export const SIGNED_URL_SECONDS = 60;
/** Room for the multipart boundaries and the four metadata fields around a 5 MiB file. */
export const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const FORM_FIELDS = new Set(["kind", "title", "expiresAt", "qualificationId"]);
/** RPC refusals after which no request can ever commit a row on this object. */
const DEFINITIVE_RPC_ERRORS = new Set([
  "22023",
  "22P02",
  "23502",
  "23503",
  "23514",
  "CF409",
  "42501",
]);

/** The columns `toDocument` reads; the `account` export selects these too (plus `storage_path`). */
export const DOCUMENT_SELECT =
  "id, kind, title, mime_type, size_bytes, sha256, expires_at, qualification_id, scan_status, archived_at, created_at, updated_at";
const SELECT = DOCUMENT_SELECT;

const row = z.object({
  id: z.string(),
  kind: z.enum(DOCUMENT_KINDS),
  title: z.string(),
  mime_type: z.enum(DOCUMENT_MIME_TYPES),
  size_bytes: z.number(),
  sha256: z.string(),
  expires_at: z.string().nullable(),
  qualification_id: z.string().nullable(),
  scan_status: z.enum(DOCUMENT_SCAN_STATUSES),
  archived_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function toDocument(raw: unknown): ProfessionalDocument {
  const r = row.parse(raw);
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    sha256: r.sha256,
    expiresAt: r.expires_at ? r.expires_at.slice(0, 10) : null,
    qualificationId: r.qualification_id,
    scanStatus: r.scan_status,
    archivedAt: r.archived_at ? new Date(r.archived_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/**
 * PATCH body → the row update. `{ archived }` (N-19) moves the document to the trash or back: the value
 * sent for `archived_at` is only a marker, the database stamps its own clock (trigger
 * `professional_documents_archive_clock`). Anything else is the full metadata replacement, as before.
 */
export function documentPatch(body: unknown): Record<string, string | null> {
  if (isArchivePatch(body)) {
    const { archived } = parseValue(body, archiveDocumentInput);
    return { archived_at: archived ? new Date().toISOString() : null };
  }
  const input = parseValue(body, updateDocumentInput);
  return {
    kind: input.kind,
    title: input.title,
    expires_at: input.expiresAt,
    qualification_id: input.qualificationId,
  };
}

const fileIssue = (message: string) =>
  new ApiError("VALIDATION_ERROR", undefined, [{ path: "file", message }]);

/** Reads at most `limit` bytes of the body; a longer (or unlabelled chunked) body is a 413. */
export async function readBodyCapped(
  req: Request,
  limit: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => {});
      throw new ApiError("PAYLOAD_TOO_LARGE");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export interface ParsedUpload {
  bytes: Uint8Array<ArrayBuffer>;
  fileName: string;
  fields: Record<string, string | null>;
}

/** Multipart body → the file and the allowed text fields. Size is checked twice: header and bytes. */
export async function parseUpload(req: Request): Promise<ParsedUpload> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) {
    throw fileIssue("v.document.file.form");
  }
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_DOCUMENT_BYTES + MULTIPART_OVERHEAD_BYTES) {
    throw new ApiError("PAYLOAD_TOO_LARGE");
  }
  const body = await readBodyCapped(req, MAX_DOCUMENT_BYTES + MULTIPART_OVERHEAD_BYTES);
  let form: FormData;
  try {
    form = await new Response(body, { headers: { "content-type": contentType } }).formData();
  } catch {
    throw fileIssue("v.document.file.form");
  }

  let file: File | null = null;
  const fields: Record<string, string | null> = {};
  for (const [key, value] of form.entries()) {
    if (key === "file" && typeof value !== "string" && file === null) {
      file = value;
    } else if (FORM_FIELDS.has(key) && typeof value === "string" && !(key in fields)) {
      fields[key] = value.trim() === "" ? null : value;
    } else {
      // Unknown, duplicated or mistyped part (e.g. `ownerId`, a second file): strict, like JSON.
      throw new ApiError("VALIDATION_ERROR", undefined, [
        { path: key.slice(0, 64), message: "v.invalid" },
      ]);
    }
  }
  if (!file || file.size === 0) throw fileIssue("v.document.file.required");
  if (file.size > MAX_DOCUMENT_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE");
  return { bytes, fileName: file.name, fields };
}

export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** `<uid>/<idempotency key>-<first 16 hex of sha256>`: no user text ever reaches the path. */
export function objectPath(uid: string, key: string, sha256: string): string {
  return `${uid}/${key}-${sha256.slice(0, 16)}`;
}

/**
 * Locally the function runtime reaches the API as `http://kong:8000`, which a browser cannot open.
 * `STORAGE_PUBLIC_URL` (non-secret, local env file only) rewrites the signed URL's origin. Unset
 * in hosted projects, where SUPABASE_URL is already public.
 */
export function publicSignedUrl(signedUrl: string): string {
  const base = Deno.env.get("STORAGE_PUBLIC_URL");
  if (!base || !/^https?:\/\/[^/\s]+$/.test(base)) return signedUrl;
  const url = new URL(signedUrl);
  return new URL(url.pathname + url.search, base).toString();
}

interface StorageLikeError {
  status?: number;
  statusCode?: string;
  message?: string;
}

function storageStatus(error: StorageLikeError): number {
  return Number(error.statusCode ?? error.status ?? 0);
}

function isAlreadyExists(error: StorageLikeError): boolean {
  return storageStatus(error) === 409 || /already exists/i.test(error.message ?? "");
}

function fromStorageError(error: StorageLikeError): ApiError {
  switch (storageStatus(error)) {
    case 400:
    case 404:
      return new ApiError("NOT_FOUND");
    case 403:
      return new ApiError("FORBIDDEN");
    case 413:
      return new ApiError("PAYLOAD_TOO_LARGE");
    case 415:
      return fileIssue("v.document.file.type");
    default:
      return new ApiError("INTERNAL_ERROR");
  }
}

/** Removes one object; failure is logged as an orphan (path only) and never surfaces to the user. */
async function removeObject(
  client: SupabaseClient,
  ctx: RequestContext,
  path: string,
  documentId?: string,
): Promise<boolean> {
  const { data, error } = await client.storage.from(BUCKET).remove([path]);
  if (!error && (data?.length ?? 0) === 1) return true;
  logEvent({
    fn: FN,
    requestId: ctx.requestId,
    event: "orphan_object",
    level: "warn",
    actorId: ctx.actorId,
    documentId,
    path,
    internal: error ? `storage_${storageStatus(error) || "error"}` : "not_removed",
  });
  return false;
}

export const handler = createHandler(FN, {
  GET: async (ctx) => {
    const actor = await requireActor(ctx);
    if (!ctx.url.searchParams.has("id") && !ctx.url.searchParams.has("url")) {
      const { view } = parseQuery(ctx.url, listDocumentsQuery);
      const count = (archived: boolean) => {
        const rows = actor.client
          .from("professional_documents")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", actor.id);
        return archived ? rows.not("archived_at", "is", null) : rows.is("archived_at", null);
      };
      const base = actor.client
        .from("professional_documents")
        .select(SELECT)
        .eq("owner_id", actor.id);
      const list =
        view === "trash"
          ? base.not("archived_at", "is", null).order("archived_at", { ascending: false })
          : base.is("archived_at", null).order("created_at", { ascending: false });
      const [rows, active, trash, retention] = await Promise.all([
        list.limit(200),
        count(false),
        count(true),
        actor.client.rpc("document_trash_retention_days"),
      ]);
      for (const r of [rows, active, trash, retention]) {
        if (r.error) throw fromDatabaseError(r.error);
      }
      return {
        data: {
          documents: (rows.data ?? []).map(toDocument),
          trashRetentionDays: z.number().int().positive().parse(retention.data),
          counts: { active: active.count ?? 0, trash: trash.count ?? 0 },
        } satisfies DocumentListResponse,
      };
    }

    const { id } = parseQuery(ctx.url, documentUrlQuery);
    const { data, error } = await actor.client
      .from("professional_documents")
      .select("storage_path")
      .eq("id", id)
      .eq("owner_id", actor.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND"); // missing or not owned look the same
    const signed = await actor.client.storage
      .from(BUCKET)
      .createSignedUrl(data.storage_path as string, SIGNED_URL_SECONDS);
    if (signed.error || !signed.data?.signedUrl) {
      throw signed.error ? fromStorageError(signed.error) : new ApiError("INTERNAL_ERROR");
    }
    logEvent({
      fn: FN,
      requestId: ctx.requestId,
      event: "document_url_issued",
      level: "info",
      actorId: actor.id,
      documentId: id,
    });
    return {
      data: {
        url: publicSignedUrl(signed.data.signedUrl),
        expiresInSeconds: SIGNED_URL_SECONDS,
      } satisfies DocumentUrlResponse,
    };
  },

  POST: async (ctx) => {
    const actor = await requireActor(ctx);
    // Owner-only activation flag (migration 20261019160200): 404 before the body is read. The RPC
    // and the Storage insert policy enforce the same flag. Reads and deletes stay open on purpose:
    // turning the feature off never locks a professional out of their own files.
    await requireFeature(actor, "document_wallet");
    const key = idempotencyKey(ctx.req, { required: true });
    await requireTechnician(actor, "Only professional accounts keep documents.");
    const upload = await parseUpload(ctx.req);
    const meta = parseValue(
      {
        kind: upload.fields.kind ?? null,
        title: upload.fields.title ?? upload.fileName,
        expiresAt: upload.fields.expiresAt ?? null,
        qualificationId: upload.fields.qualificationId ?? null,
      },
      uploadDocumentMetadata,
    );
    const mimeType = sniffDocumentMime(upload.bytes);
    if (!mimeType) throw fileIssue("v.document.file.type");
    const sha256 = await sha256Hex(upload.bytes);
    const path = objectPath(actor.id, key, sha256);

    // A retry of the same file under the same key finds its object already there: that is fine,
    // and that object is not ours to remove if the rest fails.
    const stored = await actor.client.storage.from(BUCKET).upload(path, upload.bytes, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "0",
    });
    if (stored.error && !isAlreadyExists(stored.error)) throw fromStorageError(stored.error);
    const uploadedHere = !stored.error;

    const created = await actor.client.rpc("create_professional_document", {
      p_idempotency_key: key,
      p_kind: meta.kind,
      p_title: meta.title,
      p_storage_path: path,
      p_mime_type: mimeType,
      p_size_bytes: upload.bytes.byteLength,
      p_sha256: sha256,
      p_expires_at: meta.expiresAt,
      p_qualification_id: meta.qualificationId,
    });
    if (created.error) {
      // Compensation only on a definitive refusal: after a timeout or an unknown error a concurrent
      // request with the same key may still commit a row on this object (review L-1); anything
      // left over is an orphan for the operations sweep.
      if (uploadedHere && DEFINITIVE_RPC_ERRORS.has(created.error.code ?? "")) {
        await removeObject(actor.client, ctx, path);
      }
      throw fromDatabaseError(created.error);
    }
    const { id, replayed } = createdRow(created.data);
    const { data, error } = await actor.client
      .from("professional_documents")
      .select(SELECT)
      .eq("id", id)
      .eq("owner_id", actor.id)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) {
      // Replay of a document deleted since: the object this request re-created has no row.
      if (uploadedHere) await removeObject(actor.client, ctx, path);
      throw new ApiError("NOT_FOUND");
    }
    return {
      status: replayed ? 200 : 201,
      data: { document: toDocument(data) } satisfies DocumentResponse,
    };
  },

  PATCH: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, documentIdQuery);
    const body = await parseJsonBody(ctx.req, z.unknown());
    const { data, error } = await actor.client
      .from("professional_documents")
      .update(documentPatch(body))
      .eq("id", id)
      .eq("owner_id", actor.id)
      .select(SELECT)
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    return { data: { document: toDocument(data) } satisfies DocumentResponse };
  },

  // The row is the source of truth: it goes first (the Storage policy refuses to delete an object
  // a row still points at). If the object then cannot be removed, the user's document is gone all
  // the same; the leftover object is logged as `orphan_object` for the operations cleanup.
  DELETE: async (ctx) => {
    const actor = await requireActor(ctx);
    const { id } = parseQuery(ctx.url, documentIdQuery);
    const { data, error } = await actor.client
      .from("professional_documents")
      .delete()
      .eq("id", id)
      .eq("owner_id", actor.id)
      .select("storage_path")
      .maybeSingle();
    if (error) throw fromDatabaseError(error);
    if (!data) throw new ApiError("NOT_FOUND");
    await removeObject(actor.client, ctx, data.storage_path as string, id);
    return { data: { deleted: true, id } satisfies DocumentDeleteResponse };
  },
});

if (import.meta.main) Deno.serve(handler);
