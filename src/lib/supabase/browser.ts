"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Browser client, public configuration only (URL + publishable key). Used solely to read the
 * signed-in user's access token for calls that must not go through Vercel (file uploads larger
 * than the 4.5 MB function request limit). Authorization is still decided by the Edge Function
 * and RLS from that token.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
