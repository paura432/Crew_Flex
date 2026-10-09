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

export function parseQuery<S extends z.ZodType>(url: URL, schema: S): z.infer<S> {
  const result = schema.safeParse(Object.fromEntries(url.searchParams));
  if (!result.success) throw toApiError(result.error);
  return result.data;
}
