# Quality Gates

Never claim PASS without running the command. Never delete a failing test to get green. A
reasonable bug gets a regression test.

## Pre-commit (Husky, `.husky/pre-commit`) — fast, deterministic, strict

1. `pnpm lint-staged` — staged TS/JS: `eslint --fix --max-warnings=0` + `prettier --write`;
   JSON/MD/CSS/YAML: `prettier --write`.
2. `pnpm typecheck` — `next typegen && tsc --noEmit` (strict, `noUncheckedIndexedAccess`).
3. `pnpm test:run` — Vitest: domain, validation, explanations, PGlite RLS tests, repo hygiene (~3 s).

Verified: a staged type error blocks the commit (`husky - pre-commit script failed (code 2)`).

## Full gate — `pnpm check`

```
pnpm lint && pnpm typecheck && pnpm test:run && pnpm format:check \
  && pnpm lint:edge && pnpm typecheck:edge && pnpm test:edge
```

Before declaring a phase done, also run `pnpm build` and `git diff --check`.

Requirements: Node ≥ 24, pnpm 10, **Deno 2** (edge gates).

## Test inventory

| Suite                  | Location                                | What it proves                                                                                                                    |
| ---------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Matching               | `src/domain/matching.test.ts`           | Brief cases 1–7 + withdrawn, pending, expiry boundaries, unavailable override, window merge, ordering                             |
| Capacity               | `src/domain/capacity.test.ts`           | Brief cases 8–10 + product example                                                                                                |
| Qualification validity | `src/domain/qualification.test.ts`      | Period-based expiry boundaries                                                                                                    |
| Validation             | `src/lib/validation/*.test.ts`          | Form/API rules, strict schemas reject identity fields                                                                             |
| Passport completeness  | `src/domain/professional.test.ts`       | BR-11 percent + ordered missing items                                                                                             |
| Explanations           | `src/features/matching/explain.test.ts` | Human-readable blockers/checks                                                                                                    |
| Auth redirects         | `src/features/auth/state.test.ts`       | Open-redirect protection                                                                                                          |
| RLS / authorization    | `tests/db/rls.test.ts`                  | Security checks A–F (F = passport/qualification ownership, phase 1), enumeration, audit, sign-up trigger (Postgres 17 via PGlite) |
| Repo hygiene           | `tests/security/repo-hygiene.test.ts`   | Checks F–G                                                                                                                        |
| Edge                   | `supabase/functions/**/*_test.ts`       | Check H, 401s per function/method, 405, CORS, request id, limits, row mapping                                                     |

### About the RLS tests

`tests/db/supabase-stub.sql` emulates the Supabase platform pieces the migrations need (API roles,
default grants to `anon`/`authenticated`, `auth.users`, `auth.uid()`), then applies **the real
migrations and seed**. It does not replace a run against a real Supabase stack: when Docker or the
remote project is available, also run `supabase db reset` locally and repeat the checks.

## Not yet automated

- Remote smoke E2E against the deployed Edge Functions: `pnpm e2e:remote` (`tests/e2e/remote-smoke.test.ts`),
  skipped unless `.env.e2e` provides synthetic confirmed accounts (`docs/audit/DEPLOYMENT_PLAN.md` §6).
- Local E2E against the Docker stack: `node --env-file=.env.e2e node_modules/vitest/vitest.mjs run tests/e2e`
  (17 checks incl. phase 1: passport edit/persistence/isolation, pending-only declarations, BR-2.7,
  B cannot touch A's declaration, withdrawn hard qualification changes matching deterministically).
  `pnpm test:run` without the env file reports these as **skipped** — a green `pnpm check` alone is not a
  PASS for E2E; run the command above.
- Browser smoke `scripts/local/ui-smoke.mjs` (`docs/qa/LOCAL_ENVIRONMENT.md` §5): login/logout, passport,
  qualifications, availability, organization flows, cross-org 404, 1440 / 768 / 390 px without horizontal
  overflow, only localhost. Expected 404s (cross-organization page) are excluded from the console check.
- Playwright journeys as a repo test suite (NEXT).
- End-to-end against deployed functions (BLOCKED, OD-2).
