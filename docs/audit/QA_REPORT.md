# QA report — parity audit + availability slice (2026-10-09)

> **Historical log (2026-10-09/10).** Test counts and "Edge Functions are not deployed" are dated. Current
> gates: `memory-bank/01-current-state.md`.

Branch `feat/crewflex-parity-migration` (from `main` @ `52d39f9`). Every result below was executed in
this session; nothing is inferred.

## Baseline (before any change)

| Check                                    | Result                   |
| ---------------------------------------- | ------------------------ |
| `pnpm lint`                              | PASS                     |
| `pnpm typecheck`                         | PASS                     |
| `pnpm test:run`                          | PASS — 9 files, 84 tests |
| `pnpm format:check`                      | PASS                     |
| `pnpm build`                             | PASS                     |
| `pnpm typecheck:edge` / `pnpm test:edge` | PASS — 13 Deno tests     |

## After the availability slice

| Check                                                 | Result                                                                | Evidence                                                                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm lint` (eslint, max-warnings 0)                  | PASS                                                                  | `pnpm check` log                                                                                                |
| `pnpm typecheck` (next typegen + tsc strict)          | PASS                                                                  |                                                                                                                 |
| `pnpm test:run`                                       | PASS — 11 files, **101 tests** (+17: validation 7, calendar 5, RLS 5) | `src/lib/validation/availability.test.ts`, `src/features/availability/calendar.test.ts`, `tests/db/rls.test.ts` |
| `pnpm format:check`                                   | PASS                                                                  |                                                                                                                 |
| `pnpm lint:edge` (deno lint)                          | PASS — 16 files                                                       |                                                                                                                 |
| `pnpm typecheck:edge` (deno check, 5 functions)       | PASS                                                                  |                                                                                                                 |
| `pnpm test:edge`                                      | PASS — **19 Deno tests** (+6)                                         | `supabase/functions/professional-availability/index_test.ts`                                                    |
| `pnpm build`                                          | PASS — `/app/professional/availability` dynamic route built           |                                                                                                                 |
| `git diff --check`                                    | PASS                                                                  |                                                                                                                 |
| Husky pre-commit (lint-staged + typecheck + test:run) | Executed on every commit of this branch                               | commit output                                                                                                   |

## Security checks executed (automated)

| Check                                                                                                     | Where                                                 | Result |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------ |
| A. Professional A cannot read/update/delete professional B's availability windows                         | `rls.test.ts` "availability windows ownership"        | PASS   |
| E. Professional cannot insert a window for another profile; schemas reject `technicianProfileId`/`userId` | `rls.test.ts`, `availability.test.ts`, Deno 401 tests | PASS   |
| Organization admins see only their members' windows (OD-4 scope), never the network                       | `rls.test.ts`                                         | PASS   |
| DB rejects `ends_at <= starts_at`                                                                         | `rls.test.ts` (check constraint)                      | PASS   |
| Edge Function rejects unauthenticated GET/POST/PATCH/DELETE with `UNAUTHORIZED`                           | Deno tests                                            | PASS   |
| CORS preflight exposes exactly the four methods; no `*` origin                                            | Deno test                                             | PASS   |
| Previously existing checks A–H (foundation)                                                               | unchanged, still passing                              | PASS   |

## UI verification (local, headless Chromium, fixture windows; no production credentials)

| Check                                                                                                                                                             | 1440 | 768  | 390  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | ---- |
| Renders, 0 console errors/warnings, 0 px horizontal overflow                                                                                                      | PASS | PASS | PASS |
| Day states derived from windows (available / blocked / partial / rest)                                                                                            | PASS | —    | —    |
| Clicking a day covered by a multi-day window shows guidance instead of splitting                                                                                  | PASS | —    | —    |
| Client-side validation: end before start → inline error + `aria-invalid`                                                                                          | PASS | —    | —    |
| Day click without a session → server action returns `UNAUTHORIZED` → user-facing message with request id (error path exercised end-to-end up to the Edge invoker) | PASS | —    | —    |
| Edit prefill, month navigation, visible focus ring                                                                                                                | PASS | —    | —    |

Evidence: `evidence/after-1440-availability.jpg`, `evidence/after-768-availability.jpg`,
`evidence/after-390-availability.jpg`; original: `evidence/proto-1440-technician-disponibilidad.jpg`.

## Not executed (and why)

| Item                                                                               | Reason                                                                                           | Unblock                                                                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Real end-to-end against Supabase (create → reload → persists; cross-user via HTTP) | Edge Functions are not deployed; no production credentials; sign-up requires e-mail confirmation | Approve roadmap step 0 (deploy + `ALLOWED_ORIGINS` + one synthetic confirmed test account) |
| RLS policies against the **remote** database with authenticated users              | Same                                                                                             | Same                                                                                       |
| Playwright E2E suite in the repo                                                   | Not installed as a dev dependency yet (cached Chromium used ad hoc)                              | Phase 1 adds `@playwright/test` with login fixtures once a test account exists             |
| Deployed app authenticated screens                                                 | No credentials                                                                                   | Same as above                                                                              |
| axe/lighthouse accessibility audit                                                 | Not available offline; structural checks only (labels, roles, focus)                             | Add `@axe-core/playwright` with the E2E suite                                              |

## Phase 0.5 (2026-10-09, afternoon) — executed in this session

Baseline on the unchanged tree, then again after the Phase 0.5 changes (CORS fail-closed, `cors_test.ts`,
`supabase/functions/.env.example`, `.env.e2e.example`, `tests/e2e/remote-smoke.test.ts`, `e2e:remote`
script, docs).

| Check                                    | Baseline (before)                                                                                                                                                                                                                     | After Phase 0.5 changes                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm lint`                              | PASS                                                                                                                                                                                                                                  | PASS                                                                               |
| `pnpm typecheck`                         | PASS                                                                                                                                                                                                                                  | PASS                                                                               |
| `pnpm test:run`                          | PASS — 11 files, 101 tests                                                                                                                                                                                                            | PASS — 11 files + 1 skipped (remote E2E without `.env.e2e`), 101 passed, 5 skipped |
| `pnpm format:check`                      | PASS                                                                                                                                                                                                                                  | PASS (after `prettier --write` on the new/edited docs)                             |
| `pnpm build`                             | PASS                                                                                                                                                                                                                                  | PASS                                                                               |
| `pnpm lint:edge`                         | PASS — 16 files                                                                                                                                                                                                                       | PASS — 17 files                                                                    |
| `pnpm typecheck:edge`                    | PASS                                                                                                                                                                                                                                  | PASS                                                                               |
| `pnpm test:edge`                         | PASS — 19 tests                                                                                                                                                                                                                       | PASS — **21 tests** (+2 CORS allowlist)                                            |
| `git diff --check`                       | PASS                                                                                                                                                                                                                                  | PASS                                                                               |
| Husky `pre-commit` (`.husky/pre-commit`) | `pnpm lint-staged` → `pnpm typecheck` → `pnpm test:run`; `.lintstagedrc.json` runs eslint `--fix --max-warnings=0` + prettier on staged code and prettier on json/md/css/yml                                                          | executed on the Phase 0.5 commit                                                   |
| Env dependency check                     | functions read only `SUPABASE_URL`, `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEYS` (platform-provided), `ALLOWED_ORIGINS` (optional secret) and `SB_REGION` (platform-provided); the app reads only the two `NEXT_PUBLIC_*` values | no undefined variable                                                              |

Not executed (unchanged reasons): remote E2E (functions not deployed, no synthetic accounts),
authenticated deployed screens, axe/lighthouse.

## Status of the slice (per `FEATURE_INVENTORY.md`)

CF-C01…C04 = **IMPLEMENTED_UNVERIFIED**: fully implemented and tested locally (domain, validation,
RLS on Postgres 17, Deno handlers, UI), not yet verified against the deployed stack.

## Phase 0.6 (2026-10-09, evening) — executed in this session

| Check                                       | Result                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                                 | PASS                                                                                                                                                                          |
| `pnpm typecheck`                            | PASS                                                                                                                                                                          |
| `pnpm test:run` (Vitest)                    | PASS — 11 files, 101 tests; `tests/e2e/remote-smoke.test.ts` **skipped (9 tests)** because `.env.e2e` is absent — not PASS, not executed                                      |
| `pnpm format:check`                         | PASS                                                                                                                                                                          |
| `pnpm lint:edge`                            | PASS — 17 files                                                                                                                                                               |
| `pnpm typecheck:edge`                       | PASS                                                                                                                                                                          |
| `pnpm test:edge`                            | PASS — **22 tests** (+1: CORS fail-closed, parsing, exact-origin; preflight tests now set `ALLOWED_ORIGINS` explicitly)                                                       |
| `pnpm build`                                | PASS                                                                                                                                                                          |
| `git diff --check`                          | PASS                                                                                                                                                                          |
| Husky pre-commit                            | ran on the Phase 0.6 commit (lint-staged → typecheck → test:run)                                                                                                              |
| Local bundling (`deno bundle`, 5 functions) | PASS — all entrypoints bundle with the import map; 7 `src/` modules per function resolved (`EDGE_FUNCTIONS_AUDIT.md` §Phase 0.6). Supabase CLI bundling: to verify on staging |
| Source renders (S4–S7, 1440/390)            | 26 screenshots; 0 page errors; one blocked Google Fonts request (S6); 3 px masked clip in S4 at 390                                                                           |

Not executed: the ten remote E2E checks (no staging project yet), Playwright UI journeys, axe/lighthouse.

## Production deployment probes (2026-10-09, 20:05 CEST)

| Probe                                                      | Result                                                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `GET /functions/v1/health`                                 | 200, envelope OK, UUID request id                                                     |
| `GET /functions/v1/professional-availability` (no token)   | 401 `UNAUTHORIZED`                                                                    |
| `GET`/`POST /functions/v1/work-requirements` (no token)    | 401 / 401                                                                             |
| `GET /functions/v1/capacity-evaluate`, `matching-evaluate` | 405 (POST-only) ; POST without token → 401                                            |
| `OPTIONS` from `https://crew-flex.vercel.app`              | 204, exact `Access-Control-Allow-Origin`, methods `GET, POST, PATCH, DELETE, OPTIONS` |
| `OPTIONS` from `https://evil.example`                      | no `Access-Control-Allow-Origin` header                                               |
| `pnpm e2e:remote` (10 checks)                              | **NOT RUN** — no synthetic accounts yet                                               |

## Local Docker environment (2026-10-10) — executed in this session

| Check                                                                                      | Result                                                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `supabase start` (ports 563xx), migrations `20261009120000` + `20261009120100`, `seed.sql` | applied on a fresh volume; row counts in `docs/qa/LOCAL_ENVIRONMENT.md` §4                                         |
| `pnpm test:run` (PGlite RLS suite on the extended seed)                                    | PASS — 29 RLS tests; three seed-derived expectations updated (4 internal, 10 external candidates, 3 named)         |
| `pnpm e2e:remote` against the local stack (13 checks)                                      | PASS — 13 passed, 0 skipped                                                                                        |
| Browser flows (headless Chromium, 20 checks)                                               | 19 PASS; console check fails only on Next dev-overlay `Performance.measure` messages and the expected 404 resource |
| `tests/security/local-guard.test.ts`                                                       | PASS — 3 tests (remote flags, remote db-url, remote subcommands refused)                                           |
| Remote project                                                                             | not touched                                                                                                        |
