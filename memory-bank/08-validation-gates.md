# 08 · Validation gates

Canonical: `docs/qa/QUALITY_GATES.md` (suites, inventory), `docs/qa/LOCAL_ENVIRONMENT.md` (local
stack), `docs/architecture/ENVIRONMENTS.md` (production, remote E2E guard).

## Environments

| Environment        | What it is                                                                        | Writes allowed                                                                                  |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| PGlite (Vitest)    | Postgres 17 WASM + Supabase stub + real migrations + seed                         | Always (in-memory)                                                                              |
| Local Docker stack | `supabase start` via `scripts/local/sb-local.sh`, ports 563xx, synthetic seed     | Yes — disposable; clean with `scripts/local/cleanup-test-rows.sh`                               |
| Production         | Vercel `crew-flex.vercel.app` + Supabase `sbjkzrkmcekokkqiuvvh` (the only remote) | **Only with explicit owner authorization per action**; remote E2E needs the two-condition guard |

There is no staging (OD-9).

## Gates

| Gate                        | Command                                                                                      | When                               |
| --------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------- |
| Pre-commit                  | Husky: lint-staged, typecheck, `vitest run`                                                  | every commit                       |
| Full                        | `pnpm check` (lint, typecheck, Vitest incl. PGlite RLS + docs, format, deno lint/check/test) | every change                       |
| Build                       | `pnpm build`                                                                                 | before declaring a phase done      |
| Whitespace                  | `git diff --check`                                                                           | same                               |
| Local E2E                   | functions served + `node --env-file=.env.e2e node_modules/vitest/vitest.mjs run tests/e2e`   | any EF/DB/flow change              |
| Concurrency (real Postgres) | `bash scripts/local/db-race-check.sh`                                                        | DB invariants, idempotency, review |
| Browser smoke               | `next build && next start -p 3002`, then `node scripts/local/ui-smoke.mjs`                   | UI/i18n/responsive changes         |
| Remote E2E                  | `pnpm e2e:production` (`.env.e2e.production`) with guard env                                 | **only when authorized**           |

## PASS / FAIL / SKIPPED / BLOCKED

- **PASS**: the command ran in this session against the stated target and succeeded. Quote the count.
- **FAIL**: it ran and failed. Report the output. Never delete or `.skip` a failing test.
- **SKIPPED**: the suite exists but did not execute (e.g. `pnpm check` without `.env.e2e` skips 19 E2E).
  A green `pnpm check` is **not** an E2E PASS.
- **BLOCKED**: could not run (environment, permission, decision). Say why and what unblocks it.
- **NOT RUN**: deliberately not executed (e.g. remote E2E without authorization).

## Stop a deployment when

- Any gate above is not PASS on the exact commit to be pushed.
- The migration list to apply is not the full ordered set the code needs (functions calling RPCs that
  the remote schema lacks — see `CREWFLEX_REMEDIATION_2026_10_15.md` §6 and `01-current-state.md`).
- Pre-flight queries in that report §6 have not been run (e.g. legacy requirements without hard quals).
- `app_private` would be exposed (check the remote API "exposed schemas" setting).
- A migration rewrites existing rows (re-open OD-9 first).
- No rollback is written for each step.

## Proving an operation did not touch production

1. Target check before running: `grep -E "^(NEXT_PUBLIC_SUPABASE_URL|E2E_SUPABASE_URL)=" .env.local .env.e2e`
   must show `127.0.0.1:56321`; `grep -c supabase.co` must be 0. Never print whole env files.
2. DB commands only through `scripts/local/sb-local.sh` (refuses `--linked`, `--project-ref`, remote `--db-url`;
   `tests/security/local-guard.test.ts`).
3. Remote E2E guard: `E2E_AUTHORIZED_PROJECT_REF` == URL ref == linked ref **and** a per-run
   `E2E_WRITE_CONFIRM=WRITE:<ref>:<date>` (`tests/e2e/guard.ts`, `e2e-production-guard.test.ts`).
4. Browser smoke fails on any request to a non-localhost host.
5. Production read-only probes (`curl` on function URLs without a token) are allowed and are not writes.
6. `docs/audit/DEPLOYMENT_PLAN.md` §8–§9 is the log of every remote mutation; no entry ⇒ no mutation.
