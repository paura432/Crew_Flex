import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { ProfessionalCategory, Skill, TypeRating } from "@/domain/passport";
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
  /** The declarations the v1.8 medals summarise (N-15): own row, read under RLS. */
  medalSource: {
    categories: ProfessionalCategory[];
    skills: Skill[];
    typeRatings: TypeRating[];
  };
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
  const [profile, qualifications, availability, privateDetails, ratings] = await Promise.all([
    supabase
      .from("technician_profiles")
      .select(
        "profile_id, base_location, mobility, years_experience, current_status, visibility, primary_category, aircraft, work_permits, categories, skills",
      )
      .eq("profile_id", profileId)
      .maybeSingle()
      .overrideTypes<
        TechnicianProfileRow & { categories: ProfessionalCategory[]; skills: Skill[] },
        { merge: false }
      >(),
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
    supabase
      .from("technician_type_ratings")
      .select("aircraft, category, expires_at, restrictions")
      .eq("technician_profile_id", profileId)
      .order("created_at")
      .overrideTypes<
        {
          aircraft: TypeRating["aircraft"];
          category: TypeRating["category"];
          expires_at: string | null;
          restrictions: string | null;
        }[],
        { merge: false }
      >(),
  ]);
  if (
    profile.error ||
    qualifications.error ||
    availability.error ||
    privateDetails.error ||
    ratings.error
  ) {
    throw new Error("professional overview unavailable", {
      cause:
        profile.error ??
        qualifications.error ??
        availability.error ??
        privateDetails.error ??
        ratings.error,
    });
  }
  if (!profile.data) return null;
  const minRate = privateDetails.data?.min_rate;
  const { categories, skills, ...row } = profile.data;
  return {
    profile: row,
    medalSource: {
      categories: categories ?? [],
      skills: skills ?? [],
      typeRatings: ratings.data.map((r) => ({
        aircraft: r.aircraft,
        category: r.category,
        expiresAt: r.expires_at,
        restrictions: r.restrictions,
      })),
    },
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
