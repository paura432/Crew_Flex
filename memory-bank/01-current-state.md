# 01 · Current state

**As of 2026-10-16, branch `fix/remediation-2026-10-15`; database and Edge Functions rolled out to
production, frontend NOT yet published (merge + push to `main` awaiting owner approval).**
Re-verify with the commands at the bottom before relying on any line; update the date/SHA when it changes.

## Git

| Ref                               | SHA                    | Meaning                                                                                                                                                                                                                                                 |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` (GitHub)            | `4f98e67`              | What Vercel Production builds (main-only, OD-9). **Unchanged**                                                                                                                                                                                          |
| `main` (local)                    | `a7fd5a7`              | 2 commits ahead of `origin/main`, not pushed: `72fbb64` (local tooling), `a7fd5a7` (phase 1 passport/qualifications)                                                                                                                                    |
| `fix/remediation-2026-10-15`      | branch tip (this file) | `main` + `2f68190` feat(db) · `076ef15` feat(app) · `738aac6` chore(scripts) · `92c6fde` docs · the OD-3 server flag fix · this memory-bank update. Fast-forwardable onto `main`; everything built from it except the frontend is already in production |
| `refs/baseline/remediation-start` | `bf3feb1`              | Stash-style snapshot of tracked changes before the remediation (untracked files not included)                                                                                                                                                           |
| other branches                    | —                      | `chore/tmp-material`, `feat/foundation-v0`, `feat/crewflex-parity-migration` (historical; not merged, not active)                                                                                                                                       |

## Production (`sbjkzrkmcekokkqiuvvh` + https://crew-flex.vercel.app) — the single environment (demo, OD-9)

| Item                    | State                                                                                                                                                                                                                          | Evidence (2026-10-16)                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations              | **All 10** applied: `20261009120000`, `20261009120100` + `20261011120000` … `20261015130400` (owner ran `db push`)                                                                                                             | `migration list --linked`: 10/10 remote. Pre-flight data checks 0 rows. Read-only privilege query: `anon` has no EXECUTE on the 14 new/replaced functions, RLS on in every table, 4 new triggers present |
| OD-3 database gate      | `app_private.feature_flags` exists with **0 rows** → `review_qualification()` refuses (`0A000`). `reviewed_by`/`review_note` not selectable by `authenticated`                                                                 | Same query                                                                                                                                                                                               |
| Edge Functions          | **8 deployed**: `health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`, `professional-availability` (redeployed) and `professional-profile`, `professional-qualifications`, `user-preferences` (first deploy) | Probes without token: health GET 200; the other 7 → 401 (405 on methods they do not have). CORS preflight allows `idempotency-key` for `https://crew-flex.vercel.app`                                    |
| `qualification-reviews` | **Not deployed.** It went out by mistake in a bare `functions deploy` on 2026-10-16 (failing closed: 404 without the secret) and was deleted the same day on owner authorization                                               | `functions delete` → "Deleted Edge Function"; GET/POST/OPTIONS → platform 404 "Requested function was not found"                                                                                         |
| Secrets                 | `ALLOWED_ORIGINS` + platform-provided ones. `QUALIFICATION_REVIEW_ENABLED` **not set**                                                                                                                                         | `secrets list` (names only)                                                                                                                                                                              |
| App (frontend)          | Vercel still serves `origin/main` `4f98e67` (old UI on the new DB/functions; compatible: column-limited reads, unchanged RPC signatures, additive responses)                                                                   | `/login` 200 after each stage. **Not published** until Vercel confirms the deploy of the new `main`                                                                                                      |
| Authenticated flows     | **Never verified in production** (guarded remote E2E not run)                                                                                                                                                                  | —                                                                                                                                                                                                        |
| Data                    | 1 real user, no organizations (2026-10-10); pre-flight counts 0 on 2026-10-16                                                                                                                                                  | —                                                                                                                                                                                                        |
| Staging                 | None. The stray `Crew_Flex_staging` project was deleted by the owner on 2026-10-16                                                                                                                                             | Owner statement                                                                                                                                                                                          |

Nothing in this file may be marked `VERIFIED_PRODUCTION` beyond the probes and read-only queries above.

## OD-3 (qualification review) — still OPEN, closed at every layer

1. Next.js server flag `QUALIFICATION_REVIEW_ENABLED` (off unless exactly `true`; not set in Vercel): no nav
   entry, `/app/admin/verifications` → 404, review action refused (`src/server/feature-flags.ts`).
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

1. **Owner approval** for the fast-forward of `main` + `git push origin main` (= Vercel deploy).
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
