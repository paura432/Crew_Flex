# Edge Functions

Backend boundary for application operations (ADR-001). Deno, one function per domain operation, all
in `supabase/functions/`. Shared code in `_shared/`; business logic imported from `src/domain`
(single implementation for Next.js and Deno).

## Inventory

| Function                      | Methods                  | Auth                       | Purpose                                                                                                                                               | Status                     |
| ----------------------------- | ------------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `health`                      | GET                      | public                     | Liveness. Returns `{ status, time }`. No internal details.                                                                                            | IMPLEMENTED (not deployed) |
| `work-requirements`           | GET, POST                | JWT + org role             | GET `?organizationId=&limit=` list (RLS), GET `?id=` one; POST create (admin/manager) via RPC `create_work_requirement` → audit `requirement.created` | IMPLEMENTED (not deployed) |
| `capacity-evaluate`           | POST                     | JWT + admin/manager        | `{ requirementId }` → `{ capacity: { required, internallyEligible, gap, coveragePercent }, internal: EvaluatedCandidate[] }`                          | IMPLEMENTED (not deployed) |
| `matching-evaluate`           | POST                     | JWT + admin/manager        | `{ requirementId }` → `{ summary: { evaluated, eligible }, candidates: EvaluatedCandidate[] }` (external pool)                                        | IMPLEMENTED (not deployed) |
| `professional-profile`        | –                        | –                          | Edit own technician profile/visibility                                                                                                                | PLANNED (NEXT)             |
| `professional-qualifications` | –                        | –                          | Add/edit own qualifications (always `pending`)                                                                                                        | PLANNED (NEXT)             |
| `professional-availability`   | GET, POST, PATCH, DELETE | JWT (professional account) | Own availability windows: list, create, replace, delete. Ownership = JWT subject; RLS second layer                                                    | IMPLEMENTED (not deployed) |
| `organization-workforce`      | –                        | –                          | Invite members with consent                                                                                                                           | PLANNED (NEXT)             |

No directories are created for PLANNED functions (no ghost code). `createHandler` accepts GET/POST/PATCH/DELETE.

## Response contract (`src/types/api.ts`)

```json
{ "ok": true, "data": {}, "requestId": "uuid" }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.", "issues": [{ "path": "headcount", "message": "Headcount must be at least 1" }] }, "requestId": "uuid" }
```

| Code                 | HTTP | When                                                               |
| -------------------- | ---- | ------------------------------------------------------------------ |
| `UNAUTHORIZED`       | 401  | Missing/invalid/expired JWT                                        |
| `FORBIDDEN`          | 403  | Role not allowed, RLS violation, definer function "not authorized" |
| `VALIDATION_ERROR`   | 400  | Zod failure, invalid JSON, DB check/FK violation                   |
| `NOT_FOUND`          | 404  | Missing **or not visible** (no existence oracle)                   |
| `METHOD_NOT_ALLOWED` | 405  | Unsupported method                                                 |
| `CONFLICT`           | 409  | Unique violation                                                   |
| `PAYLOAD_TOO_LARGE`  | 413  | Body > 32 KB                                                       |
| `INTERNAL_ERROR`     | 500  | Anything else — generic message only                               |

The client adds `NETWORK_ERROR` when a function cannot be reached.

## Request lifecycle (`_shared/http.ts` → `createHandler`)

1. Request id: incoming `x-request-id` if it is a UUID, else a new one. Returned in body + header.
2. CORS (`_shared/cors.ts`): allowlist from `ALLOWED_ORIGINS` (comma separated; `*` ignored).
   Default dev origins: `http://localhost:3000`, `http://127.0.0.1:3000`.
3. Method dispatch.
4. Handler: `requireActor` (JWT via `supabase.auth.getClaims`) → authorization from DB
   (`requireOrganizationRole`) → `parseJsonBody` / `parseQuery` (strict Zod) → domain → response.
5. Errors normalized (`_shared/errors.ts`); DB messages never forwarded.
6. One structured log line: `fn, requestId, method, status, durationMs, actorId, errorCode, internal`
   (error class name only). Never headers, tokens, passwords, payloads.

## Data access

- Client is bound to the caller's token → **RLS applies** (`_shared/supabase.ts`). The service role
  key is not read anywhere in V0.
- Candidate data comes from one RPC call (`get_requirement_candidate_pool`), which returns only
  matchable data and re-checks the caller's role. No N+1, no network enumeration.

## Configuration

`supabase/config.toml`: `verify_jwt = false` for all four functions (JWT verified in code with
`getClaims`, compatible with asymmetric signing keys), `import_map = "./functions/deno.json"`.

Runtime env (platform provided): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEYS`),
Config secret: `ALLOWED_ORIGINS` (comma-separated exact browser origins; production
`https://crew-flex.vercel.app`, staging its branch domain — `ENVIRONMENTS.md`). **CORS fails closed in
every environment**: a missing or empty `ALLOWED_ORIGINS` allows no browser origin; there is no runtime
detection (`SB_REGION` is not consulted) and no localhost default. Local `supabase functions serve` sets
it explicitly in `supabase/functions/.env` (template `supabase/functions/.env.example`). Server-side calls
from the Next.js app send no `Origin` and are unaffected. Future secrets (e.g. `RESEND_API_KEY`) only
through `supabase secrets set NAME=value`, read with `Deno.env.get` at runtime.

## Local verification

```bash
pnpm lint:edge       # deno lint
pnpm typecheck:edge  # deno check (includes shared src/domain + src/lib/validation)
pnpm test:edge       # deno test: envelope, auth rejection, error normalization, CORS, limits, mapping
```

## Deploy (CLI linked; execution requires explicit authorization — `docs/audit/DEPLOYMENT_PLAN.md`)

```bash
pnpm exec supabase secrets set ALLOWED_ORIGINS=https://crew-flex.vercel.app
pnpm exec supabase functions deploy health --debug
pnpm exec supabase functions deploy professional-availability --debug
pnpm exec supabase functions deploy work-requirements capacity-evaluate matching-evaluate --debug
pnpm e2e:remote   # synthetic confirmed accounts in .env.e2e (never committed)
```

Rollback of any step: `pnpm exec supabase functions delete <name>` (restores today's 404 state). No
schema or data change is involved.

Functions import shared code from `src/` (outside `supabase/functions`). The CLI bundler follows
relative imports; verify on first deploy (`supabase functions deploy --debug`). If the bundler
refuses, move `src/domain` + `src/lib/validation` behind a `_shared` re-export — not copy.
