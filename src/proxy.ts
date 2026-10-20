import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

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
    "img-src 'self' blob: data:",
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
  const { response, userId } = await updateSession(request, requestHeaders);
  response.headers.set(CSP_HEADER, csp);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/app") && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectKeepingCookies(url, response);
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
