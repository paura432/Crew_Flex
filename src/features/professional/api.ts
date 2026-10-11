import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { UpdateProfessionalProfileInput } from "@/lib/validation/professional";
import { invokeEdgeFunction } from "@/server/edge-functions";
import type { ProfessionalProfileResponse } from "@/types/api";
import type {
  AvailabilityWindowRow,
  TechnicianProfileRow,
  TechnicianQualificationRow,
} from "@/types/database";

export interface ProfessionalOverview {
  profile: TechnicianProfileRow;
  qualifications: TechnicianQualificationRow[];
  availability: AvailabilityWindowRow[];
}

/** The professional's own data, read under RLS (own rows only). */
export async function getOwnProfessionalOverview(
  profileId: string,
): Promise<ProfessionalOverview | null> {
  const supabase = await createServerSupabase();
  const [profile, qualifications, availability] = await Promise.all([
    supabase
      .from("technician_profiles")
      .select("profile_id, base_location, mobility, years_experience, current_status, visibility")
      .eq("profile_id", profileId)
      .maybeSingle()
      .overrideTypes<TechnicianProfileRow, { merge: false }>(),
    supabase
      .from("technician_qualifications")
      .select(
        "id, status, issued_at, expires_at, verification_status, qualification_types ( code, name, category )",
      )
      .eq("technician_profile_id", profileId)
      .overrideTypes<TechnicianQualificationRow[], { merge: false }>(),
    supabase
      .from("availability_windows")
      .select("id, starts_at, ends_at, status")
      .eq("technician_profile_id", profileId)
      .order("starts_at")
      .overrideTypes<AvailabilityWindowRow[], { merge: false }>(),
  ]);
  if (profile.error || !profile.data || qualifications.error || availability.error) return null;
  return {
    profile: profile.data,
    qualifications: [...qualifications.data].sort((a, b) =>
      a.qualification_types.code.localeCompare(b.qualification_types.code),
    ),
    availability: availability.data,
  };
}

/** Own passport through the `professional-profile` Edge Function (JWT subject = owner). */
export const getProfessionalProfile = () =>
  invokeEdgeFunction<ProfessionalProfileResponse>("professional-profile");

export const updateProfessionalProfile = (input: UpdateProfessionalProfileInput) =>
  invokeEdgeFunction<ProfessionalProfileResponse>("professional-profile", {
    method: "PATCH",
    body: input,
  });
