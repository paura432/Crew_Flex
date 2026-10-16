// `Idempotency-Key` for create operations (I-1). Generated in the browser once per logical
// operation (src/lib/idempotency.ts), validated on the server, forwarded to the Edge Function and
// enforced by PostgreSQL (migration 20261015130200). Deno-compatible imports.
import { z } from "zod";

export const idempotencyKeySchema = z.uuid("v.idempotencyKey.invalid");
