# 06 · Active context

_Last updated 2026-10-28 CET (F3 P02–P14 + P15 a11y/i18n + local P14b-S1 fix integrated; next step waits for the owner). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-26/27: F3 «paridad funcional completa» — P02…P14 of the v1.8 parity loop, LOCAL only (commits and local
migrations authorised; no push, PR, deploy, remote write, production credential; F4/F5 not authorised). **Done
2026-10-28**: every package in its own worktree/branch with a `PKG Pxx` smoke block, independent review(s) and
`tmp/f2/gate.sh` (git-ignored; no reset by default, `RESET=1` forces one), merged here; final merge `4e37b88`, check 0
(1187/197) + build 0. Summary, per-file parity and the owner list: `17-parity-matrix-v18.md` «Cierre F3» (matrix 396 rows with P15:
310 VERIFIED_LOCAL · 5 IMPLEMENTED_UNVERIFIED · 4 PARTIAL · 22 NEEDS_DECISION · 22 BLOCKED · 33 OUT). Metric = the 1 587-row
inventory (`18-v18-inventory/recount.py`, (= + ≈) / (= + ≈ + ≠ + −), decision-held rows stay in the denominator).
New local migrations in F3: `20261027100000` (P10 builder profile rules, T-168), `20261027200000` (P11 client name on
cards, T-169), `20261027300000` (P12 qualification review evidence, T-170). P05–P09, P13, P14a–c were re-verification
(P05 T-165, P09 hero T-167, P14c «CrewFlex» in three catalog strings). Per-package detail: the matrix sections and git log.
Findings for the owner: **P14b-S1** (security review confirmed, Medium) — after a password reset refresh tokens die but an
issued ES256 access token keeps page/RLS/function access ≤ `jwt_expiry`; owner «continúa» → LOCAL `jwt_expiry`
600 applied (merge `2beec2d`, gate green); production `jwt_exp` (unread) stays an owner item in §0b. P14b-S5 (low): a forged `/auth/confirm?code=`
shows «Correo confirmado» without a session. T-170: v1.8 refuses a _profile_ review with restrictions, ours only warns.
P10: v1.8 requires the type rating on a declared aircraft (`business.js:142`), ours checks them apart (matching owner).
P15 (owner «continúa», 2026-10-28) re-verified the formerly unmapped `A11Y-01…06` / `I18N-01…05`: five small a11y/i18n fixes

- `client.added`/`client.revoked` labels, `PKG P15`, review no blockers, merge `60ab042`; proposals P15-P1…P5 (P3).
  Gotchas: Docker Desktop can drop mid-session (`HEALTH=000` → restart, re-run); after ANY local reset set the flags via
  STDIN to `db-owner-sql.sh` and restart `functions serve`; copy `.env.local`, `.env.e2e` and the functions' `.env` into a
  new worktree; the smoke step-17 console 409 (and once a 404 on sign-out) is a load flake (re-run once); prettier turns `X-*` into `X-_` in prose.

## State

| Item         | State                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Production   | frontend `origin/main` `51c835a` on the release-1 backend; X-01 live; Next 16.4.0 + zod 4.6.5 with 3 published advisories      |
| Local `main` | = `origin/main` `51c835a`                                                                                                      |
| Branch       | `feat/v18-html-parity` = this commit on `2beec2d`: 62 migrations (42 not applied remotely), 23 functions; deployed nowhere     |
| Hotfix       | `hotfix/x01-deps` = `352182c` (X-01 + Next 16.4.3 + zod 4.6.7 on `51c835a`, verified), waits for the owner (step H1)           |
| Parity       | inventory `recount.py` after P15: 1 050 / 1 266 = 82,9 % (155 decision-held, 113 ✗, 209 Next-only); 2026-10-22 baseline 56,1 % |

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
other push/deploy; STG option (F5); D-07 P3 + scanner; OD-3; Q6 vs SCOPE-2; `14-decision-pack.md` §2; the T-xx sign-offs; whether declared restrictions block a qualification review (T-170); P14b-S1 production `jwt_exp` 600 s (§0b; local done).

## Next step (one)

Waits for the owner: the production items (§0, §0b incl. `jwt_exp`, deploys), the open decisions above, and F4/F5 (not
authorised). Worktrees `.claude/worktrees/f3-p12…f3-p15` and `p14b-s1` can be removed once the owner is done reviewing.
Never push or deploy without the owner.
