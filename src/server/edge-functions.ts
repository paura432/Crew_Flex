import "server-only";
import { publicEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ApiErrorBody, ApiResponse } from "@/types/api";

export type EdgeFunctionName =
  | "health"
  | "work-requirements"
  | "capacity-evaluate"
  | "matching-evaluate"
  | "professional-availability"
  | "professional-profile"
  | "professional-qualifications"
  | "user-preferences"
  | "qualification-reviews"
  | "professional-documents";

interface InvokeOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string>;
  /** JSON-serialised, except `FormData` (multipart uploads), which is sent as is. */
  body?: unknown;
  /** Extra request headers (e.g. `Idempotency-Key`); never Authorization. */
  headers?: Record<string, string>;
}

const TIMEOUT_MS = 15_000;

function failure(code: ApiErrorBody["code"], message: string, requestId: string) {
  return { ok: false as const, error: { code, message }, requestId };
}

function isEnvelope(value: unknown): value is ApiResponse<unknown> {
  return typeof value === "object" && value !== null && "ok" in value && "requestId" in value;
}

/**
 * The only way the app talks to Edge Functions. Server-side: forwards the user's access
 * token (the function verifies it), adds a request id, never throws for HTTP/network
 * failures — callers always get a typed ApiResponse.
 */
export async function invokeEdgeFunction<T>(
  name: EdgeFunctionName,
  { method = "GET", query, body, headers }: InvokeOptions = {},
): Promise<ApiResponse<T>> {
  const requestId = crypto.randomUUID();
  const supabase = await createServerSupabase();
  // getSession() is only used to obtain the token to forward; identity is verified by the
  // function itself with getClaims().
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return failure("UNAUTHORIZED", "Sign in to continue.", requestId);

  const url = new URL(`/functions/v1/${name}`, publicEnv.NEXT_PUBLIC_SUPABASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  // Multipart: fetch sets `Content-Type` with the boundary itself, so it must not be set here.
  const multipart = body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...headers,
        Authorization: `Bearer ${session.access_token}`,
        apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        ...(multipart ? {} : { "Content-Type": "application/json" }),
        "x-request-id": requestId,
      },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return failure("NETWORK_ERROR", "The service could not be reached. Try again.", requestId);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (isEnvelope(payload)) return payload as ApiResponse<T>;
  if (response.status === 404) {
    return failure("NOT_FOUND", "This service is not available yet.", requestId);
  }
  return failure("INTERNAL_ERROR", "Unexpected server error. Try again later.", requestId);
}
