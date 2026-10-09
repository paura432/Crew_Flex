import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Platform-provided, non-secret values. The service role key is deliberately NOT read here:
// V0 functions always act in the caller's context so that RLS applies.
function publicKey(): string {
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (anon) return anon;
  // Projects using the new API keys expose them as a JSON map.
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const first = keys ? Object.values(JSON.parse(keys) as Record<string, string>)[0] : undefined;
  if (!first) throw new Error("Supabase public key is not configured");
  return first;
}

function supabaseUrl(): string {
  const url = Deno.env.get("SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return url;
}

/** Client bound to the caller's access token: every query runs under RLS as that user. */
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl(), publicKey(), {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
