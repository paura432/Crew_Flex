# 01 · Current state

**As of 2026-10-16 ~20:15 CEST: `main` = `origin/main` = `f158308` is published to Vercel Production
(deployment confirmed), on top of the 10 migrations and 8 Edge Functions rolled out the same day.**
Re-verify with the commands at the bottom before relying on any line; update the date/SHA when it changes.

## Git

| Ref                               | SHA                              | Meaning                                                                                                                                                                                      |
| --------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` (GitHub)            | `f158308`                        | Pushed 2026-10-16 (fast-forward from `4f98e67`, 8 commits: `72fbb64` `a7fd5a7` `2f68190` `076ef15` `738aac6` `92c6fde` `76c004c` `f158308`). What Vercel Production builds (main-only, OD-9) |
| `main` (local)                    | `f158308` + local docs commit(s) | Post-publish memory-bank update committed locally, **not pushed** (a push = a new production deploy; needs owner approval)                                                                   |
| `fix/remediation-2026-10-15`      | `f158308`                        | Fully merged into `main`; can be deleted when the owner wants                                                                                                                                |
| `refs/baseline/remediation-start` | `bf3feb1`                        | Stash-style snapshot of tracked changes before the remediation (untracked files not included)                                                                                                |
| other branches                    | —                                | `chore/tmp-material`, `feat/foundation-v0`, `feat/crewflex-parity-migration` (historical; not merged, not active)                                                                            |

## Production (`sbjkzrkmcekokkqiuvvh` + https://crew-flex.vercel.app) — the single environment (demo, OD-9)

| Item                    | State                                                                                                                                                                                                                          | Evidence (2026-10-16)                                                                                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations              | **All 10** applied: `20261009120000`, `20261009120100` + `20261011120000` … `20261015130400` (owner ran `db push`)                                                                                                             | `migration list --linked`: 10/10 remote. Pre-flight data checks 0 rows. Read-only privilege query: `anon` has no EXECUTE on the 14 new/replaced functions, RLS on in every table, 4 new triggers present                                       |
| OD-3 database gate      | `app_private.feature_flags` exists with **0 rows** → `review_qualification()` refuses (`0A000`). `reviewed_by`/`review_note` not selectable by `authenticated`                                                                 | Same query                                                                                                                                                                                                                                     |
| Edge Functions          | **8 deployed**: `health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`, `professional-availability` (redeployed) and `professional-profile`, `professional-qualifications`, `user-preferences` (first deploy) | Probes without token: health GET 200; the other 7 → 401 (405 on methods they do not have). CORS preflight allows `idempotency-key` for `https://crew-flex.vercel.app`                                                                          |
| `qualification-reviews` | **Not deployed.** It went out by mistake in a bare `functions deploy` on 2026-10-16 (failing closed: 404 without the secret) and was deleted the same day on owner authorization                                               | `functions delete` → "Deleted Edge Function"; GET/POST/OPTIONS → platform 404 "Requested function was not found"                                                                                                                               |
| Secrets                 | `ALLOWED_ORIGINS` + platform-provided ones. `QUALIFICATION_REVIEW_ENABLED` **not set**                                                                                                                                         | `secrets list` (names only)                                                                                                                                                                                                                    |
| App (frontend)          | **Published**: Vercel Production deployment `7126243506` for `f158308` (`success`, 2026-10-16T18:13Z); previous Production deployment `6993757331` = `4f98e67` (rollback target)                                               | GitHub status `Vercel=success`; `crew-flex.vercel.app/login` serves the new i18n build (`Accept-Language: es` → `lang="es"`, "Iniciar sesión"); `/`, `/login`, `/register`, `/icon.svg` 200; `/app/**` → 307 `/login?next=…`; unknown path 404 |
| Authenticated flows     | **Never verified in production** (guarded remote E2E not run)                                                                                                                                                                  | —                                                                                                                                                                                                                                              |
| Data                    | 1 real user, no organizations (2026-10-10); pre-flight counts 0 on 2026-10-16                                                                                                                                                  | —                                                                                                                                                                                                                                              |
| Staging                 | None. The stray `Crew_Flex_staging` project was deleted by the owner on 2026-10-16                                                                                                                                             | Owner statement                                                                                                                                                                                                                                |

Nothing in this file may be marked `VERIFIED_PRODUCTION` beyond the probes and read-only queries above.

## OD-3 (qualification review) — still OPEN, closed at every layer

1. Next.js server flag `QUALIFICATION_REVIEW_ENABLED` (off unless exactly `true`): no nav entry,
   `/app/admin/verifications` → 404, review action refused (`src/server/feature-flags.ts`). Absent in Vercel (all environments) — confirmed by the owner in the dashboard on 2026-10-16.
2. Edge Function `qualification-reviews` not deployed; its secret is not set.
3. Database row `app_private.feature_flags('qualification_review')` absent.

## Local (Docker, ports 563xx — `docs/qa/LOCAL_ENVIRONMENT.md`)

- All 10 migrations applied incrementally, seed loaded, `qualification_review` flag row inserted **locally only**.
- The browser smoke now also needs `QUALIFICATION_REVIEW_ENABLED=true` in `.env.local` (it refuses otherwise).

## What works where (summary — matrix: `docs/audit/CREWFLEX_COMPLETENESS_AUDIT.md`)

| Capability                                                                                     | Status                                                                   |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Auth (sign up/in/out), protected `/app/**`                                                     | VERIFIED_LOCAL; production probes only                                   |
| Requirements, capacity, explained matching, availability                                       | VERIFIED_LOCAL; DB + functions deployed; UI not yet published            |
| Passport edit (atomic), qualification declare/edit/withdraw                                    | VERIFIED_LOCAL; DB + functions deployed; UI not yet published            |
| ES/EN UI + persisted language                                                                  | VERIFIED_LOCAL; DB + function deployed; UI not yet published             |
| E-3 / I-1 / I-3 / eligible-first pool                                                          | VERIFIED_LOCAL; applied remotely 2026-10-16                              |
| Platform-admin qualification review                                                            | VERIFIED_LOCAL; NEEDS_DECISION (OD-3); off in production at all 3 layers |
| Documents, Candidate Pack, applications, assignments, recruiter, tools, logbook, notifications | PLANNED / OUT_OF_SCOPE                                                   |

## Gates

Last run 2026-10-16 on the branch tip: see `06-active-context.md`. Remote E2E: NOT RUN.

## Blockers

1. Pending owner check: guarded authenticated E2E
   (`E2E_WRITE_CONFIRM`) — no authenticated flow has been verified in production yet.
2. **OD-3 / D-01 / R-D1**: who verifies qualifications in production. Without it no new professional can
   satisfy a hard requirement → external matching is empty for real users.
3. CLI management-API listing returned 403 on 2026-10-15; on 2026-10-16 `migration list`, `secrets list`,
   `functions deploy/delete` worked — re-check before relying on either.

## Re-verify

```bash
git status --short | wc -l; git rev-parse --short HEAD main origin/main; git rev-list --left-right --count origin/main...HEAD
npx supabase migration list --linked
U=https://sbjkzrkmcekokkqiuvvh.supabase.co/functions/v1; for f in health user-preferences professional-profile qualification-reviews; do curl -s -o /dev/null -w "$f %{http_code}\n" $U/$f; done
```
