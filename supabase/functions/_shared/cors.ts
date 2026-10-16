// CORS allowlist — fail closed, everywhere.
//
// The only source of allowed browser origins is the ALLOWED_ORIGINS variable (comma-separated,
// exact origins, no wildcard). When it is missing or empty NO origin is allowed, in production,
// in staging and in local `supabase functions serve` alike: there is no runtime detection and
// no localhost default. Local development sets it explicitly in supabase/functions/.env
// (template: supabase/functions/.env.example). Server-side calls from the Next.js app carry no
// Origin header and are unaffected; CORS only governs direct browser calls.

export function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => /^https?:\/\/[^/\s*]+$/.test(origin));
}

export function corsHeaders(req: Request, methods: string[]): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = [...methods, "OPTIONS"].join(", ");
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info, x-request-id, idempotency-key";
    headers["Access-Control-Expose-Headers"] = "x-request-id";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}
