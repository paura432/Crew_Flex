# 01 · Current state

**As of 2026-10-19 18:58 CEST: production serves release 1 = `origin/main` = `65df3b9`** (Vercel deployment
`7179643776`, success), on **15 migrations** and **8 Edge Functions** (matching-evaluate, capacity-evaluate,
professional-availability v3 from `65df3b9`; the other five unchanged). Rolled out by the agent with owner
authorization, steps 1–5 of `docs/qa/ROLLOUT_PLAN_2026-10-19.md` (safe order). **Authenticated E2E: NOT RUN.**
Re-verify with the commands at the bottom before relying on any line; update the date/SHA when it changes.

## Git

| Ref                               | SHA                | Meaning                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` (GitHub)            | `65df3b9`          | Release 1, pushed 2026-10-19 18:56 CEST as `git push origin 65df3b9:main` (fast-forward from `ddf5c4b`, 9 commits, as paura432). What Vercel Production builds (main-only, OD-9)                                                                                                              |
| `main` (local)                    | ahead of `65df3b9` | Local only, **not pushed** (2026-10-20; count with `git rev-list --count origin/main..HEAD`): wallet (release 2, not approved), D-06/D-07/D-12 designs, rollout docs, V1.8 batches 1–7 + second audit. Never `git push origin main` without owner approval — it would publish the wallet code |
| `fix/remediation-2026-10-15`      | `f158308`          | Fully merged into `main`; can be deleted when the owner wants                                                                                                                                                                                                                                 |
| `refs/baseline/remediation-start` | `bf3feb1`          | Stash-style snapshot of tracked changes before the remediation (untracked files not included)                                                                                                                                                                                                 |
| other branches                    | —                  | `chore/tmp-material`, `feat/foundation-v0`, `feat/crewflex-parity-migration` (historical; not merged, not active)                                                                                                                                                                             |

## Production (`sbjkzrkmcekokkqiuvvh` + https://crew-flex.vercel.app) — the single environment (demo, OD-9)

| Item                    | State                                                                                                                                                                                                                                     | Evidence (2026-10-16)                                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations              | **15 applied**: the 10 of 2026-10-16 + `20261019120000`, `130000`, `140000` (step 2) + `20261019150000`, `150100` (step 4), 2026-10-19. Wallet `1602xx` **not** applied                                                                   | `migration list --linked` 15/15; read-only checks: enum `{available,unavailable,aog_only}`, pool filter = local (md5), RLS on in every public table, `availability_rotations` 4 `*_own` policies, RPC anon false / authenticated true, 0 buckets, no flags |
| OD-3 database gate      | `app_private.feature_flags` exists with **0 rows** → `review_qualification()` refuses (`0A000`). `reviewed_by`/`review_note` not selectable by `authenticated`                                                                            | Same query                                                                                                                                                                                                                                                 |
| Edge Functions          | **8 deployed**: `matching-evaluate`, `capacity-evaluate`, `professional-availability` **v3** (`65df3b9`, 2026-10-19); `health`, `work-requirements` v2; `professional-profile`, `professional-qualifications`, `user-preferences` v1      | 2026-10-19: downloaded sources = `65df3b9`; probes without/invalid token 401 (405 on other methods), health 200; CORS 204 only for `https://crew-flex.vercel.app`, availability allows `PUT`                                                               |
| `qualification-reviews` | **Not deployed.** It went out by mistake in a bare `functions deploy` on 2026-10-16 (failing closed: 404 without the secret) and was deleted the same day on owner authorization                                                          | `functions delete` → "Deleted Edge Function"; GET/POST/OPTIONS → platform 404 "Requested function was not found"                                                                                                                                           |
| Secrets                 | `ALLOWED_ORIGINS` + platform-provided ones. `QUALIFICATION_REVIEW_ENABLED` **not set**                                                                                                                                                    | `secrets list` (names only)                                                                                                                                                                                                                                |
| App (frontend)          | **Published**: Vercel Production deployment `7179643776` = `65df3b9` (success 2026-10-19 16:57 UTC). Rollback target `7126745962` = `ddf5c4b` (tested compatible with the new backend)                                                    | GitHub status `Vercel=success`; served CSS contains the release `--color-tool-*` tokens; `/`, `/login`, `/register` 200; every `/app/**` incl. tools and availability → 307 `/login?next=…`; 0 failing static assets                                       |
| Authenticated flows     | **Never verified in production.** Prepared, not executed: `.env.e2e.production` + `pnpm e2e:production` (`docs/qa/PRODUCTION_E2E_RUNBOOK.md`); seed, run and cleanup each need owner approval. No synthetic users exist in production yet | —                                                                                                                                                                                                                                                          |
| Data                    | 2026-10-19: 3 users, 3 technician profiles, 0 organizations, 0 requirements, 0 availability windows, 0 `aog_only` rows — unchanged by the rollout                                                                                         | read-only counts before/after each step                                                                                                                                                                                                                    |
| Staging                 | None. The stray `Crew_Flex_staging` project was deleted by the owner on 2026-10-16                                                                                                                                                        | Owner statement                                                                                                                                                                                                                                            |

Nothing in this file may be marked `VERIFIED_PRODUCTION` beyond the probes and read-only queries above.

## OD-3 (qualification review) — still OPEN, closed at every layer

1. Next.js server flag `QUALIFICATION_REVIEW_ENABLED` (off unless exactly `true`): no nav entry,
   `/app/admin/verifications` renders Not found (HTTP 200 because the layout streams first; verified 2026-10-19), review action refused (`src/server/feature-flags.ts`). Absent in Vercel (all environments) — confirmed by the owner in the dashboard on 2026-10-16.
2. Edge Function `qualification-reviews` not deployed; its secret is not set.
3. Database row `app_private.feature_flags('qualification_review')` absent.

## Local (Docker, ports 563xx — `docs/qa/LOCAL_ENVIRONMENT.md`)

- Local DB has every migration up to `20261020120100` (2026-10-20). Of these, production has the 15 up to `20261019150100`; **local only**: wallet `20261019160000`–`160200`, requirement close `20261020120000`, closed-frozen `20261020120100`. Seed loaded, `qualification_review` flag row **local only**.
- The browser smoke now also needs `QUALIFICATION_REVIEW_ENABLED=true` in `.env.local` (it refuses otherwise).
- 2026-10-16 ~20:52: the owner's `pnpm e2e:remote` failed 24/25 with **503** — a LOCAL problem: `.env.e2e`
  targets `127.0.0.1:56321` and `supabase functions serve` was not running (Kong answers 503 for every
  function). Production was not touched (prod `health` 200 at the same time). After starting the functions
  (`bash scripts/local/sb-local.sh functions serve --env-file supabase/functions/.env`): local E2E **25/25
  passed, 0 skipped** (19 `remote-smoke` + 6 `local-remediation`); DB returned to the seed (4 requirements).

## What works where (summary — matrix: `docs/audit/CREWFLEX_COMPLETENESS_AUDIT.md`)

| Capability                                                                                                                                                                                                                | Status                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Auth (sign up/in/out), protected `/app/**`                                                                                                                                                                                | VERIFIED_LOCAL; production probes only                                                                   |
| Requirements, capacity, explained matching, availability                                                                                                                                                                  | VERIFIED_LOCAL; in production since release 1 (`65df3b9`); authenticated E2E in production not run       |
| Passport edit (atomic), qualification declare/edit/withdraw                                                                                                                                                               | VERIFIED_LOCAL; in production since release 1 (`65df3b9`); authenticated E2E in production not run       |
| ES/EN UI + persisted language                                                                                                                                                                                             | VERIFIED_LOCAL; in production since release 1 (`65df3b9`); authenticated E2E in production not run       |
| E-3 / I-1 / I-3 / eligible-first pool                                                                                                                                                                                     | VERIFIED_LOCAL; applied remotely 2026-10-16                                                              |
| Availability cycle generator, «AOG only», tools (release 1)                                                                                                                                                               | VERIFIED_LOCAL; deployed to production 2026-10-19; authenticated flows not verified in production        |
| Password recovery (forgot → e-mail → `/auth/confirm` → reset)                                                                                                                                                             | VERIFIED_LOCAL 2026-10-19; not deployed (needs prod Auth redirect URL)                                   |
| Matches list: search, eligible-only, sort by experience, 20/page, compare ≤3 (V1.8 directory)                                                                                                                             | VERIFIED_LOCAL 2026-10-19; not deployed                                                                  |
| Technician overview: 7-item profile-status checklist with links + read-only month calendar                                                                                                                                | VERIFIED_LOCAL 2026-10-19; not deployed                                                                  |
| Wallet expiry chips (valid / expires soon ≤45 d / expired); custom cycle «use 7–3/7–4 as base»                                                                                                                            | VERIFIED_LOCAL 2026-10-19; not deployed (wallet = release 2)                                             |
| Platform-admin qualification review                                                                                                                                                                                       | VERIFIED_LOCAL; NEEDS_DECISION (OD-3); off in production at all 3 layers                                 |
| Requirement close (V1.8 `job.status`: terminal, frozen, audited; capacity/matching 409 when closed); AOG orange + hatched partial day; reset only from a recovery session; compare kept across pages                      | VERIFIED_LOCAL 2026-10-20 (second audit batches 5–7); not deployed                                       |
| Second pass 2026-10-20 (batches 8–12): reset ends every session + recovery-only confirm; «Expired» need (derived); 44 px touch targets; «Menu» drawer < lg; folded checklist; application transition table (pure, unused) | VERIFIED_LOCAL 2026-10-20 (`5d22175`…`b20786a`); not deployed                                            |
| Candidate Pack, applications, assignments, opportunities, recruiter, logbook, notifications (tools: units/torque/durations are in production — see above)                                                                 | NOT STARTED — blocked by D-06/D-07/D-12/scope (`docs/integration/crewflex-v13/12-completion-roadmap.md`) |

## Gates

2026-10-19 on the release checkout `65df3b9`: `pnpm check` (Vitest 290, Deno 50), `pnpm build`, `git diff --check` PASS; compat harness 111/111. Production E2E: NOT RUN.
Release-1 E2E prepared 2026-10-19 (local commits after `65df3b9`, not deployed — tests and scripts only):
local API 41/41, browser `scripts/e2e/ui-release1.mjs` 24/24; production suite refuses without the
per-run confirmation (0 requests).

## Blockers

1. Owner approvals, one each: create synthetic users → run `pnpm e2e:production` → cleanup
   (`docs/qa/PRODUCTION_E2E_RUNBOOK.md`). Until then no authenticated flow is verified in production.
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
