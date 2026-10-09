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

| Suite                  | Location                                | What it proves                                                                                        |
| ---------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Matching               | `src/domain/matching.test.ts`           | Brief cases 1–7 + withdrawn, pending, expiry boundaries, unavailable override, window merge, ordering |
| Capacity               | `src/domain/capacity.test.ts`           | Brief cases 8–10 + product example                                                                    |
| Qualification validity | `src/domain/qualification.test.ts`      | Period-based expiry boundaries                                                                        |
| Validation             | `src/lib/validation/*.test.ts`          | Form/API rules, strict schemas reject identity fields                                                 |
| Explanations           | `src/features/matching/explain.test.ts` | Human-readable blockers/checks                                                                        |
| Auth redirects         | `src/features/auth/state.test.ts`       | Open-redirect protection                                                                              |
| RLS / authorization    | `tests/db/rls.test.ts`                  | Security checks A–E, enumeration, audit, sign-up trigger (Postgres 17 via PGlite)                     |
| Repo hygiene           | `tests/security/repo-hygiene.test.ts`   | Checks F–G                                                                                            |
| Edge                   | `supabase/functions/_shared/*_test.ts`  | Check H, 401s, CORS, request id, limits, row mapping                                                  |

### About the RLS tests

`tests/db/supabase-stub.sql` emulates the Supabase platform pieces the migrations need (API roles,
default grants to `anon`/`authenticated`, `auth.users`, `auth.uid()`), then applies **the real
migrations and seed**. It does not replace a run against a real Supabase stack: when Docker or the
remote project is available, also run `supabase db reset` locally and repeat the checks.

## Not yet automated

- Playwright journeys (NEXT). V0 responsive/a11y checks were run manually with Playwright Chromium
  at 1440 / 820 / 390 px: no horizontal overflow, no console errors, focus visible.
- End-to-end against deployed functions (BLOCKED, OD-2).
