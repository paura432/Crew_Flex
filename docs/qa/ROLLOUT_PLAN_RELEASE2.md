# Publication plan — release 2 candidate (local `main` after `65df3b9`) · FOR OWNER APPROVAL · NOT EXECUTED

> Written 2026-10-20 from the local tree (`src/` and `supabase/` as in `7f7235a`). **Nothing here has been run
> against production.** Every step below needs its own owner approval (AGENTS.md «STOP», OD-9 main-only: a push
> to `main` is a production deploy). Evidence comes from the local drill `scripts/local/release-compat/release2.sh`
> (2026-10-20, 23/23) and the gates recorded in `memory-bank/01-current-state.md`. Release 1 and its method:
> `ROLLOUT_PLAN_2026-10-19.md`.

## 0. What local `main` adds to production (`65df3b9..HEAD`, 38 commits)

| Group                           | Content                                                                                                                                                                                                                                                                                         | Backend change                                                                                                         | Approval state                                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A · UI parity batches 1–17      | matches list (search/sort/pages/compare), overview checklist + calendar, TD-44 review list, visual P2, 44 px targets, mobile menu, «Expired» display, sentence-case chips, nav icons                                                                                                            | none                                                                                                                   | migration work authorised locally; publication not yet approved                                                                                                                     |
| B · Requirement close + filters | PATCH close (terminal, frozen, audited), list filters `status`/`endsAfter` (dashboard focus), matching/capacity 409 on a closed need                                                                                                                                                            | migrations `20261020120000`, `20261020120100`; functions `work-requirements`, `matching-evaluate`, `capacity-evaluate` | same                                                                                                                                                                                |
| C · Password recovery (batch 8) | forgot → e-mail → `/auth/confirm` (recovery only) → reset; reset ends every session                                                                                                                                                                                                             | none in the database; **Auth setting** (redirect URL)                                                                  | **hard prerequisite of step 4** (Auth redirect glob, §4 step 3): the login page links «Forgot password» unconditionally, so pushing without it ships a visible broken recovery flow |
| D · Security headers (batch 17) | nonce CSP in **report-only** mode, zod `jitless`                                                                                                                                                                                                                                                | none                                                                                                                   | report-only is safe; enforcing waits for the owner DevTools pass (`SECURITY_PRIVACY.md` T18)                                                                                        |
| E · Document wallet (release 2) | private Storage wallet, expiry chips, cleanup job                                                                                                                                                                                                                                               | migrations `20261019160000`–`160200`; **new** functions `professional-documents`, `documents-maintenance`              | **not approved**: wallet retention proposals open (`14-decision-pack.md` §2); the flag row stays absent                                                                             |
| F · Hiring circuit (M07–M09)    | at the time of this plan: the pure transition table only. **Since 2026-10-22 the branch `feat/v18-html-parity` implements M05/M07/M08 locally** (migrations `20261022130000…130300`, `opportunities`/`applications` functions); they are NOT part of release 2 — see `ROLLOUT_PLAN_V18_LOOP.md` | none                                                                                                                   | blocked by D-06/D-07/D-12 — not part of any release                                                                                                                                 |

Nothing in A–D depends on E (drill states S0/S1: the HEAD function and frontend work on the production schema; the
wallet UI hides itself when `is_feature_enabled` is absent or false). Expected noise with R2-core: every professional
page render calls that RPC once (`AppShell.tsx`) and gets `PGRST202` from PostgREST until the wallet migrations exist —
it fails closed (`feature-flags.ts`), nothing else.

## 1. Two compositions — the owner chooses

| Option                          | Migrations pushed                                                                  | Functions deployed (named, never bare)                                | Side effects in production                                                                                                                                  | When                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **R2-core** (recommended first) | the two close migrations only                                                      | `work-requirements`, `matching-evaluate`, `capacity-evaluate`         | none beyond the triggers; no bucket, no retention row                                                                                                       | as soon as steps 0–5 are approved                               |
| **R2-full**                     | all five (`db push` applies every pending file in order: wallet first, then close) | the same three; wallet functions **only** with the retention approval | creates the private bucket `professional-documents` and the `app_private.document_retention_settings` row with the **proposed** defaults (30 d grace, 24 h) | only together with the wallet retention decision (`14` §2, M10) |

`supabase db push` has no «skip these files» switch, and the wallet files sort **before** the close files. Two ways to
ship R2-core — the owner picks one; **neither is done yet**:

- **R2-core/rename:** one commit on `main` renames the close migrations to versions earlier than `20261019160000`
  (`20261019151000_requirement_close.sql`, `20261019151100_requirement_closed_frozen.sql`; same bytes), followed by a
  local `db reset` so the recorded versions match. The `db push` workdir is a worktree of that commit **with the three
  wallet files deleted** (dirty by design; the control is `db push --dry-run` listing exactly the two). Step 4 pushes
  that `main` SHA — it still carries the wallet files, which is fine: the frontend is gated and no wallet function is
  deployed. R2-full later pushes the wallet files normally (they sort after the close versions).
- **R2-core/no-rename:** keep the versions; delete the three wallet files in the push worktree only. R2-full later
  needs `db push --include-all`, because the wallet versions sort before an already-applied one and the CLI refuses
  out-of-order files by default.

## 2. Migrations — what the local drill verified (2026-10-20)

- Fresh `db reset`: the 20 migrations apply in order (`20261009120000` … `20261020120100`), seed loads.
- The five local-only files are additive: new functions, triggers, policies, tables, one bucket; the only `drop`s
  recreate a CHECK constraint (`idempotency_keys_operation_check`) and policies of the same name. No table or
  column is dropped, no row is changed. Forward-only (no down scripts, as every migration in this repo).
- After them: RLS enabled on every `public` table (0 exceptions); the three close triggers exist; guard functions
  are not executable by `anon`/`authenticated`; `is_feature_enabled('document_wallet')` returns false under `authenticated` without the
  flag row and a technician's Storage insert into the bucket is refused by RLS (drill S2); the table-level gate is
  covered by `tests/db/rls.test.ts`.
- Closed requirement: terminal and frozen — a reopen and an edit are both refused with `55000` by
  `guard_closed_requirement` (it fires first, alphabetical trigger order; the reopen branch of `guard_requirement_status`
  is defence in depth), audited once (`requirement.status_changed`), closing again is a 200 no-op, the dashboard focus
  drops the row, matching/capacity answer 409 (drill S2).
- Data in production (2026-10-19: 0 organizations, 0 requirements) makes the close triggers inert on arrival; the
  checks above do not rely on that.

## 3. Compatibility — every intermediate state, reproduced locally

`bash scripts/local/release-compat/release2.sh` (defaults `65df3b9`, schema `20261019150100`; resets the local
database twice; ~2 min; 23 checks, 2026-10-20 23/23):

| State                         | Check                                                                                                      | Result                                     | Consequence for the order                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| pre                           | schema = 15; far-future twin of the seed requirement inserted (open)                                       | as expected                                | the drill does not depend on today's date                            |
| S0 · production fn, schema 15 | plain list                                                                                                 | 200                                        | —                                                                    |
| S0                            | HEAD dashboard focus query (`status`, `endsAfter`)                                                         | **400 VALIDATION_ERROR**                   | **frontend before function = organization dashboard shows an error** |
| S0                            | HEAD close (PATCH)                                                                                         | 405, nothing written                       | close button fails cleanly until the function is deployed            |
| S0                            | `is_feature_enabled` under `authenticated`                                                                 | «does not exist» → UI fails closed         | HEAD frontend is safe on schema 15                                   |
| S1 · HEAD fn, schema 15       | focus query: count = SQL (`status='open' and ends_at > now()`), only open rows, twin present               | 200, equal                                 | —                                                                    |
| S1                            | close                                                                                                      | 200 closed                                 | works…                                                               |
| S1                            | audit rows / reopen by SQL                                                                                 | **0 / allowed**                            | **function before migrations = unaudited, reversible close**         |
| S2 · HEAD fns, schema 20      | 20 migrations; RLS on every public table; 3 triggers; bucket; RPC false; Storage insert refused by RLS     | as designed                                | target state                                                         |
| S2                            | close → audited once; close again → no-op; focus drops the row; reopen and edit refused; matching/capacity | 200/1 · 200/1 · absent · `55000` · 409/409 | target behaviour                                                     |
| R · production fns, schema 20 | list shows the closed row as `closed`; close 405; old matching/capacity 200 (no 409 yet)                   | as expected                                | function rollback is safe at any time; schema first is safe          |

Every «refused»/«absent» check matches the exact Postgres error text (a broken harness fails, it does not pass).
Not covered by the drill (covered elsewhere): the UI itself (`scripts/local/ui-smoke.mjs` 105/105 at HEAD), wallet
Edge Functions and the table-level flag gate (local E2E and `tests/db/rls.test.ts`).

## 4. Safe order — one owner approval per step, stop on any deviation

| Step | Action (owner runs it, or authorises the agent for that step only)                                                                                                                                                                                                                                                                                                                                                    | Verify before the next step (read-only)                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Preflight (read-only): `git ls-remote origin refs/heads/main` = `65df3b9`; `git merge-base --is-ancestor 65df3b9 <release-sha>`; `migration list --linked` = 15; functions = 8 with the versions of `01-current-state.md`; counts (users, organizations, requirements); no flag rows; 0 buckets; Auth **Site URL** and **Redirect URLs** read from the dashboard and recorded                                         | GO only if identical to the recorded state                                                                                                                           |
| 1    | R2-core: prepare the release checkout (close migrations renamed, no wallet files); `db push --dry-run` lists exactly the two; then `db push`                                                                                                                                                                                                                                                                          | 17 remote migrations; 3 triggers on `work_requirements`/`work_requirement_qualifications`; RLS unchanged; counts unchanged                                           |
| 2    | `npx supabase functions deploy work-requirements matching-evaluate capacity-evaluate --use-api --workdir <release-worktree> --project-ref sbjkzrkmcekokkqiuvvh` (never bare `functions deploy`; the checkout's `config.toml` also lists the two wallet functions — irrelevant to a named deploy)                                                                                                                      | probes without token 401, other methods 405, CORS 204 for the Vercel origin; downloaded sources identical to the release SHA                                         |
| 3    | Auth → URL Configuration → Redirect URLs: add the glob `https://crew-flex.vercel.app/auth/confirm**` (the app sends `/auth/confirm?next=/reset-password`; GoTrue matches allow-list entries as globs against the full URL, so an exact entry only works when the Site URL host is already the Vercel host — step 0 tells). **Required before step 4.** Separate decision, not bundled: T22 «require current password» | owner requests a recovery e-mail for their own account and checks that the link's host and path are `crew-flex.vercel.app/auth/confirm` (one e-mail, no other write) |
| 4    | `git push origin <release-sha>:main` (fast-forward; publishes the frontend)                                                                                                                                                                                                                                                                                                                                           | Vercel build success; `/`, `/login`, `/register` 200; `/app/**` 307; response carries `Content-Security-Policy-Report-Only` with a nonce                             |
| 5    | Owner, signed in: organization dashboard renders the focus (200, no error panel); DevTools console shows **no** CSP report on the routes of `SECURITY_PRIVACY.md` T18                                                                                                                                                                                                                                                 | if a report appears: record it, keep report-only, fix locally; **never** flip to enforcing in this release                                                           |

Why this order: step 1 before 2 (drill S1: the new function on the old schema closes without audit and without
freezing); step 2 before 4 (drill S0: the new frontend on the old function gets 400 on the dashboard focus).
Step 3 before 4 (without the glob the recovery link falls back to the Site URL and the published «Forgot password»
flow is broken). Steps 1 and 2 are inert for the production frontend of today (drill R: the old functions read the new
schema; the old frontend never sends the new filters or PATCH).

## 5. Rollback

- Functions: redeploy the three from `65df3b9` (drill R: all three on schema 20 — the list returns the closed row as
  `closed`, the old parser already knows the status; matching/capacity answer 200 without the 409).
- Frontend: Vercel rollback to the previous production deployment (`7179643776` = `65df3b9`, see
  `01-current-state.md`); the old frontend is compatible with the new functions and schema (it sends a subset).
- Migrations: forward-only; never dropped. The only effects that outlive a rollback are closed rows (correct by
  rule, V1.8 «la oferta cerrada no se reabre») and audit rows. R2-full additionally leaves the empty bucket and
  the retention row (inert without the flag and the wallet functions).

## 6. Prerequisites and open items (not this plan's to decide)

| Item                                                         | Where                                     | State                         |
| ------------------------------------------------------------ | ----------------------------------------- | ----------------------------- |
| Pick R2-core or R2-full                                      | §1                                        | owner                         |
| Auth redirect glob for recovery (+ Site URL read)            | `ENVIRONMENTS.md` §1                      | owner, step 3 (before step 4) |
| T22 «require current password» in production Auth            | `14-decision-pack.md` §2 T22              | owner decision, separate      |
| CSP from report-only to enforcing                            | `SECURITY_PRIVACY.md` T18                 | after a clean production pass |
| Wallet retention (R2-full), wallet functions deploy          | `14-decision-pack.md` §2 Wallet retention | owner decision                |
| Authenticated E2E in production                              | `PRODUCTION_E2E_RUNBOOK.md`               | never run; owner approval     |
| `QUALIFICATION_REVIEW_ENABLED` / `qualification_review` flag | `01-current-state.md` OD-3                | stays off at all 3 layers     |

## 7. Not part of this plan

No step of this document has been executed. No push, deploy, migration, secret, Auth or Vercel change was made
while writing it. M07–M09 (opportunities, applications, Candidate Pack) ship in no release until the decisions of
`14-decision-pack.md` §2 are answered.
