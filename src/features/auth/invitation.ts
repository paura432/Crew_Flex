import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

export interface InvitationStatus {
  /** `valid` · `other_email` · `invalid` (unknown, expired, used, revoked) · `off` (open sign-up). */
  status: "valid" | "other_email" | "invalid" | "off";
  accountType: "professional" | "organization" | null;
}

/**
 * `public.invitation_status()` (migration 20261023400000, anon-callable): what the sign-up page may say
 * about a code its holder already has. Never the address or an id. A failed read counts as invalid.
 */
export async function readInvitation(
  code: string,
  email: string | null,
): Promise<InvitationStatus> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("invitation_status", { p_code: code, p_email: email });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { status: InvitationStatus["status"]; account_type: InvitationStatus["accountType"] }
    | undefined;
  if (error || !row) return { status: "invalid", accountType: null };
  return { status: row.status, accountType: row.account_type };
}
