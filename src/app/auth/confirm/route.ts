import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { confirmLink, safeConfirmNext } from "@/features/auth/state";
import { publicEnv } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Landing route of Supabase Auth e-mail links (`confirmLink` decides which one this is).
 * - Password recovery (`next=/reset-password`): exchanges the PKCE `code` — or a recovery `token_hash`
 *   — for a session cookie and continues; an expired or reused link goes back to the request form.
 * - Sign-up confirmation (`emailRedirectTo = /auth/confirm?next=/app`, AUTH-03): lands on the login with
 *   «Correo confirmado…» and no session — a PKCE `code` is only issued after Auth confirmed the e-mail,
 *   so it is not exchanged (a forged `?code=` only shows that banner: nothing is changed); a `token_hash`
 *   (custom template) is verified by a cookie-less client. An expired, reused or forged token lands on
 *   the login with its own notice.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeConfirmNext(searchParams.get("next"));
  const link = confirmLink({
    next,
    code: searchParams.get("code"),
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
  });
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (link.kind === "recovery") {
    const supabase = await createServerSupabase();
    const { error } = link.code
      ? await supabase.auth.exchangeCodeForSession(link.code)
      : link.tokenHash
        ? await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: "recovery" })
        : { error: new Error("missing code") };
    return to(error ? "/forgot-password?expired=1" : next);
  }
  if (link.kind === "signup_confirmed") return to("/login?confirmed=1");
  if (link.kind === "signup_token") {
    // A client with no cookie storage (security review INFO): verifying confirms the address and the
    // session it returns is simply dropped — the visitor's own cookies are never touched.
    const verifier = createClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    );
    const { error } = await verifier.auth.verifyOtp({
      token_hash: link.tokenHash,
      type: link.type,
    });
    return to(error ? "/login?confirmError=1" : "/login?confirmed=1");
  }
  return to("/login?confirmError=1");
}
