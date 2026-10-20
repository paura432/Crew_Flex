import "server-only";
import type { createServerSupabase } from "@/lib/supabase/server";
import { isRecentRecovery } from "./state";

/** The verified JWT claims (not the cookie's unverified session) decide whether a reset is allowed. */
export async function hasRecentRecoverySession(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
): Promise<boolean> {
  const { data } = await supabase.auth.getClaims();
  return isRecentRecovery(data?.claims.amr, Math.floor(Date.now() / 1000));
}
