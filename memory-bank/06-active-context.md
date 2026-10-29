# 06 · Active context

_Last updated 2026-10-29 CET (v1.9 «Formación» on `feat/v19-training`, LOCAL: V19-01/02 + ponytail P0 + V19-04 calendar «F»/.ics; production unchanged = `574fd4f`). Keep under ~60 lines; replace, don't append history._

## Current task

Owner 2026-10-29 (spec «CrewFlex V1.9 — autonomous principal architect»): implement the v1.9 training module («Formación»)
LOCALLY to 100 % of the 41-requirement matrix `docs/integration/crewflex-v19/V19_MATRIX.md` (own metric, never mixed with the
v1.8 inventory). Technical decisions are delegated (ADR-003 `docs/architecture/ADR-003-training-module.md`); business, legal and
privacy policies stay with the owner (ADR-003 N-1…N-9, safe defaults in code). Authorised: local work, local commits, local DB,
read-only remote queries. NOT authorised: push to `main`, PR/merge to staging, any deploy, remote migrations, remote users
(the approved admin-account SQL for `crewflexaviation@gmail.com` is ON HOLD under this rule), production Auth or secrets.
Branch `feat/v19-training` (from `4644630`, LOCAL, not pushed): `628e1b5` ADR-003 + matrix · `dbc4ac3` V19-01 backend
(5 migrations `20261029100000…100400`, function `training`, DB/race tests) · `bcc7086` V19-02 UI · `77c8dc2` P0 + cleanup
from the independent ponytail audit (review queue `submitted_at`, translated training notice status, typed
`TrainingReviewItem`, dead code removed; training migrations edited in place → `db reset` locally after pulling) ·
`8ac75b1` smoke expects the «Formación» nav entries · V19-04 calendar «F» marker (`trainingDays`, not blocking) and
private `.ics` export (`/app/training/sessions.ics`, `src/features/training/ics.ts`): V19-029/030 VERIFIED_LOCAL.
Matrix rows of V19-01/02 still say PENDIENTE: V19-05 reconciles every row with evidence.

Gotchas: Docker Desktop can drop mid-session (`HEALTH=000` → restart, re-run); after ANY local reset set the flags via
STDIN to `db-owner-sql.sh` and restart `functions serve`; copy `.env.local`, `.env.e2e` and the functions' `.env` into a
new worktree; the smoke step-17 console 409 (and once a 404 on sign-out) is a load flake (re-run once); prettier turns `X-*` into `X-_` in prose.
A tool-created worktree can set `extensions.relativeWorktrees` in `.git/config` (git 2.43 then refuses every command:
make its two gitdir paths absolute, drop the line); a stale Kong port proxy gives `HEALTH=000` with the DB still up
(`docker restart supabase_kong_crew-flex`).
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

V19-05: reconcile the 41 matrix rows against code + tests (browser-verify the V19-02 flows with two organizations),
then the V19-038 fictitious demo scenario; independent ponytail audit before any new migration batch.

## Previous next step (owner, on hold under the v1.9 mandate)

The owner signs up `crewflexaviation@gmail.com` on https://crew-flex.vercel.app/register (professional, ≥ 12 characters) and
confirms; then run the approved admin SQL and verify «Ver como» shows Técnico · Empresa · Recruiter · Administración.
