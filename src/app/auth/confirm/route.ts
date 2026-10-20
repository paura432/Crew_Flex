import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeConfirmNext } from "@/features/auth/state";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Landing route of Supabase Auth e-mail links (password recovery). Exchanges the PKCE `code` — or a
 * `token_hash` when the e-mail template uses one — for a session cookie, then continues to `next`.
 * An expired or reused link goes back to the request form with a notice.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeConfirmNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  // Recovery links only: any other `token_hash` type (magic link, invite…) would allow login CSRF.
  const type: EmailOtpType | null = searchParams.get("type") === "recovery" ? "recovery" : null;

  const supabase = await createServerSupabase();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  return NextResponse.redirect(new URL(error ? "/forgot-password?expired=1" : next, request.url));
}
