# Edge Functions

Backend boundary for application operations (ADR-001). Deno, one function per domain operation, all
in `supabase/functions/`. Shared code in `_shared/`; business logic imported from `src/domain`
(single implementation for Next.js and Deno).

## Inventory

| Function                      | Methods                  | Auth                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Status                                                                                                                   |
| ----------------------------- | ------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `health`                      | GET                      | public                     | Liveness. Returns `{ status, time }`. No internal details.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | DEPLOYED 2026-10-16 (redeploy; E2E pending)                                                                              |
| `work-requirements`           | GET, POST                | JWT + org role             | GET `?organizationId=&limit=` list (RLS), GET `?id=` one; POST create (admin/manager) via RPC `create_work_requirement_idempotent` (wraps `create_work_requirement`) → audit `requirement.created`. **Idempotent** per `Idempotency-Key`: 201 created · 200 replay · 409 same key, other payload                                                                                                                                                                                                                                                                                                                             | DEPLOYED 2026-10-16 (idempotency; E2E pending)                                                                           |
| `capacity-evaluate`           | POST                     | JWT + admin/manager        | `{ requirementId }` → `{ capacity: { required, internallyEligible, gap, coveragePercent }, internal: EvaluatedCandidate[] }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | DEPLOYED 2026-10-16 (redeploy; E2E pending)                                                                              |
| `matching-evaluate`           | POST                     | JWT + admin/manager        | `{ requirementId }` → `{ summary: { evaluated, eligible, pool: { prefiltered, hardEligible, cap } }, candidates: EvaluatedCandidate[] }` (external pool). `pool` comes from `get_requirement_external_pool_summary` (counts only) so the UI never presents a capped list as exhaustive. 400 if the requirement has no hard qualification                                                                                                                                                                                                                                                                                     | DEPLOYED 2026-10-16 (`pool`; E2E pending)                                                                                |
| `professional-profile`        | GET, PATCH               | JWT (professional account) | Own passport: `profiles.display_name` + `technician_profiles` (base, mobility, years, status, visibility). Full replacement through RPC `update_professional_profile` (**one transaction**: both tables or neither). Optional `expectedUpdatedAt` → 409 if the passport changed since it was loaded. Strict schema rejects identity/privileged fields                                                                                                                                                                                                                                                                        | DEPLOYED 2026-10-16 (first deploy; E2E pending)                                                                          |
| `professional-qualifications` | GET, POST, PATCH, DELETE | JWT (professional account) | Own declarations: list with catalog type and the reviewer's `reviewNote`; declare via RPC `declare_qualification` (always `pending`, BR-2.7 checked against the catalog row, **idempotent** per `Idempotency-Key`: 201 · 200 replay); edit dates / withdraw; remove. `verification_status` never writable                                                                                                                                                                                                                                                                                                                    | DEPLOYED 2026-10-16 (first deploy; E2E pending)                                                                          |
| `professional-availability`   | GET, POST, PATCH, DELETE | JWT (professional account) | Own availability windows: list, create (RPC `create_availability_window`, **idempotent** per `Idempotency-Key`: 201 · 200 replay), replace, delete. Ownership = JWT subject; RLS second layer                                                                                                                                                                                                                                                                                                                                                                                                                                | DEPLOYED 2026-10-16 (idempotency; E2E pending)                                                                           |
| `user-preferences`            | GET, PATCH               | JWT (any account)          | Own `profiles.preferred_locale` (es/en). One function for professionals and organization users; strict schema; owner = JWT subject                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | DEPLOYED 2026-10-16 (first deploy; E2E pending)                                                                          |
| `qualification-reviews`       | GET, POST                | JWT + **platform admin**   | GET pending queue (active + pending, ≤ 100, minimal fields) + last 20 decisions; POST `{ qualificationId, decision: verified\|rejected, expectedUpdatedAt, note? }` → RPC `review_qualification` (DEFINER: platform role from DB, no self-review, pending only, version check → 409 if the declaration changed since loaded, row lock, audit with request id). The queue omits the reviewer's own declarations. **Fails closed twice**: 404 unless secret `QUALIFICATION_REVIEW_ENABLED=true`, and the RPC itself refuses (→ 404) unless the owner-only row `app_private.feature_flags('qualification_review', true)` exists | IMPLEMENTED (local 2026-10-15) — **OD-3 approval checkpoint**, not deployed (deployed by mistake and deleted 2026-10-16) |
| `organization-workforce`      | –                        | –                          | Invite members with consent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | PLANNED (NEXT)                                                                                                           |

No directories are created for PLANNED functions (no ghost code). `createHandler` accepts GET/POST/PATCH/DELETE.

## Response contract (`src/types/api.ts`)

```json
{ "ok": true, "data": {}, "requestId": "uuid" }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "Some fields are invalid.", "issues": [{ "path": "headcount", "message": "Headcount must be at least 1" }] }, "requestId": "uuid" }
```

| Code                 | HTTP | When                                                                                                                                                                                  |
| -------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHORIZED`       | 401  | Missing/invalid/expired JWT                                                                                                                                                           |
| `FORBIDDEN`          | 403  | Role not allowed, RLS violation, definer function "not authorized"                                                                                                                    |
| `VALIDATION_ERROR`   | 400  | Zod failure, invalid JSON, DB check/FK violation                                                                                                                                      |
| `NOT_FOUND`          | 404  | Missing **or not visible** (no existence oracle); `P0002` from our RPCs; disabled function (`qualification-reviews` without its flag)                                                 |
| `METHOD_NOT_ALLOWED` | 405  | Unsupported method                                                                                                                                                                    |
| `CONFLICT`           | 409  | Unique violation; `Idempotency-Key` reused with another payload (`CF409`); stale `expectedUpdatedAt` (`CF412`); item no longer in the expected state, e.g. already reviewed (`55000`) |
| `PAYLOAD_TOO_LARGE`  | 413  | Body > 32 KB                                                                                                                                                                          |
| `INTERNAL_ERROR`     | 500  | Anything else — generic message only                                                                                                                                                  |

The client adds `NETWORK_ERROR` when a function cannot be reached.

`issues[].message` carries **stable i18n keys** (`v.*`, e.g. `v.title.min`) rather than prose, so the browser
resolves them in the user's language (`src/i18n/validation.ts`, catalogs `messages/*.json`). `error.message`
stays an English server message; the UI shows copy keyed by `error.code`.

## Request lifecycle (`_shared/http.ts` → `createHandler`)

1. Request id: incoming `x-request-id` if it is a UUID, else a new one. Returned in body + header.
2. CORS (`_shared/cors.ts`): allowlist from `ALLOWED_ORIGINS` (comma separated; `*` ignored). Allowed
   request headers include `idempotency-key`.
   Default dev origins: `http://localhost:3000`, `http://127.0.0.1:3000`.
3. Method dispatch.
4. Handler: `requireActor` (JWT via `supabase.auth.getClaims`) → authorization from DB
   (`requireOrganizationRole`) → `parseJsonBody` / `parseQuery` (strict Zod) → domain → response.
5. Errors normalized (`_shared/errors.ts`); DB messages never forwarded.

## Idempotent creates (`Idempotency-Key`, remediation 2026-10-15, I-1)

The three create endpoints (`work-requirements` POST, `professional-availability` POST,
`professional-qualifications` POST) accept `Idempotency-Key: <uuid>`. The web app generates one key per
logical operation in the browser (`src/lib/idempotency.ts`: the same payload reuses the key until a
confirmed success; a different payload gets a new key), validates it in the server action and forwards it.
PostgreSQL enforces it (`app_private.idempotency_keys`, migration `20261015130200`): the key is scoped to
(JWT subject, operation), the request hash is computed in SQL from the canonical parameters, and the key is
claimed **in the same transaction** that creates the resource — a concurrent duplicate waits on the unique
index and then replays; a failed operation leaves no key. Responses: `201` created, `200` replay of the
original resource, `409 CONFLICT` same key with a different payload, `400` malformed key. A missing header
falls back to a fresh key (no deduplication) so older clients keep working. PATCH/DELETE are naturally
idempotent (full replacement / delete by id) and were not changed.

Never answer a `40001` from our own SQL: PostgREST retries serialization failures automatically and a
deterministic 40001 loops (observed in the local E2E run; the passport conflict uses `CF412`). 6. One structured log line: `fn, requestId, method, status, durationMs, actorId, errorCode, internal`
(error class name only). Never headers, tokens, passwords, payloads.

## Data access

- Client is bound to the caller's token → **RLS applies** (`_shared/supabase.ts`). The service role
  key is not read anywhere in V0.
- Candidate data comes from one RPC call (`get_requirement_candidate_pool`), which returns only
  matchable data and re-checks the caller's role. No N+1, no network enumeration.

## Configuration

`supabase/config.toml`: `verify_jwt = false` for all nine functions (JWT verified in code with
`getClaims`, compatible with asymmetric signing keys), `import_map = "./functions/deno.json"`.

Runtime env (platform provided): `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEYS`),
Config secret `QUALIFICATION_REVIEW_ENABLED` (`true` enables `qualification-reviews`; unset everywhere
remote until OD-3 is approved — the local template sets it). The Next.js server has its own flag
with the same name (server env, never `NEXT_PUBLIC_*`, off unless exactly `true`, `src/server/feature-flags.ts`):
it hides the platform navigation entry, makes `/app/admin/verifications` a 404 and refuses the review
action before any call. Unset in Vercel until OD-3 is approved. Config secret: `ALLOWED_ORIGINS` (comma-separated exact browser origins; production
`https://crew-flex.vercel.app` — the only environment, `ENVIRONMENTS.md`). **CORS fails closed in
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

## Deploy (executed on production 2026-10-09 with explicit authorization — log in `docs/audit/DEPLOYMENT_PLAN.md` §8)

```bash
pnpm exec supabase secrets set ALLOWED_ORIGINS=https://crew-flex.vercel.app
pnpm exec supabase functions deploy health --debug
pnpm exec supabase functions deploy professional-availability --debug
pnpm exec supabase functions deploy work-requirements capacity-evaluate matching-evaluate --debug
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:<today> pnpm e2e:production   # guarded; synthetic accounts in .env.e2e.production
```

Rollback of any step: `pnpm exec supabase functions delete <name>` (restores today's 404 state). No
schema or data change is involved.

Functions import shared code from `src/` (outside `supabase/functions`). **Verified on the first deploy**:
`supabase functions deploy --use-api --debug` uploads the seven `src/` modules reached from each entrypoint
(`src/domain/*`, `src/lib/validation/*`, `src/types/api.ts`) together with `_shared/*` and `deno.json`.
