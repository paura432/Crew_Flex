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

| Suite                  | Location                                                  | What it proves                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Matching               | `src/domain/matching.test.ts`                             | Brief cases 1–7 + withdrawn, pending, expiry boundaries, unavailable override, window merge, ordering                                                                                                                                                                                                                                |
| Capacity               | `src/domain/capacity.test.ts`                             | Brief cases 8–10 + product example                                                                                                                                                                                                                                                                                                   |
| Qualification validity | `src/domain/qualification.test.ts`                        | Period-based expiry boundaries                                                                                                                                                                                                                                                                                                       |
| Validation             | `src/lib/validation/*.test.ts`                            | Form/API rules, strict schemas reject identity fields                                                                                                                                                                                                                                                                                |
| Passport completeness  | `src/domain/professional.test.ts`                         | BR-11 percent + ordered missing items                                                                                                                                                                                                                                                                                                |
| i18n                   | `tests/i18n/messages.test.ts`, `src/i18n/resolve.test.ts` | Catalog parity (keys, placeholders, rich tags), every `v.*`/enum/API key present, glossary terms kept; locale precedence and Accept-Language parsing                                                                                                                                                                                 |
| Explanations           | `src/features/matching/explain.test.ts`                   | Human-readable blockers/checks                                                                                                                                                                                                                                                                                                       |
| Auth redirects         | `src/features/auth/state.test.ts`                         | Open-redirect protection                                                                                                                                                                                                                                                                                                             |
| RLS / authorization    | `tests/db/rls.test.ts`                                    | Security checks A–F (F = passport/qualification ownership, phase 1), enumeration, audit, sign-up trigger (Postgres 17 via PGlite); 2026-10-15: J (BR-1.4 at commit), K (atomic passport), L (idempotent creates), M (eligible-first pool + SQL ↔ `evaluateMatch` parity on 300 random profiles, 50/100/101/500), N (platform review) |
| Repo hygiene           | `tests/security/repo-hygiene.test.ts`                     | Checks F–G                                                                                                                                                                                                                                                                                                                           |
| Edge                   | `supabase/functions/**/*_test.ts`                         | Check H, 401s per function/method, 405, CORS, request id, limits, row mapping; `Idempotency-Key`, `CF409`/`CF412`/`55000`/`P0002` mapping, review function fails closed                                                                                                                                                              |
| Edge client            | `src/server/edge-functions.test.ts`                       | E-4: unreachable/timeout → `NETWORK_ERROR`, non-envelope → generic error, session token cannot be overridden                                                                                                                                                                                                                         |
| Matching completeness  | `src/features/matching/pool.test.ts`                      | 50/100/101/500: complete · near misses trimmed · partial result                                                                                                                                                                                                                                                                      |
| Memory bank / agents   | `tests/docs/memory-bank.test.ts`                          | `memory-bank/` required files, links and quoted paths resolve, status vocabulary, decision ids exist in canonical docs, dated state, no secret-looking values; `.claude/agents/` frontmatter, reviewers read-only                                                                                                                    |
| Concurrency (real PG)  | `scripts/local/db-race-check.sh`                          | Local Docker only: E-3 race (sequential + simultaneous commits), I-1 same-key race, double review                                                                                                                                                                                                                                    |

### About the RLS tests

`tests/db/supabase-stub.sql` emulates the Supabase platform pieces the migrations need (API roles,
default grants to `anon`/`authenticated`, `auth.users`, `auth.uid()`), then applies **the real
migrations and seed**. It does not replace a run against a real Supabase stack: when Docker or the
remote project is available, also run `supabase db reset` locally and repeat the checks. _(2026-10-15: the local
Docker stack is available and is the default second check — apply new migrations with
`bash scripts/local/sb-local.sh migration up`; reset only when a clean slate is wanted.)_

## Not yet automated

- Remote smoke E2E against the deployed Edge Functions: `pnpm e2e:production` (`tests/e2e/remote-smoke.test.ts`,
  `.env.e2e.production`, guarded; `docs/architecture/ENVIRONMENTS.md` §3). Never run in production yet.
- Local E2E against the Docker stack: `node --env-file=.env.e2e node_modules/vitest/vitest.mjs run tests/e2e`
  (19 checks incl. phase 1: passport edit/persistence/isolation, pending-only declarations, BR-2.7,
  B cannot touch A's declaration, withdrawn hard qualification changes matching deterministically; phase 1.5:
  language preference persisted per user, isolated, validated, for both account types).
  `pnpm test:run` without the env file reports these as **skipped** — a green `pnpm check` alone is not a
  PASS for E2E; run the command above. Since 2026-10-15 the same command also runs
  `tests/e2e/local-remediation.test.ts` (6 local-only checks: E-3 via PostgREST, I-1 replays, I-3 conflict,
  pool completeness, platform review → matching), 25 in total.
- Release-2 compatibility drill `bash scripts/local/release-compat/release2.sh` (resets the local DB twice, ~2 min;
  `docs/qa/ROLLOUT_PLAN_RELEASE2.md` §3): production `work-requirements` vs the working tree's, each on schema 15 and 20;
  23 checks, 2026-10-20 23/23. Afterwards re-insert the local flag rows and restart `functions serve` (stale
  connections make the wallet E2E fail until then).
- Browser smoke `scripts/local/ui-smoke.mjs` (`docs/qa/LOCAL_ENVIRONMENT.md` §5): login/logout, passport,
  qualifications, availability, organization flows, cross-org 404, 1440 / 768 / 390 px without horizontal
  overflow, only localhost; **both languages**: Settings → Español → navigate → reload (flow 6), English →
  sign out → sign in with cookies cleared (flow 7), Spanish screenshots and an English-sentinel check on
  every main screen, SSR `<html lang>`. Expected 404s (cross-organization page) are excluded from the console check.
- Playwright journeys as a repo test suite (NEXT).
- End-to-end against deployed functions: NOT RUN — OD-2 is resolved; needs owner authorization, synthetic
  accounts and the two-condition guard (`docs/architecture/ENVIRONMENTS.md` §3).
