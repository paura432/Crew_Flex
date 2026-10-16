# Supabase current state — project `sbjkzrkmcekokkqiuvvh`

> **Historical (2026-10-09/10).** Since then: 5 functions deployed (2026-10-09 evening), and 8 more migrations
> (`20261011120000`, `20261015*`) plus 4 functions exist **locally only** — "local = remote" below is no longer
> true. Current state: `memory-bank/01-current-state.md`.

Read-only inspection on 2026-10-09 via the linked Supabase CLI (`supabase/.temp/project-ref` present, 3
projects visible to the token) and public REST/Auth endpoints with the publishable key. The claude.ai
Supabase MCP connector still returns "You do not have permission" for this project (different account).
No remote resource was created or modified during this audit.

## Four different states, per item

| Item                                                                                                                | Local code                                  | Applied remotely                                                                                              | Deployed                                            | Verified by real test                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Migration `20261009120000_foundation_v0` (10 tables, 15 enums, RLS, grants, 26 policies, 11 functions, triggers)    | yes                                         | **yes** (`migration list` shows local = remote)                                                               | n/a                                                 | PGlite RLS suite (24 tests) locally; remote: REST probes only                                    |
| Migration `20261009120100_qualification_catalog` (17 rows)                                                          | yes                                         | **yes** (`estimated_row_count = 17`)                                                                          | n/a                                                 | REST: `anon` → `42501 permission denied` (our REVOKE in effect)                                  |
| Edge Functions `health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`, `professional-availability` | yes                                         | n/a                                                                                                           | **yes — deployed 2026-10-09 20:05** (5 × ACTIVE)    | health 200, 401/405 probes, CORS probes (see `DEPLOYMENT_PLAN.md` §8); authenticated E2E pending |
| Edge Function secrets (`ALLOWED_ORIGINS`)                                                                           | documented                                  | —                                                                                                             | **set 2026-10-09** (`https://crew-flex.vercel.app`) | preflight probes: exact origin echoed, foreign origin denied                                     |
| Storage buckets                                                                                                     | none designed yet (PLANNED `evidence`)      | **none** (`/storage/v1/bucket` → `[]`)                                                                        | —                                                   | —                                                                                                |
| Generated DB types                                                                                                  | hand-written subset `src/types/database.ts` | —                                                                                                             | —                                                   | `gen types --linked` works now (15 objects: 10 tables + 5 functions) → used in this branch       |
| Auth                                                                                                                | email/password, sign-up metadata trigger    | **email provider enabled**, `disable_signup=false`, `mailer_autoconfirm=false` (confirmation e-mail required) | n/a                                                 | Login probe against real Auth returns `invalid_credentials` as expected                          |

## Remote schema (public) — from `gen types` and `inspect db table-stats`

| Table                             | Rows (est.) | RLS | Notes                                                                                                                         |
| --------------------------------- | ----------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                        | 1           | on  | one real account exists (the deploy's first user)                                                                             |
| `technician_profiles`             | 1           | on  | belongs to that account (professional)                                                                                        |
| `organizations`                   | 0           | on  |                                                                                                                               |
| `organization_members`            | 0           | on  |                                                                                                                               |
| `qualification_types`             | 17          | on  | catalog applied                                                                                                               |
| `technician_qualifications`       | 0           | on  |                                                                                                                               |
| `availability_windows`            | 0           | on  | **empty → the deployed Availability page correctly showed "No availability windows"; the page has no editing (UI_ONLY read)** |
| `work_requirements`               | 0           | on  |                                                                                                                               |
| `work_requirement_qualifications` | 0           | on  |                                                                                                                               |
| `audit_events`                    | 0           | on  |                                                                                                                               |

Functions exposed through PostgREST: `can_view_member`, `create_work_requirement`,
`get_requirement_candidate_pool`, `has_org_role`, `is_org_member`, `is_platform_admin`. Probing them as
`anon` returns `42501` / signature mismatch, i.e. the `REVOKE … FROM anon` grants are active.

RLS is **enabled** on all 10 tables (verified by the `42501` responses for `anon` on every table and by the
local PGlite suite which applies the same migration files). RLS policies were **not** exercised against
the remote database with authenticated users in this audit (no credentials; sign-up requires e-mail
confirmation). See `QA_REPORT.md` for what was executed.

## Deployment (Vercel)

`https://crew-flex.vercel.app` serves the current `main` (`6ebe0f7` content): public routes `/`, `/login`,
`/register` render; `/app/**` redirects to `/login?next=…` without a session; security headers present
(`x-frame-options: DENY`, `nosniff`, referrer-policy). Vercel configuration was not inspected or changed.

## Phase 0.5 additions (2026-10-09, afternoon, read-only)

- JWT signing: one **ES256** key published at `/auth/v1/.well-known/jwks.json` → `getClaims()` in the
  functions verifies tokens locally; no `verify_jwt` gateway dependency.
- `supabase branches list` → none. No staging branch or second project: deploys go straight to
  production (`DEPLOYMENT_PLAN.md` §2, OD-9).
- `functions list` → still `[]`; `secrets list` → still `[]`; `/functions/v1/health` → 404.
- Auth settings unchanged (`mailer_autoconfirm=false`); the test-account procedure uses per-user
  auto-confirmation in the Dashboard, never the global setting.
- Remote compatibility of the five functions is confirmed at type level by `gen types --linked`
  (`EDGE_FUNCTIONS_AUDIT.md`).

## Consequence for the parity work

- Anything that calls an Edge Function from the deployed app currently fails (functions not deployed): the
  organization dashboard, requirements list/create, capacity and matching are `IMPLEMENTED_UNVERIFIED`
  remotely even though they pass local tests.
- Deploying the functions and setting `ALLOWED_ORIGINS` is the single most valuable remote action and
  requires explicit approval (see `IMPLEMENTATION_ROADMAP.md` step 0).
- The new `professional-availability` function (this branch) is in the same situation until deployed.

## Deployment executed (2026-10-09, evening)

With the owner's explicit authorization (no staging exists yet), the five functions and the `ALLOWED_ORIGINS`
secret were deployed to this project; `main` (`f79d5f5`) was pushed and is what Vercel serves. Verified by
unauthenticated probes only; the authenticated E2E (`pnpm e2e:remote`) needs synthetic confirmed accounts.
