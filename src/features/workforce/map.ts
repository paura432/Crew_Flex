// Pure mapping of the workforce query (no I/O), kept apart from the server-only API for tests.
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

export interface WorkforceRow {
  profile_id: string;
  role: OrganizationRole;
  /** `null` when RLS hides the member's profile from the caller (only admins/managers see it). */
  profiles: {
    display_name: string;
    technician_profiles:
      | (Pick<TechnicianProfileRow, "base_location" | "years_experience"> & {
          technician_qualifications: TechnicianQualificationRow[];
        })
      | null;
  } | null;
}

/** Members whose profile RLS hides from the caller are omitted, never dereferenced. */
export function toWorkforceMembers(rows: WorkforceRow[]): WorkforceMember[] {
  return rows
    .flatMap((row) => (row.profiles ? [{ ...row, profiles: row.profiles }] : []))
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
