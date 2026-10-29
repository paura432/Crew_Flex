# 06 · Active context

_Last updated 2026-10-29 CET (PR #1 merged by the owner → production = `574fd4f` + full backend; Auth §0b applied; ORG-04 #22 closed locally; owner admin account in progress). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-29 (spec «CrewFlex V1.9 — autonomous principal architect»): implement the v1.9 training module («Formación»)
LOCALLY to 100 % of the 41-requirement matrix `docs/integration/crewflex-v19/V19_MATRIX.md` (own metric, never mixed with the
v1.8 inventory). Technical decisions are delegated (ADR-003 `docs/architecture/ADR-003-training-module.md`); business, legal and
privacy policies stay with the owner (ADR-003 N-1…N-9, safe defaults in code). Authorised: local work, local commits, local DB,
read-only remote queries. NOT authorised: push to `main`, PR/merge to staging, any deploy, remote migrations, remote users
(the approved admin-account SQL for `crewflexaviation@gmail.com` is ON HOLD under this rule), production Auth or secrets.
Branch `feat/v19-training` (from `4644630`): `628e1b5` ADR-003 + matrix. Batch V19-01 Foundation (schema, RLS, RPCs, function
`training`, contracts, DB/race tests) runs in an isolated worktree, branch `v19/foundation`; next V19-02…05 (catalog/provider/
admin UI, requests/messages, calendar «F» + ICS + notices, QA). Earlier today: audit `79f30ef`, PR #1 merged by the owner →
production `574fd4f`, Auth §0b applied, ORG-04 #22 `2feb357`, v1.9.0 delta diff `4644630`.

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

Pushing ORG-04 #22 to `main` (deploy); v1.9.0 as the parity reference + Formación scope + D-11 for «Horas y UTC» (`20-v190-delta/README.md`); `jwt_exp` 600; custom SMTP; OD-3 in production; D-07 P3 + scanner; Q6 vs SCOPE-2;
the `19-pending-audit.md` §3 decisions; `14-decision-pack.md` §2; the T-xx sign-offs; §0c Crew_Flex-only token, then revoke
the current one.

## Next step (one)

The owner signs up `crewflexaviation@gmail.com` on https://crew-flex.vercel.app/register (professional, ≥ 12 characters) and
confirms; then run the approved admin SQL and verify «Ver como» shows Técnico · Empresa · Recruiter · Administración.
