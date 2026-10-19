import type { z } from "zod";
import { ApiError } from "./errors.ts";

export const MAX_BODY_BYTES = 32 * 1024;

function toApiError(error: z.ZodError): ApiError {
  return new ApiError(
    "VALIDATION_ERROR",
    undefined,
    error.issues.slice(0, 20).map((issue) => ({
      path: issue.path.map(String).join(".") || "body",
      message: issue.message,
    })),
  );
}

export async function parseJsonBody<S extends z.ZodType>(
  req: Request,
  schema: S,
): Promise<z.infer<S>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) throw new ApiError("PAYLOAD_TOO_LARGE");
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    throw new ApiError("PAYLOAD_TOO_LARGE");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw toApiError(result.error);
  return result.data;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `Idempotency-Key` (I-1): one UUID per logical create, chosen by the client and reused on retries.
 * A malformed key is a 400. A missing key falls back to a fresh one (no deduplication) so callers
 * that predate the header keep working; the web app always sends it.
 */
export function idempotencyKey(req: Request, { required = false } = {}): string {
  const header = req.headers.get("idempotency-key");
  if (header === null && !required) return crypto.randomUUID();
  if (header === null) {
    throw new ApiError("VALIDATION_ERROR", undefined, [
      { path: "Idempotency-Key", message: "v.idempotencyKey.invalid" },
    ]);
  }
  if (!UUID.test(header.trim())) {
    throw new ApiError("VALIDATION_ERROR", undefined, [
      { path: "Idempotency-Key", message: "v.idempotencyKey.invalid" },
    ]);
  }
  return header.trim().toLowerCase();
}

/** The idempotent create RPCs return one `{ id, replayed }` row. */
export function createdRow(data: unknown): { id: string; replayed: boolean } {
  const row = Array.isArray(data) ? data[0] : data;
  if (
    typeof row !== "object" ||
    row === null ||
    typeof (row as { id?: unknown }).id !== "string" ||
    typeof (row as { replayed?: unknown }).replayed !== "boolean"
  ) {
    throw new ApiError("INTERNAL_ERROR");
  }
  return row as { id: string; replayed: boolean };
}

/** Validates an already-decoded value (e.g. multipart form fields) with the same error shape. */
export function parseValue<S extends z.ZodType>(raw: unknown, schema: S): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) throw toApiError(result.error);
  return result.data;
}

export function parseQuery<S extends z.ZodType>(url: URL, schema: S): z.infer<S> {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) throw toApiError(result.error);
  return result.data;
}
