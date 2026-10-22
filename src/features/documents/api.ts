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

/**
 * Own documents with a declared expiry, read under RLS (owner only) for the review list (TD-44).
 * `null` when the query fails: the caller shows an error line, never the «nothing expires» state.
 */
export async function listOwnDocumentExpiries(): Promise<DocumentExpiry[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("professional_documents")
    .select("id, title, expires_at")
    .not("expires_at", "is", null)
    .order("expires_at")
    .overrideTypes<{ id: string; title: string; expires_at: string }[], { merge: false }>();
  if (error) return null;
  return data.map((d) => ({ id: d.id, title: d.title, expiresAt: d.expires_at }));
}

/**
 * How many documents the caller holds in the wallet (RLS: owner only) — v1.8 «evidencias» and the
 * «Documento aportado» completeness item. `null` when the count fails (the caller then leaves the
 * item out instead of claiming zero).
 */
export async function countOwnDocuments(): Promise<number | null> {
  const supabase = await createServerSupabase();
  const { count, error } = await supabase
    .from("professional_documents")
    .select("id", { count: "exact", head: true });
  return error || count === null ? null : count;
}

export interface DocumentLink {
  qualificationId: string;
  title: string;
}

/**
 * Own documents linked to a qualification, read under RLS (owner only), for the qualifications
 * page. `null` when the query fails: the page then shows no evidence line rather than a wrong one.
 */
export async function listOwnDocumentLinks(): Promise<DocumentLink[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("professional_documents")
    .select("title, qualification_id")
    .not("qualification_id", "is", null)
    .order("title")
    .overrideTypes<{ title: string; qualification_id: string }[], { merge: false }>();
  if (error) return null;
  return data.map((d) => ({ qualificationId: d.qualification_id, title: d.title }));
}
