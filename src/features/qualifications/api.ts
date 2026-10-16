import "server-only";
import type { QualificationType } from "@/domain/qualification";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  CreateQualificationInput,
  UpdateQualificationInput,
} from "@/lib/validation/professional";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type {
  QualificationDeleteResponse,
  QualificationListResponse,
  QualificationResponse,
} from "@/types/api";
import type { QualificationTypeRow } from "@/types/database";

/** Reference catalog — direct read under RLS (ADR-001 §4). */
export async function listQualificationTypes(): Promise<QualificationType[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("qualification_types")
    .select("id, code, name, category, requires_expiry")
    .order("category")
    .order("code")
    .overrideTypes<QualificationTypeRow[], { merge: false }>();
  if (error) return null;
  return data.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    requiresExpiry: row.requires_expiry,
  }));
}

/** Own declarations through the `professional-qualifications` Edge Function (JWT subject = owner). */
export const listQualifications = () =>
  invokeEdgeFunction<QualificationListResponse>("professional-qualifications");

export const createQualification = (input: CreateQualificationInput, idempotencyKey: string) =>
  invokeEdgeFunction<QualificationResponse>("professional-qualifications", {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  });

export const updateQualification = (id: string, input: UpdateQualificationInput) =>
  invokeEdgeFunction<QualificationResponse>("professional-qualifications", {
    method: "PATCH",
    query: { id },
    body: input,
  });

export const deleteQualification = (id: string) =>
  invokeEdgeFunction<QualificationDeleteResponse>("professional-qualifications", {
    method: "DELETE",
    query: { id },
  });
