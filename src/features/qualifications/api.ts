import "server-only";
import type { QualificationType } from "@/domain/qualification";
import { createServerSupabase } from "@/lib/supabase/server";
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
