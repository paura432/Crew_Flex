# 06 · Active context

_Last updated 2026-10-27 11:30 CET (F3: P02–P11 integrated locally; P12 in progress). Keep under ~60 lines; replace, don't append history._

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
P08 tools (2026-10-27): re-verification only (ported by `558654f`/`88d9a6d`/`44045db` after the 22/10 snapshot); T-166
records those defaults; `PKG P08` 12 steps; 16 ✗ (v1.8 bugs «fix on port») → ≠/≈ — DENOMINATOR 1 246 → 1 262, reviewed
row by row (≠ only lowers the ratio); matrix §P08 19 VERIFIED_LOCAL · 1 IMPLEMENTED_UNVERIFIED · 1 PARTIAL (editorial)
· 1 NEEDS_DECISION (fuel D-11) · 2 BLOCKED (NEW-01/AB-37 offline; deploy) · 1 OUT; smoke 389/389 first run; merge
`d4eed6a`, review fixes `a7ed382`.
P09 org dashboard (2026-10-27): only gap = v1.8 «Resumen» hero (`OrganizationHero.tsx`, T-167); `PKG P09` 11 steps;
smoke 400/400 first run; review no blockers; merge `2d1ea51`, fixes `8920b9d` (mark from 981 px as v1.8; ORG-07 #3 ops
e-mail is demo-only ✗, not D-07 → denominator 1 261); matrix §P09 NEEDS_DECISION P09-13 (OD-5/T-52), BLOCKED P09-17
(OD-4/D-09 invitations), P09-20 (deploy).
P10 needs/matching (2026-10-27): NEW LOCAL migration `20261027100000` (builder RPC overloads write the six v1.8 profile
rules; INVOKER create → BEFORE INSERT trigger via tx-local setting; DEFINER edit + audit), «Perfil técnico» form, T-168,
`coverageDays` (≠ `requirementDays` on purpose, BR-23); smoke 409/409; security + parity reviews no blockers; merge
`d045565`, fixes `e399356` (one T-83 predicate in src/domain, T-85 residual documented, anon/platform-admin/INSERT
negatives); check 0 (1184/196) + build 0 after the fix. Held: D-06 Q6 ↔ SCOPE-2, T-33 (OD-7) rate filter; open for the
matching owner: v1.8 requires the type rating on a DECLARED aircraft (`business.js:142`), ours checks them apart.
P11 recruiter (2026-10-27): NEW LOCAL migration `20261027200000` (`app_private.requirement_cards` appends the
represented client's NAME, as recorded, T-169; never the contact); pack copy names the recipient on both sides, «Red
recruiter» eyebrow; smoke 420/420; security + code reviews no blockers; merge `b9f7d48`, fixes `938d56e` (cleanup of
`Cliente P11`/`P11 recruiter` rows, restore captured org type, doc refs); check 0 (1185/197) + build 0 on the merge.
Held: export «Preparar presentación para cliente» (D-07 P3 + D-10).
Docker Desktop can drop mid-session: a gate with `RESET_EXIT=2` / `HEALTH=000` means no socket — restart it, re-run.
After ANY local reset: flags via STDIN to `db-owner-sql.sh`, restart `functions serve` (wait for the NEW edge_runtime
container); copy the git-ignored env files (`.env.local`, `.env.e2e` and the functions’ `.env`) into a worktree.

## State

| Item         | State                                                                                                                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; X-01 live; Next 16.4.0 + zod 4.6.5 with 3 published advisories    |
| Local `main` | = `origin/main` `51c835a`                                                                                                    |
| Branch       | `feat/v18-html-parity` = this commit on `938d56e`: 61 migrations (41 not applied remotely), 23 functions; deployed nowhere   |
| Hotfix       | `hotfix/x01-deps` = `352182c` (X-01 + Next 16.4.3 + zod 4.6.7 on `51c835a`, verified), waits for the owner (step H1)         |
| Parity       | inventory `recount.py` after P11: 943 / 1 262 = 74,7 % (155 decision-held, 119 ✗, 206 Next-only); 2026-10-22 baseline 56,1 % |

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

P12 Admin (ADM-01…03) in worktree `f3-p12`, branch `f3/p12-admin` from `b9f7d48` (integrate by merge); then P13 Notices,
P14 Shell. Never push or deploy.
