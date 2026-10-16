# 02 · Architecture map

Canonical: `docs/architecture/ARCHITECTURE.md`, `docs/architecture/ADR-001-foundation.md` (backend
boundary), `docs/architecture/ADR-002-modular-domain-architecture.md` (modular monolith, domain
boundaries, evolution). Verified against the code on 2026-10-15 (`a7fd5a7` + uncommitted).

## Layers (as built)

```
Browser ── untrusted ───────────────────────────────────────────────────────────────────────
  │ cookies (@supabase/ssr)                        11 "use client" components (forms, managers)
  ▼
Next.js 16 App Router (Node, Vercel) ─────────────────────────────────────────────────────────
  src/proxy.ts               session refresh + redirect of /app/** (UX only, not a security layer)
  src/app/**                 thin routes, Server Components; every /app page calls requireSessionActor()
  src/features/<d>/actions.ts  "use server": Zod parse → invokeEdgeFunction() → revalidatePath
  src/features/<d>/api.ts      server-only reads: invokeEdgeFunction() or PostgREST under RLS
  src/server/edge-functions.ts invokeEdgeFunction(name,{method,query,body,headers}) — forwards the
                               user's access token; 15 s timeout; NETWORK_ERROR normalisation
  src/server/session.ts        getSessionActor / requireSessionActor / requireOrganizationContext
  ▼ user JWT
Supabase Edge Functions (Deno) ── supabase/functions/<name>/index.ts ───────────────────────
  _shared/http.ts   createHandler(): CORS allowlist, method table, request id, envelope, logging
  _shared/auth.ts   requireActor() (auth.getClaims) · requireOrganizationRole() (role read from DB)
  _shared/validation.ts parseJsonBody (strict Zod, 32 KiB) · parseQuery · idempotencyKey · createdRow
  _shared/errors.ts ApiError + fromDatabaseError (SQLSTATE → code, DB message never forwarded:
                    42501 → 403 · 22xxx/23502/23503/23514 → 400 · 23505/40001/CF412/CF409/55000 → 409 ·
                    P0002/PGRST116/0A000 → 404 · anything else → 500)
  imports PURE code from src/: domain/*, lib/validation/*, lib/candidate-pool.ts, types/api.ts, i18n/config.ts
  ▼ same user JWT (createUserClient) — RLS applies; no service role anywhere
PostgreSQL 17 ── supabase/migrations/*.sql ────────────────────────────────────────────────
  RLS on every public table · column grants · SECURITY DEFINER RPCs with search_path='' and in-body
  role checks · deferred constraint triggers (BR-1.4) · audit triggers · app_private schema (not exposed)
```

## Directories and ownership

| Path                                 | Owns                                                                                                                                 | May import                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `src/domain/`                        | Pure rules: matching, capacity, availability, qualification validity, completeness, requirement types                                | `zod`, siblings. **Nothing else** (runs in Deno) |
| `src/lib/validation/`                | Zod schemas shared by forms, server actions and functions                                                                            | `zod`, `src/domain`, `src/i18n/config.ts`        |
| `src/lib/candidate-pool.ts`          | RPC row → `Candidate` mapper (one copy for Node and Deno)                                                                            | domain                                           |
| `src/types/api.ts`                   | Edge Function response contracts (DTOs)                                                                                              | domain types                                     |
| `src/types/database*.ts`             | Generated DB types (`pnpm db:types`)                                                                                                 | —                                                |
| `src/features/<domain>/`             | `api.ts` (reads), `actions.ts` (server actions), `components/`, pure view mappers (`map.ts`, `explain.ts`, `pool.ts`, `calendar.ts`) | domain, lib, server, components                  |
| `src/app/`                           | Routes, layouts, loading/error states only                                                                                           | features, components, server                     |
| `src/components/{ui,layout}/`        | Design-system primitives, app shell, nav                                                                                             | lib                                              |
| `src/i18n/`, `messages/{en,es}.json` | next-intl config, locale resolution, catalogs                                                                                        | —                                                |
| `supabase/functions/_shared/`        | HTTP envelope, CORS, auth, errors, validation, requirement loaders                                                                   | src pure modules                                 |
| `supabase/migrations/`               | Schema, RLS, grants, RPCs, triggers — **source of truth**                                                                            | —                                                |
| `tests/db/`                          | PGlite: real migrations + seed + Supabase stub                                                                                       | —                                                |
| `tests/e2e/`                         | Env-gated E2E (local Docker or guarded remote)                                                                                       | —                                                |
| `scripts/local/`                     | Local-only wrapper, race checks, browser smoke, cleanup                                                                              | —                                                |

## Forbidden dependencies

- `src/domain` → anything with I/O, React, Next, Supabase, `@/` aliases (Deno cannot resolve them; use
  relative `.ts` imports).
- Business rules in JSX or in `src/app`. A rule used by a component lives in `src/domain` (or a pure
  `features/*/map.ts`-style mapper for presentation only).
- Browser → Edge Function or browser → PostgREST for writes. The browser holds no Supabase data client.
- Edge Functions → service role / secret keys (hygiene test `tests/security/repo-hygiene.test.ts`).
- A second matching/capacity/availability algorithm (SQL prefilters must be parity-tested, see 03).
- `NEXT_PUBLIC_*` secrets; only `NEXT_PUBLIC_SUPABASE_URL` and `…_PUBLISHABLE_KEY` exist (`src/lib/env.ts`).

Not enforced by lint today (ESLint has no import-boundary rule); enforced by review and by Deno failing
on non-relative imports from `src/domain`.

## Concrete examples

| Pattern                              | Example                                                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Write path                           | `src/features/requirements/actions.ts` → `work-requirements` → RPC `create_work_requirement_idempotent` (`20261015130200`)                                                                                                         |
| Read via function                    | `src/features/matching/api.ts` → `matching-evaluate` → `ranked_external_pool` + `evaluateMatch()`                                                                                                                                  |
| Direct read under RLS (allowed)      | `src/server/session.ts` (own profile + memberships), `src/features/qualifications/api.ts` (catalog), `src/features/professional/api.ts` (own rows)                                                                                 |
| Direct read of **other users'** rows | `src/features/workforce/api.ts` reads members' technician data under RLS (`can_view_member`, OD-4) — the one exception to ADR-001 §4 "own context"; move behind a function when member management (`organization-workforce`) lands |
| Atomic multi-table write             | `professional-profile` → RPC `update_professional_profile` (optimistic lock, CF412)                                                                                                                                                |
| Idempotent create                    | `Idempotency-Key` header → `app_private.idempotency_keys` in the same transaction                                                                                                                                                  |
| Privileged operation                 | `review_qualification` (DEFINER; flag row + `is_platform_admin()` + not own + version check)                                                                                                                                       |

## Contracts

- Response envelope: `{ ok: true, data, requestId } | { ok: false, error: { code, message, issues? }, requestId }`
  (`supabase/functions/_shared/http.ts`, `src/types/api.ts`).
- Error codes: `ERROR_STATUS` in `supabase/functions/_shared/errors.ts`; UI maps them to i18n keys.
- Input schemas are strict (unknown keys rejected); identity (`userId`, `role`, `organizationId` of the
  actor) never comes from the payload.
- **Known drift:** `src/types/database.generated.ts` includes `preferred_locale` but not the
  `20261015130*` columns/RPCs; functions parse RPC results with Zod, so this is a typing gap, not a
  runtime one. `pnpm db:types` targets the production project — regenerate from the local stack when
  schema changes are local-only.

## Trust boundaries

| Boundary                    | Rule                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Browser → Next server       | Untrusted; Zod in server actions; session checked server-side per page                                     |
| Next server → Edge Function | Re-validated; only the user's access token is forwarded                                                    |
| Edge Function → Postgres    | User context; RLS + grants decide; function code adds role checks                                          |
| DEFINER function            | Privileged: `auth.uid()` + role check in the body, `search_path = ''`, EXECUTE revoked from `public, anon` |
| `app_private` schema        | Not exposed by PostgREST; no grants to API roles                                                           |
| Secrets                     | Function secrets only (`ALLOWED_ORIGINS`, `QUALIFICATION_REVIEW_ENABLED`)                                  |

## ADRs

| ADR     | Decision                                                                    | Status                                       |
| ------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| ADR-001 | Edge Functions as the application backend boundary; RLS as defence in depth | Accepted 2026-10-09                          |
| ADR-002 | Keep the modular monolith; domain boundaries; incremental hardening         | Proposed 2026-10-15 (needs owner acceptance) |
