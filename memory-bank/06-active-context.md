# 06 · Active context

_Last updated 2026-10-26 17:30 CET (F2 closed locally; F3 starting). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-26: F3 «paridad funcional completa» — P02…P14 of the v1.8 parity loop, LOCAL only (commits and local
migrations authorised; no push, PR, deploy, remote write, production credential). Canonical metric = the 1 587-row
inventory imported in F3.0 as the 18-v18-inventory directory next to the matrix (`recount.py`, parity = (= + ≈) /
(= + ≈ + ≠ + −), decision-held rows stay in the denominator); per-package acceptance in `17-parity-matrix-v18.md`.
Packages run one at a time (the local stack is shared), each in its own worktree and branch, then an independent review
and the integrator's gate (`tmp/f2/gate.sh`, git-ignored) before a fast-forward here. SCOPE-2 + DEFAULTS stand; sensitive
open decisions stay NEEDS_DECISION; every subagent: Fable, xhigh.
F2 (done 2026-10-26): F2.1 v2-16 merge `e87ef87`; F2.2 P01 merge `4d78d6d` + recruiter revoke confirmation `ef0cedc` +
CSP hash `855f724`; F2.3 P01 matrix `71edd7b` (28 VERIFIED_LOCAL · 5 IMPLEMENTED_UNVERIFIED · 1 NEEDS_DECISION).
Correction: the smokes of F1b, of the first F2.1 gate and of the first P01 gates ran against a stale `next start` of the
F1a worktree (port 3002 held; `lsof` does not see it in this WSL). Re-run on each state's own build (server cwd + BUILD_ID
checked): F2.1 278/278, final `855f724` 278/278. F1b changed no frontend. The runner now refuses a foreign server.
After ANY local reset: flags via STDIN to `db-owner-sql.sh`, restart `functions serve` (wait for the NEW edge_runtime
container); copy the git-ignored env files (`.env.local`, `.env.e2e` and the functions’ `.env`) into a worktree.

## State

| Item         | State                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; X-01 live; Next 16.4.0 + zod 4.6.5 with 3 published advisories     |
| Local `main` | = `origin/main` `51c835a`                                                                                                     |
| Branch       | `feat/v18-html-parity` = this commit on `71edd7b`: 59 migrations (39 not applied remotely), 23 functions; deployed nowhere    |
| Hotfix       | `hotfix/x01-deps` = `352182c` (X-01 + Next 16.4.3 + zod 4.6.7 on `51c835a`, verified), waits for the owner (step H1)          |
| Parity       | baseline 2026-10-22: 699 / 1 246 = 56,1 % (161 decision/SCOPE-held); not recounted until the F3 packages re-verify their rows |

## Risks

1. Production: X-01 P1 live; sign-up enumeration live (fixed locally `4ff9852`); GHSA-2464-fhr4-w9xw (critical),
   GHSA-p3m5-59mp-jv5r (high), GHSA-mrhx-c7xc-m3w5 (high) until `352182c` (frontend) and the functions deploy (zod) ship.
2. Production Auth: `site_url` localhost + empty allow-list → confirmation AND recovery links point to localhost;
   minimum password 6; leaked-password check off; built-in SMTP — `ROLLOUT_PLAN_V18_LOOP.md` §0b (not executed).
3. The CSP is report-only; before enforcing, browsers without `style-src-attr` fall back to `style-src` (React's hidden
   SVG segment would show briefly).
4. OD-3 off in production; OD-8 open; T-111, T-128, T-86, pack-copy retention, free-text `description`/`arrival`,
   directory T9/T44/T-150 and `parked/directory-employer-block` need the owner.
5. The machine is shared with other projects (load up to 35): a 15–20 s timeout in E2E/smoke can be load; re-run once on
   a clean reset before calling it a regression.

## Blocked on the owner

§0 H1 push of `352182c`; §0b Auth PATCH; §0c Crew_Flex-only read token then revoke the current one; custom SMTP; every
other push/deploy; STG option (F5); D-07 P3 + scanner; OD-3; Q6 vs SCOPE-2; `14-decision-pack.md` §2; the T-xx sign-offs.

## Next step (one)

F3.0: import the inventory (18-v18-inventory), re-verify P01's rows (TEC-01, SHOT-01), then P02 passport (TEC-02,
TEC-03, TEC-08, SHOT-03) with the common brief. Never push or deploy.
