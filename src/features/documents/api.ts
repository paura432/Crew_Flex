import "server-only";
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
