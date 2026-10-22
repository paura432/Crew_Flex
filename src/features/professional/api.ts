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
  /** Owner-only declared minimum rate (T-33); `null` until declared. */
  minRate: number | null;
}

/**
 * The professional's own data, read under RLS (own rows only). `null` = the account has no technician
 * profile; a failed read throws (X-16: it used to look like «this is an organization account»), so the
 * route's error boundary shows the retry with its reference.
 */
export async function getOwnProfessionalOverview(
  profileId: string,
): Promise<ProfessionalOverview | null> {
  const supabase = await createServerSupabase();
  const [profile, qualifications, availability, privateDetails] = await Promise.all([
    supabase
      .from("technician_profiles")
      .select(
        "profile_id, base_location, mobility, years_experience, current_status, visibility, primary_category, aircraft, work_permits",
      )
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
    // Owner-only row (RLS), created on the first passport save.
    supabase
      .from("technician_private_details")
      .select("min_rate")
      .eq("profile_id", profileId)
      .maybeSingle()
      .overrideTypes<{ min_rate: number | string | null }, { merge: false }>(),
  ]);
  if (profile.error || qualifications.error || availability.error || privateDetails.error) {
    throw new Error("professional overview unavailable", {
      cause: profile.error ?? qualifications.error ?? availability.error ?? privateDetails.error,
    });
  }
  if (!profile.data) return null;
  const minRate = privateDetails.data?.min_rate;
  return {
    profile: profile.data,
    qualifications: [...qualifications.data].sort((a, b) =>
      a.qualification_types.code.localeCompare(b.qualification_types.code),
    ),
    availability: availability.data,
    minRate: minRate == null ? null : Number(minRate),
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
