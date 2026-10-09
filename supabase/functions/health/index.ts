// Liveness probe. Public, no data access, no internal details.
import { createHandler } from "../_shared/http.ts";
import type { HealthResponse } from "../../../src/types/api.ts";

export const handler = createHandler("health", {
  GET: () => ({ data: { status: "ok", time: new Date().toISOString() } satisfies HealthResponse }),
});

if (import.meta.main) Deno.serve(handler);
