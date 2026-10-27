# 06 · Active context

_Last updated 2026-10-27 11:30 CET (F3: P02–P07 integrated locally; P08 in progress). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-26: F3 «paridad funcional completa» — P02…P14 of the v1.8 parity loop, LOCAL only (commits and local
migrations authorised; no push, PR, deploy, remote write, production credential). Canonical metric = the 1 587-row
inventory imported in F3.0 as the 18-v18-inventory directory next to the matrix (`recount.py`, parity = (= + ≈) /
(= + ≈ + ≠ + −), decision-held rows stay in the denominator); per-package acceptance in `17-parity-matrix-v18.md`.
Packages run one at a time (the local stack is shared), each in its own worktree and branch, then an independent review
and the integrator's gate (`tmp/f2/gate.sh`, git-ignored) before a fast-forward here. SCOPE-2 + DEFAULTS stand; sensitive
open decisions stay NEEDS_DECISION; every subagent: Fable, medium (owner 2026-10-27).
Owner 2026-10-27: continue F3 autonomously P05→P14 (local only; F4/F5 not authorised); gates do NOT reset the DB —
`tmp/f2/gate.sh` runs `sb-local.sh migration up` (`RESET=1` forces a reset).
F2 done (P01 matrix `71edd7b`). F3 so far: F3.0 inventory `a073683`; P02 passport (gate `3220560`, review fix `b13e6a6`);
P03 calendar (merge `9ee9d8e`, gate `5ffe68e`); P04 opportunities fast-forwarded at `eb21de2` — review: no blockers,
fixed «{n} días» (one `requirementDays` in `src/domain`); then `f3/p03-fixes` merged (PKG P03 restores delta's locale
in `finally`); partial coverage is labelled «D-06 Q6 ↔ SCOPE-2» everywhere (was «D-08 · Q6»; Q6 belongs to D-06);
full gate on `e8b5843` green but smoke 322/323 (a test bug in `PKG P04 10`, fixed `bb37569`), then smoke 323/323.
P05 applications (2026-10-27): WIP of the cut session reused; `64c9199` feat (T-165 «{n} jornadas», empty `?status=`),
`2109926` smoke `PKG P05` 0…13, `e23c650` docs (matrix §P05: 22 VERIFIED_LOCAL · 4 OUT · 3 NEEDS_DECISION P05-19 OD-5/T-52,
P05-20 D-07 P3 + D-10, P05-28 D-06 Q6 ↔ SCOPE-2; P01-26 verified); gate green (check 1170/195, E2E 48/48, race 19/19,
smoke 344/344; earlier runs: 2 real fixes, 3 load flakes); review no blockers, docs fix `e649831`, fast-forwarded.
P06 wallet (2026-10-27): re-verification only (no app code/migration; gaps closed by wallet-extras T-100…T-103, N-13,
T-163); `PKG P06` 17 steps; matrix §P06 17 VERIFIED_LOCAL · 3 NEEDS_DECISION (D-10/OD-3, D-07 P3 + D-10) · 1 BLOCKED
(D-10 deploy) · 1 OUT; gate (no reset) check 1170/195, E2E 48/48, race 19/19, smoke 361/361; review no blockers,
merge `3cfcda9`, wording fix `48ed1ee`.
P07 logbook (2026-10-27): re-verification only (ported 22/10, M14/N-12); citations fixed to BR-17 / T-19…T-22; `PKG P07`
16 steps; matrix §P07 15 VERIFIED_LOCAL · 1 OUT · 1 BLOCKED (M-3 deploy); gate first run green (smoke 377/377);
review no blockers, merge `c2f8d6a`, review fixes `79e149d`.
Docker Desktop can drop mid-session: a gate with `RESET_EXIT=2` / `HEALTH=000` means no socket — restart it, re-run.
After ANY local reset: flags via STDIN to `db-owner-sql.sh`, restart `functions serve` (wait for the NEW edge_runtime
container); copy the git-ignored env files (`.env.local`, `.env.e2e` and the functions’ `.env`) into a worktree.

## State

| Item         | State                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; X-01 live; Next 16.4.0 + zod 4.6.5 with 3 published advisories    |
| Local `main` | = `origin/main` `51c835a`                                                                                                    |
| Branch       | `feat/v18-html-parity` = this commit on `79e149d`: 59 migrations (39 not applied remotely), 23 functions; deployed nowhere   |
| Hotfix       | `hotfix/x01-deps` = `352182c` (X-01 + Next 16.4.3 + zod 4.6.7 on `51c835a`, verified), waits for the owner (step H1)         |
| Parity       | inventory `recount.py` after P07: 796 / 1 246 = 63,9 % (156 decision-held, 135 ✗, 206 Next-only); 2026-10-22 baseline 56,1 % |

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

P08 Tools (TOOL-01…09, SHOT-04) in worktree `f3-p08`, branch `f3/p08-tools` from `b66151d` (integrate by merge); then
P09…P14 one at a time (package map in `18-v18-inventory/README.md`). Never push or deploy.
