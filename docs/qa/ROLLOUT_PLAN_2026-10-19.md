# Production rollout plan — release 1 (`65df3b9`) · FOR OWNER APPROVAL

> **Nothing here has been executed.** Every remote step (`functions deploy`, `db push`, `git push`,
> production E2E) is run by the owner after its **own** approval (AGENTS.md "STOP"; OD-9 main-only:
> a push to `main` is a production deploy). Production checked by the owner on 2026-10-19: 10
> migrations, 8 Edge Functions, no Storage bucket; `origin/main` = `ddf5c4b` (code `f158308`).

## 1. Release commit and what it contains

**Release commit: `65df3b9`.** Local `main` is ahead (`969adb2`, `3a1dcf4` and later wallet work);
those commits are **not** part of this release. Diff `ddf5c4b..65df3b9`:

| Area               | Enters production                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Availability       | cycle generator (atomic per-day save, saved private pattern, undo, no silent split), per-technician write lock, «AOG only» (BR-4.8) |
| Tools              | `/app/tools` (+ `/torque`, `/convert`, `/duration`), client-side only (D-11)                                                        |
| Matching           | `aog_only` semantics; pool parser reads unknown statuses as unavailable (review HIGH-1 safety net)                                  |
| Docs/tests/scripts | V1.8 delta audit, decision log, E2E runbook, tests, `scripts/local/*` (never deployed)                                              |

**Stays out:** the document wallet (`src/features/documents`, `src/app/app/professional/documents`,
`src/domain/documents.ts`, `src/lib/validation/documents.ts`, `src/lib/supabase/browser.ts`,
functions `professional-documents` and `documents-maintenance`, migrations
`20261019160000`/`160100`/`160200`, any Storage bucket), the D-06/D-07/D-12 design docs and this
plan. Verified: `git diff --name-status ddf5c4b 65df3b9` contains none of them; a standalone
checkout of `65df3b9` type-checks, passes Vitest (290) and `deno check` of every function, and has
exactly 15 migrations.

## 2. Migrations

| #   | File                                                  | Release 1 | Effect on existing production data                                                                |
| --- | ----------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| 1   | `20261019120000_availability_days_replace.sql`        | **yes**   | widens a CHECK on `app_private.idempotency_keys.operation` (existing rows stay valid); new RPC    |
| 2   | `20261019130000_availability_owner_lock.sql`          | **yes**   | trigger `availability_windows_lock_owner` (advisory lock per technician on write); rows untouched |
| 3   | `20261019140000_availability_rotation.sql`            | **yes**   | new private table `availability_rotations`; drops the 2-arg RPC created by #1 in the same push    |
| 4   | `20261019150000_aog_only_status.sql`                  | **yes**   | `ADD VALUE 'aog_only'` to `availability_status` — cannot fail on existing rows                    |
| 5   | `20261019150100_aog_only_matching.sql`                | **yes**   | `create or replace app_private.ranked_external_pool` (same signature and privileges)              |
| 6   | `20261019160000_document_wallet.sql`                  | no        | wallet (release 2)                                                                                |
| 7   | `20261019160100_document_wallet_hardening.sql`        | no        | wallet                                                                                            |
| 8   | `20261019160200_document_wallet_gate_and_cleanup.sql` | no        | wallet gate (Supabase flag) + file cleanup (M-3)                                                  |

The five release migrations are additive: no DROP/TRUNCATE of anything that exists in production,
no data rewrite.

## 3. Edge Functions — which ones and why

Module-graph diff of every function between `ddf5c4b` and `65df3b9` (`deno info`): every graph
changes, but only these changes affect runtime:

| Function                                                                                                 | Runtime change                                                                 | Release 1          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------ |
| `matching-evaluate`                                                                                      | `aog_only` rule + tolerant pool parser                                         | **deploy, step 1** |
| `capacity-evaluate`                                                                                      | same                                                                           | **deploy, step 1** |
| `professional-availability`                                                                              | `PUT` (cycle save, needs migrations #1–#3); `GET` also returns `rotation` (#3) | **deploy, step 3** |
| `work-requirements`, `professional-profile`, `professional-qualifications`, `user-preferences`, `health` | only the 40P01 → 409 error mapping; everything else is type-only               | no                 |
| `qualification-reviews`                                                                                  | —                                                                              | **never** (OD-3)   |

## 4. Exact order — one owner approval per step

| Step | Command (owner)                                                                                                                               | Immediate checks                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 0    | Read-only preflight: `git worktree add ../cf-r1 65df3b9`; `npx supabase migration list --linked` (10/10); queries Q1–Q3 (§7)                  | nothing pending remotely; Q1 counts recorded; Q2 = 0 rows / 0 buckets                                |
| 1    | From `../cf-r1`: `npx supabase functions deploy matching-evaluate capacity-evaluate --use-api` (**by name**)                                  | each without token → 401; `OPTIONS` from `https://crew-flex.vercel.app` → 204 with that exact origin |
| 2    | From `../cf-r1`: `npx supabase db push` (that checkout holds exactly migrations #1–#5 as pending)                                             | `migration list --linked` 15/15; Q4–Q9; Q2 still 0 / 0                                               |
| 3    | Q10 = 0, then from `../cf-r1`: `npx supabase functions deploy professional-availability --use-api`                                            | 401 without token; `OPTIONS` allows `PUT`                                                            |
| 4    | `git push origin 65df3b9:main` — **not** `git push origin main` (that would ship the wallet code)                                             | Vercel success for `65df3b9`; anonymous `/app/tools` → 307 `/login`; `/`, `/login` 200               |
| 5    | Production E2E with synthetic users (`docs/qa/PRODUCTION_E2E_RUNBOOK.md`): **three separate approvals** (seed, run, cleanup) — it writes data | runbook checks                                                                                       |

Never run `functions deploy` without names: it would deploy `qualification-reviews` and, from a
newer checkout, the wallet functions.

## 5. Compatibility — every intermediate state, reproduced locally

`bash scripts/local/release-compat/run.sh ddf5c4b 65df3b9 20261015130400` (local Docker only:
resets the local DB to the production schema, serves each function from its exact commit on its own
port, applies the release migrations from a `65df3b9` checkout, then restores). Result 2026-10-19:
**67/67 as expected**.

| State                      | Functions                       | Schema               | Result                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 production today        | all `ddf5c4b`                   | 10                   | matching/capacity 200; availability GET 200, POST 201, PUT 405                                                                                                                                                                                                                                                                         |
| S1 after step 1            | matching + capacity `65df3b9`   | 10                   | matching results and capacity **identical** to S0                                                                                                                                                                                                                                                                                      |
| S2 after step 2            | as S1                           | 15                   | no `aog_only` rows: as S1. With `aog_only` rows written by a professional: matching/capacity **200**; that professional is **not** eligible for the urgent need and **is** eligible for an AOG twin; internal capacity drops by one for the urgent need only — no accidental eligibility                                               |
| W window between steps 2–3 | old `professional-availability` | 15                   | **known:** its GET returns 500 **only** for a professional who has an `aog_only` row. No UI can create one before step 4 (the old frontend has no «AOG only»): only a hand-made API call. Q10 = 0 before step 3 confirms nobody hit it. The reverse order is worse: the new function needs `availability_rotations` → 500 for everyone |
| S3 after step 3            | release functions               | 15                   | GET 200 including `aog_only`; `PUT` 200; matching unchanged                                                                                                                                                                                                                                                                            |
| R1 rollback hazard         | all `ddf5c4b`                   | 15 + `aog_only` rows | old matching → **500** (why §9 forbids rolling matching/capacity back while such rows exist)                                                                                                                                                                                                                                           |
| R2                         | all `ddf5c4b`                   | 15, rows removed     | 200, identical to S0                                                                                                                                                                                                                                                                                                                   |

Frontend combinations (browser, local): the **production** frontend (`ddf5c4b`) against the release
backend with `aog_only` rows renders availability, matches and capacity with no client errors (5/5).
The **release** frontend (`65df3b9`) with production-like env (only the two public variables) shows
«AOG only», the tools hub with 3 tools, no Documents entry, `/app/professional/documents` → 404, no
Verifications entry for a platform admin, and `/app/admin/verifications` renders Not found (HTTP 200
because Next streams the layout first — identical in `ddf5c4b`; the queue is never rendered), no
client errors (9/9).

## 6. Regression evidence (local, 2026-10-19)

| Check                                                                                      | Result                                                                                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `65df3b9` standalone: `tsc`, Vitest, `deno check`                                          | PASS (290 tests)                                                                                                                  |
| `65df3b9` local E2E (functions served from `65df3b9`)                                      | 26/26 (the review test needs the local-only `qualification_review` flag row; without it the review answers 404, as in production) |
| Production test suite (`ddf5c4b`) against the **release** backend                          | 25/25 — existing contracts unchanged                                                                                              |
| RLS/PGlite suites incl. O (per-day replace, rotation privacy), P (AOG parity, 3 urgencies) | PASS                                                                                                                              |
| `scripts/local/db-race-check.sh all` (incl. concurrent day edits)                          | 6/6                                                                                                                               |
| Browser: cycle generator 21/21, tools 35/35, AOG 6/6 (1440/1024/768/390/360 px)            | PASS                                                                                                                              |
| Production                                                                                 | **not verified** — no authenticated test has ever run there                                                                       |

## 7. Read-only verification queries (production SQL editor)

```sql
-- Q1 baseline counts (step 0)
select (select count(*) from auth.users) users, (select count(*) from public.organizations) orgs,
       (select count(*) from public.availability_windows) windows;
-- Q2 no review activation and no wallet (steps 0, 2 and 4): expect no rows, then 0
select name, enabled from app_private.feature_flags;
select count(*) from storage.buckets;
-- Q3 applied migrations
select version from supabase_migrations.schema_migrations order by version;
-- Q4 enum after step 2: expect {available,unavailable,aog_only}
select enum_range(null::public.availability_status);
-- Q5 the new table is RLS-protected with owner-only policies
select relrowsecurity from pg_class where oid = 'public.availability_rotations'::regclass;
select policyname, cmd, qual from pg_policies where tablename = 'availability_rotations' order by 1;
-- Q6 anon cannot execute the new RPC; authenticated can: expect false, true
select has_function_privilege('anon', 'public.replace_availability_days(uuid,jsonb,jsonb)', 'execute') anon,
       has_function_privilege('authenticated', 'public.replace_availability_days(uuid,jsonb,jsonb)', 'execute') auth;
-- Q7 the 2-arg version no longer exists: expect 0
select count(*) from pg_proc where proname = 'replace_availability_days' and pronargs = 2;
-- Q8 lock trigger present: expect 1
select count(*) from pg_trigger where tgname = 'availability_windows_lock_owner';
-- Q9 widened CHECK includes 'availability_days.replace'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'idempotency_keys_operation_check';
-- Q10 before step 3: expect 0
select count(*) from public.availability_windows where status = 'aog_only';
```

## 8. After-deploy functional checks

Without writing: function probes (401/405, CORS), `/`, `/login`, `/register` 200, `/app/**` 307,
`/app/tools` 307 when anonymous, Q2 still empty. With the owner's own account, viewing only:
`/app/tools/torque` (120 lbf·in → 10 lbf·ft), `/app/professional/availability` renders. Saving a
cycle or an AOG window belongs to the production E2E (step 5, separate approvals).

## 9. Rollback

| Layer                                    | How                                                                                                                | Limits                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (code)                          | Vercel: redeploy deployment `7126745962` (`ddf5c4b`)                                                               | none: the old frontend works with the new backend (tested, §5)                                                                                                                    |
| `professional-availability` (function)   | redeploy from a `ddf5c4b` checkout, by name                                                                        | while `aog_only` rows exist, the old GET fails for those users (window W)                                                                                                         |
| `matching-evaluate`, `capacity-evaluate` | **not below step 1 while any `aog_only` row exists** (R1 → 500 for every evaluation including such a professional) | first convert those rows — a data change needing its own approval, e.g. `update availability_windows set status = 'unavailable' where status = 'aog_only'` (loses the AOG intent) |
| Schema                                   | **not reverted** (no DROP in production)                                                                           | the `aog_only` enum value cannot be removed; `availability_rotations`, the lock trigger and the RPC remain (harmless for old code: R2 identical to S0)                            |

Not automatically reversible: the enum value; rows written by new features (saved patterns, split
windows, `aog_only` windows) — all valid for old code except the `aog_only` caveat above.

## 10. Evidence that release 1 activates neither the wallet nor qualification review

- **Wallet:** no wallet file, function or migration in `ddf5c4b..65df3b9` (§1); no bucket is
  created (Q2 = 0 after step 2); the release frontend has no Documents route (404, §5). Release 2
  will switch it on from Supabase (`app_private.feature_flags('document_wallet')`, enforced by the
  database, Storage policies and the function — `DOCUMENT_WALLET.md` §8), never from Vercel.
- **Qualification review:** `qualification-reviews` is not deployed (§3); release 1 adds no
  `feature_flags` row and no secret (Q2 empty); `QUALIFICATION_REVIEW_ENABLED` stays unset in
  Vercel; the release frontend shows no Verifications entry and the page renders Not found (§5).

## 11. Environment variables (no value written here)

| Variable                                              | Service                           | Public/private | Purpose                  | Release 1                                  |
| ----------------------------------------------------- | --------------------------------- | -------------- | ------------------------ | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                            | Vercel                            | Public         | project URL              | unchanged                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                | Vercel                            | Public         | client key (RLS applies) | unchanged                                  |
| `QUALIFICATION_REVIEW_ENABLED`                        | Vercel (server) / Supabase secret | Private flag   | OD-3 gate                | **unset**, unchanged                       |
| `ALLOWED_ORIGINS`                                     | Supabase secret                   | Private        | CORS allow-list          | unchanged (`https://crew-flex.vercel.app`) |
| `STORAGE_PUBLIC_URL`, `DOCUMENTS_MAINTENANCE_ENABLED` | Supabase local `.env`             | Private        | wallet, local only       | **not set remotely**                       |

No new Vercel variable.

## 12. Actions that need individual owner authorization

1. Step 1 — deploy `matching-evaluate`, `capacity-evaluate` (by name, from `65df3b9`).
2. Step 2 — `db push` of migrations #1–#5 from the `65df3b9` checkout.
3. Step 3 — deploy `professional-availability` (by name, from `65df3b9`).
4. Step 4 — `git push origin 65df3b9:main` (Vercel production deploy).
5. Steps 5a/5b/5c — production E2E: seed synthetic users / run / cleanup.
6. Any rollback of §9, and any conversion of `aog_only` rows.
