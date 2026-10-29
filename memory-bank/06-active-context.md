# 06 · Active context

_Last updated 2026-10-29 CET (PR #1 merged by the owner → production = `574fd4f` + full backend; Auth §0b applied; ORG-04 #22 closed locally; owner admin account in progress). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-29: (1) read-only audit of the 216 pending parity rows — `docs/integration/crewflex-v13/19-pending-audit.md`
(+ `19-pending-216.csv`, `docs/integration/crewflex-v13/18-v18-inventory/pending.py`), committed `79f30ef`; (2) PR #1 (draft,
review only) — the owner merged it: `origin/main` = `574fd4f`; (3) Auth §0b applied with the owner's «sí» (HIBP refused, 402
Pro plan); (4) ORG-04 #22 (rate and base hours on the needs list row) closed LOCALLY with the full gate green (check 0 — Vitest
1196/38 —, build 0, E2E 48/48, race 0, smoke 515/515 incl. `PKG ORG-04 22`) → 1 051 / 1 266 = 83,0 %; committed on the branch,
NOT pushed (pushing to `main` = production deploy, owner's call). **In progress**: the owner's admin account
`crewflexaviation@gmail.com` — the owner signs up on production as a professional and confirms; then the approved SQL
(Management API `database/query`): `platform_role = platform_admin`, organization «CrewFlex Operaciones» with an admin
membership, one `audit_events` row; only if the account exists, is confirmed and is professional (D-13 «Ver como» needs both).

Gotchas: Docker Desktop can drop mid-session (`HEALTH=000` → restart, re-run); after ANY local reset set the flags via
STDIN to `db-owner-sql.sh` and restart `functions serve`; copy `.env.local`, `.env.e2e` and the functions' `.env` into a
new worktree; the smoke step-17 console 409 (and once a 404 on sign-out) is a load flake (re-run once); prettier turns `X-*` into `X-_` in prose.
The smoke rewrites the P13…P15 captures under `docs/audit/evidence/parity/`: restore them unless the package is yours.

## State

| Item          | State                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Production    | `574fd4f` (Vercel success 10:18 UTC) · 62 migrations · 23 functions ACTIVE · Auth §0b (2026-10-29) · 3 profiles, 0 platform admins |
| `origin/main` | `574fd4f` = merge of the branch at `79f30ef`; local `main` still `51c835a` (not fast-forwarded)                                    |
| Branch        | `feat/v18-html-parity` = ORG-04 #22 commit on `79f30ef`; `hotfix/x01-deps` obsolete (X-01, Next 16.4.3, zod 4.6.7 are in `main`)   |
| Parity        | `recount.py` 2026-10-29: 1 051 / 1 266 = 83,0 % (local); production = the branch without ORG-04 #22                                |

## Risks

1. Production Auth: `password_hibp_enabled` off (Pro plan only); `jwt_exp` 3600 (P14b-S1, owner decision); built-in SMTP
   mails only project team addresses, 2 per hour — real users get no confirmation or recovery mail (OD-8, custom SMTP).
2. Authenticated E2E in production: NOT RUN; production OD-3 activation not done (verifier list, procedure, flags).
3. The CSP is report-only; before enforcing, browsers without `style-src-attr` fall back to `style-src`.
4. Owner items from `19-pending-audit.md` §3 (D-11 reviewer, design copy, OUT/✗ metric rule, Q6, T-33, D-07 P3 + scanner…).
5. The machine is shared (load up to 35): a 15–20 s timeout in E2E/smoke can be load; re-run once before calling it a regression.

## Blocked on the owner

Pushing ORG-04 #22 to `main` (deploy); `jwt_exp` 600; custom SMTP; OD-3 in production; D-07 P3 + scanner; Q6 vs SCOPE-2;
the `19-pending-audit.md` §3 decisions; `14-decision-pack.md` §2; the T-xx sign-offs; §0c Crew_Flex-only token, then revoke
the current one.

## Next step (one)

The owner signs up `crewflexaviation@gmail.com` on https://crew-flex.vercel.app/register (professional, ≥ 12 characters) and
confirms; then run the approved admin SQL and verify «Ver como» shows Técnico · Empresa · Recruiter · Administración.
