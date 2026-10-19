"use client";

// Browser → Edge Function upload (multipart, user JWT). Files do not pass through Next.js on
// Vercel, whose functions accept at most 4.5 MB per request — below the 5 MiB document limit. The
// function re-validates everything (size, magic bytes, title, ownership) and stores the file in
// the private bucket; this module only adds the token and the idempotency key.
import { publicEnv } from "@/lib/env";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { ApiResponse, DocumentResponse } from "@/types/api";

export interface UploadFields {
  file: File;
  kind: string;
  title: string;
  expiresAt: string;
  qualificationId: string;
}

const failure = (code: "UNAUTHORIZED" | "NETWORK_ERROR" | "INTERNAL_ERROR", message: string) =>
  ({ ok: false, error: { code, message }, requestId: crypto.randomUUID() }) as const;

export async function uploadDocument(
  fields: UploadFields,
  idempotencyKey: string,
): Promise<ApiResponse<DocumentResponse>> {
  const supabase = createBrowserSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return failure("UNAUTHORIZED", "Sign in to continue.");

  const body = new FormData();
  body.set("file", fields.file);
  body.set("kind", fields.kind);
  body.set("title", fields.title);
  body.set("expiresAt", fields.expiresAt);
  body.set("qualificationId", fields.qualificationId);

  let response: Response;
  try {
    response = await fetch(
      new URL("/functions/v1/professional-documents", publicEnv.NEXT_PUBLIC_SUPABASE_URL),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          "Idempotency-Key": idempotencyKey,
          "x-request-id": crypto.randomUUID(),
        },
        body,
        cache: "no-store",
      },
    );
  } catch {
    return failure("NETWORK_ERROR", "The service could not be reached. Try again.");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload === "object" && payload !== null && "ok" in payload) {
    return payload as ApiResponse<DocumentResponse>;
  }
  return failure("INTERNAL_ERROR", "Unexpected server error. Try again later.");
}
