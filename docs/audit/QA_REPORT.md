# QA report — parity audit + availability slice (2026-10-09)

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

## Status of the slice (per `FEATURE_INVENTORY.md`)

CF-C01…C04 = **IMPLEMENTED_UNVERIFIED**: fully implemented and tested locally (domain, validation,
RLS on Postgres 17, Deno handlers, UI), not yet verified against the deployed stack.
