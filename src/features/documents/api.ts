import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UpdateDocumentInput } from "@/lib/validation/documents";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  DocumentDeleteResponse,
  DocumentListResponse,
  DocumentResponse,
  DocumentUrlResponse,
} from "@/types/api";

export const listDocuments = () =>
  invokeEdgeFunction<DocumentListResponse>("professional-documents");

/** Signed URL valid for 60 seconds; only the owner gets one (Storage RLS). */
export const documentUrl = (id: string) =>
  invokeEdgeFunction<DocumentUrlResponse>("professional-documents", {
    query: { id, url: "1" },
  });

export const updateDocument = (id: string, input: UpdateDocumentInput) =>
  invokeEdgeFunction<DocumentResponse>("professional-documents", {
    method: "PATCH",
    query: { id },
    body: input,
  });

export const deleteDocument = (id: string) =>
  invokeEdgeFunction<DocumentDeleteResponse>("professional-documents", {
    method: "DELETE",
    query: { id },
  });

export interface DocumentExpiry {
  id: string;
  title: string;
  expiresAt: string;
}

/** Own documents with a declared expiry, read under RLS (owner only) for the review list (TD-44). */
export async function listOwnDocumentExpiries(): Promise<DocumentExpiry[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("professional_documents")
    .select("id, title, expires_at")
    .not("expires_at", "is", null)
    .order("expires_at")
    .overrideTypes<{ id: string; title: string; expires_at: string }[], { merge: false }>();
  return (data ?? []).map((d) => ({ id: d.id, title: d.title, expiresAt: d.expires_at }));
}
