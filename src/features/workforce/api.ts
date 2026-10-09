import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  OrganizationRole,
  TechnicianProfileRow,
  TechnicianQualificationRow,
} from "@/types/database";

export interface WorkforceMember {
  profileId: string;
  displayName: string;
  role: OrganizationRole;
  technician: {
    baseLocation: string | null;
    yearsExperience: number | null;
    qualifications: TechnicianQualificationRow[];
  } | null;
}

interface WorkforceRow {
  profile_id: string;
  role: OrganizationRole;
  profiles: {
    display_name: string;
    technician_profiles:
      | (Pick<TechnicianProfileRow, "base_location" | "years_experience"> & {
          technician_qualifications: TechnicianQualificationRow[];
        })
      | null;
  };
}

/** Internal workforce, read under RLS (admins/managers see members' technician data, OD-4). */
export async function listWorkforce(organizationId: string): Promise<WorkforceMember[] | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `profile_id, role,
       profiles ( display_name,
         technician_profiles ( base_location, years_experience,
           technician_qualifications ( id, status, issued_at, expires_at, verification_status,
             qualification_types ( code, name, category ) ) ) )`,
    )
    .eq("organization_id", organizationId)
    .overrideTypes<WorkforceRow[], { merge: false }>();
  if (error) return null;

  return data
    .map((row) => ({
      profileId: row.profile_id,
      displayName: row.profiles.display_name,
      role: row.role,
      technician: row.profiles.technician_profiles
        ? {
            baseLocation: row.profiles.technician_profiles.base_location,
            yearsExperience: row.profiles.technician_profiles.years_experience,
            qualifications: [...row.profiles.technician_profiles.technician_qualifications].sort(
              (a, b) => a.qualification_types.code.localeCompare(b.qualification_types.code),
            ),
          }
        : null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
