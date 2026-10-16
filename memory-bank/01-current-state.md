# 01 · Current state

**As of 2026-10-15, branch `fix/remediation-2026-10-15` at `a7fd5a7` + uncommitted work.**
Re-verify with the commands at the bottom before relying on any line; update the date/SHA when it changes.

## Git

| Ref                               | SHA       | Meaning                                                                                                                     |
| --------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` (GitHub)            | `4f98e67` | What Vercel Production builds (main-only, OD-9)                                                                             |
| `main` (local)                    | `a7fd5a7` | 2 commits ahead of `origin/main`, **not pushed** (`72fbb64`, `a7fd5a7` = phase 1 passport/qualifications)                   |
| `fix/remediation-2026-10-15`      | `a7fd5a7` | Current branch; carries phase 1.5 (i18n), phase 0.8 (V1.3 audit), the remediation and the memory bank — **all uncommitted** |
| `refs/baseline/remediation-start` | `bf3feb1` | Stash-style snapshot of tracked changes before the remediation (untracked files not included)                               |
| other branches                    | —         | `chore/tmp-material`, `feat/foundation-v0`, `feat/crewflex-parity-migration` (historical; not merged, not active)           |

Diff vs `origin/main` (files): **145 added** (25 committed + 120 untracked) · **101 modified** · 0 deleted —
before the memory-bank work. Full breakdown: `docs/audit/CREWFLEX_DIFF_CURRENT.md`.

## Production (`sbjkzrkmcekokkqiuvvh` + https://crew-flex.vercel.app)

| Item                | State                                                                                                                      | Evidence                                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations          | `20261009120000`, `20261009120100` only                                                                                    | CLI `migration list`, 2026-10-10 (`DEPLOYMENT_PLAN.md` §9.1). Not re-checkable on 2026-10-15: the CLI account now gets **403** on the management API |
| Edge Functions      | `health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`, `professional-availability` (deployed 2026-10-09) | Unauthenticated probes 2026-10-15: health 200; 401/405 on the others                                                                                 |
| Not deployed        | `professional-profile`, `professional-qualifications`, `user-preferences`, `qualification-reviews`                         | Probes 2026-10-15: **404**                                                                                                                           |
| App                 | Vercel serves `origin/main`; `/app/**` → 307 to `/login`                                                                   | Probe 2026-10-15                                                                                                                                     |
| Authenticated flows | **Never verified in production** (remote E2E package §9.2 not executed)                                                    | `DEPLOYMENT_PLAN.md` §8 step 6, §9.2                                                                                                                 |
| Data                | 1 real user, no organizations (2026-10-10)                                                                                 | `DEPLOYMENT_PLAN.md` §9.1                                                                                                                            |

Nothing in this file may be marked `VERIFIED_PRODUCTION` beyond the probes above.

## Local (Docker, ports 563xx — `docs/qa/LOCAL_ENVIRONMENT.md`)

- All 10 migrations applied incrementally (`20261009120000` … `20261015130400`), seed loaded,
  `app_private.feature_flags('qualification_review')` row inserted **locally only**.
- Functions served with `supabase functions serve` (start on demand; stopped after each campaign).
- DB returned to the seed (4 requirements) after each campaign via `scripts/local/cleanup-test-rows.sh`.

## What works where (summary — matrix: `docs/audit/CREWFLEX_COMPLETENESS_AUDIT.md`)

| Capability                                                                                     | Status                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Auth (sign up/in/out), protected `/app/**`                                                     | VERIFIED_LOCAL; production probes only                                   |
| Requirements create/list/detail, capacity, explained matching                                  | VERIFIED_LOCAL; functions deployed but no authenticated production check |
| Availability windows (CRUD)                                                                    | VERIFIED_LOCAL; function deployed, no authenticated production check     |
| Passport edit (atomic), qualification declare/edit/withdraw                                    | VERIFIED_LOCAL; **not deployed**                                         |
| ES/EN UI + persisted language                                                                  | VERIFIED_LOCAL; **not deployed**                                         |
| E-3 / I-1 / I-3 / eligible-first pool                                                          | VERIFIED_LOCAL (PGlite + Docker + E2E + races); **not applied remotely** |
| Platform-admin qualification review                                                            | VERIFIED_LOCAL; NEEDS_DECISION (OD-3) for production                     |
| Documents, Candidate Pack, applications, assignments, recruiter, tools, logbook, notifications | PLANNED / OUT_OF_SCOPE                                                   |

## Gates — last run 2026-10-15 on the tree above

| Gate                                             | Result                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `pnpm check`                                     | PASS — Vitest 225 passed / 19 skipped (env-gated E2E; incl. 9 memory-bank checks), Deno 48  |
| `pnpm build`                                     | PASS                                                                                        |
| `git diff --check`                               | PASS                                                                                        |
| Local E2E `tests/e2e` (Docker + functions serve) | PASS 25/25                                                                                  |
| `scripts/local/db-race-check.sh`                 | PASS 4/4                                                                                    |
| Browser smoke `scripts/local/ui-smoke.mjs`       | Last PASS 78/78 on 2026-10-15 (remediation run); not re-run for the memory bank (docs only) |
| Remote E2E                                       | NOT RUN (needs explicit authorization)                                                      |

## Blockers

1. **Deploy authorization** (owner): migrations `20261011120000`→`20261015130300` + redeploy of changed
   functions + first deploy of `professional-profile`, `professional-qualifications`, `user-preferences`.
2. **OD-3 / D-01 / R-D1**: who verifies qualifications in production. Without it no new professional can
   satisfy a hard requirement → external matching is empty for real users.
3. CLI management-API access returns 403 for the current account (functions list): remote state can only
   be probed, not listed.

## Re-verify

```bash
git status --short | wc -l; git rev-parse --short HEAD origin/main; git rev-list --left-right --count origin/main...HEAD
U=https://sbjkzrkmcekokkqiuvvh.supabase.co/functions/v1; for f in health user-preferences professional-profile; do curl -s -o /dev/null -w "$f %{http_code}\n" $U/$f; done
docker ps --format '{{.Names}}' | grep crew-flex
```
