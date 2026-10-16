import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { toWorkforceMembers, type WorkforceMember, type WorkforceRow } from "./map";

export type { WorkforceMember } from "./map";

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

  return toWorkforceMembers(data);
}
