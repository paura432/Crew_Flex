import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * OD-3 approval checkpoint (qualification review by a platform admin). Server-side only and OFF
 * unless the Next.js server environment sets `QUALIFICATION_REVIEW_ENABLED=true` (never a
 * NEXT_PUBLIC_* value). It hides the navigation entry, turns `/app/admin/verifications` into a 404
 * and refuses the review action. It is one gate among several: the Edge Function secret of the same
 * name and the owner-only database row `app_private.feature_flags('qualification_review')` stay
 * independent, and the page, function and RPC keep re-checking the platform role.
 */
export function isQualificationReviewEnabled(): boolean {
  return process.env.QUALIFICATION_REVIEW_ENABLED === "true";
}

/** Navigation and route access: review enabled AND the profile is a platform admin. */
export function canOpenQualificationReview(profile: { platform_role: string }): boolean {
  return isQualificationReviewEnabled() && profile.platform_role === "platform_admin";
}

/**
 * Document wallet (D-10) activation, decided in Supabase — not in a Vercel variable (owner,
 * 2026-10-19). Reads `public.is_feature_enabled('document_wallet')`, backed by the owner-only row
 * `app_private.feature_flags('document_wallet', true)` (migration 20261019160200). Fails closed:
 * no session, an RPC error or anything but `true` means off. It only hides the navigation entry and
 * turns `/app/professional/documents` into a 404; the real barrier is the database (RPC, table and
 * Storage insert policies) and the Edge Function, which check the same flag on their own.
 */
export async function isDocumentWalletEnabled(): Promise<boolean> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.rpc("is_feature_enabled", { p_name: "document_wallet" });
    return !error && data === true;
  } catch {
    return false;
  }
}
