import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";
import { isQualificationReviewEnabled } from "@/server/feature-flags";

/**
 * Nonce-based CSP (T18, V1.8 app.mjs:151), **report-only** until a clean violation window has been
 * observed locally and in production logs; then the header name flips to `Content-Security-Policy`.
 * Next.js reads the nonce from either header and applies it to its own inline scripts.
 */
const CSP_HEADER = "Content-Security-Policy-Report-Only";
function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV === "development"; // React dev tooling needs eval
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // The wallet viewer (N-21, T-103) fetches the owner's file with its 60-second signed URL
    // (connect-src: the Supabase origin) and shows it as a blob: images need nothing new, the PDF
    // frame needs `blob:` in frame-src. The Storage origin itself is never framed or embedded.
    "img-src 'self' blob: data:",
    "frame-src 'self' blob:",
    "font-src 'self'",
    `connect-src 'self' ${publicEnv.NEXT_PUBLIC_SUPABASE_URL}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const csp = from.headers.get(CSP_HEADER);
  if (csp) redirect.headers.set(CSP_HEADER, csp);
  return redirect;
}

// UX-level protection only: real authorization happens in Edge Functions and RLS.
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set(CSP_HEADER, csp);
  const { response, userId, supabase } = await updateSession(request, requestHeaders);
  response.headers.set(CSP_HEADER, csp);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app") && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectKeepingCookies(url, response);
  }
  // X-11: platform-only pages answer a real 404. Their own notFound() runs after the /app loading
  // boundary has streamed a 200, with the requested page's title; this decides before the stream.
  if (userId && /^\/app\/(admin|recruiter)(\/|$)/.test(pathname)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("platform_role")
      .eq("id", userId)
      .maybeSingle();
    // A failed read fails closed (404); logged without the user id.
    if (error) console.warn("proxy: profile read failed for a platform page", error.code);
    const allowed =
      data?.platform_role === "platform_admin" &&
      (!pathname.startsWith("/app/admin/verifications") || isQualificationReviewEnabled());
    if (!allowed) {
      // A path no route matches renders the root not-found page with a 404 status (R-X L1: not
      // Next's internal `/_not-found` name).
      const notFound = NextResponse.rewrite(new URL("/__denied", request.url), {
        request: { headers: requestHeaders },
      });
      for (const cookie of response.cookies.getAll()) notFound.cookies.set(cookie);
      notFound.headers.set(CSP_HEADER, csp);
      return notFound;
    }
  }
  if ((pathname === "/login" || pathname === "/register") && userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return redirectKeepingCookies(url, response);
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
