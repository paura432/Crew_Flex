// CORS allowlist. Never `*` for authenticated endpoints. Production origins are configured
// with the ALLOWED_ORIGINS function secret (comma-separated, no wildcard).

const DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function allowedOrigins(): string[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEV_ORIGINS;
  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");
}

export function corsHeaders(req: Request, methods: string[]): Record<string, string> {
  const headers: Record<string, string> = { Vary: "Origin" };
  const origin = req.headers.get("Origin");
  if (origin && allowedOrigins().includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = [...methods, "OPTIONS"].join(", ");
    headers["Access-Control-Allow-Headers"] =
      "authorization, apikey, content-type, x-client-info, x-request-id";
    headers["Access-Control-Expose-Headers"] = "x-request-id";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}
