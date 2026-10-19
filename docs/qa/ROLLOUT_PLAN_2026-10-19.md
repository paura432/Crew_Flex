# Production rollout plan — release 1 (`65df3b9`) · FOR OWNER APPROVAL

> **Only step 0 (read-only preflight) has been executed**, with the owner's authorization of
> 2026-10-19; its result is §0. Every other step (`functions deploy`, `db push`, `git push`,
> production E2E) is run by the owner after its **own** approval (AGENTS.md "STOP"; OD-9 main-only:
> a push to `main` is a production deploy). Revision 2 (2026-10-19) replaces the original order with
> the **safe order** of §4, which removes window W instead of monitoring it (differences: §13).

## 0. Preflight result (step 0, read-only, 2026-10-19) — GO for requesting step 1

| Check                                       | How (read-only)                                                                                                                   | Result                                                                                                                                                                                                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` SHA                           | `git ls-remote origin refs/heads/main`                                                                                            | `ddf5c4b72c96caaf19757b76e5aba9e888c32fa0`                                                                                                                                                                                          |
| `origin/main` is an ancestor of the release | `git merge-base --is-ancestor ddf5c4b 65df3b9`                                                                                    | yes (fast-forward, no history rewrite)                                                                                                                                                                                              |
| Release migrations                          | `git ls-tree 65df3b9 supabase/migrations/`                                                                                        | exactly 15 (10 production + `20261019120000`, `130000`, `140000`, `150000`, `150100`)                                                                                                                                               |
| Intermediate checkout                       | `git ls-tree 2216d38 …`; `git diff 2216d38 65df3b9 -- supabase/migrations`                                                        | exactly 13; the only difference is the two added files `150000`/`150100` — the first 13 are byte-identical                                                                                                                          |
| Remote migrations                           | `npx supabase migration list --linked`                                                                                            | 10/10 applied, the 10 production versions; nothing remote that is unknown locally                                                                                                                                                   |
| What each push would apply                  | `npx supabase db push --dry-run --workdir ../cf-r1a` and `--workdir ../cf-r1`                                                     | `../cf-r1a` (`2216d38`): #1–#3 only · `../cf-r1` (`65df3b9`): #1–#5 only — no wallet migration in either                                                                                                                            |
| Remote functions                            | `npx supabase functions list`                                                                                                     | 8 ACTIVE: health, professional-availability, work-requirements, capacity-evaluate, matching-evaluate (v2); professional-profile, professional-qualifications, user-preferences (v1). No `qualification-reviews`, no wallet function |
| Wallet excluded                             | `git diff --name-status ddf5c4b 65df3b9` filtered for documents / wallet / `1602…` / `browser.ts`                                 | no match                                                                                                                                                                                                                            |
| qualification-reviews not activated         | same diff on `supabase/functions/qualification-reviews`; flags (Q2)                                                               | function unchanged and not deployed; no flag row                                                                                                                                                                                    |
| No new Vercel variable                      | `process.env.*` / `Deno.env` references in `ddf5c4b..65df3b9`                                                                     | none added or removed; same set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `QUALIFICATION_REVIEW_ENABLED` unset, `NODE_ENV`)                                                                              |
| `config.toml`                               | `git diff ddf5c4b 65df3b9 -- supabase/config.toml`                                                                                | unchanged (`verify_jwt = false` per function, as deployed)                                                                                                                                                                          |
| Q1–Q10 are read-only                        | locally with `default_transaction_read_only = on`; remotely inside `begin transaction read only … rollback` (`db query --linked`) | both succeeded with `transaction_read_only = on`; every query is a `SELECT` of counts or catalog data; no personal data returned                                                                                                    |
| Data state (remote)                         | `docs/qa/release-1-preflight.sql`                                                                                                 | users 3 · organizations 0 · availability windows 0 · idempotency keys 0 · feature flags none · buckets 0 · enum `{available,unavailable}` · no release object exists yet · production CHECK                                         |
| Production unchanged by the preflight       | `migration list --linked` again after the dry runs                                                                                | still 10                                                                                                                                                                                                                            |

No precondition failed. Data state: the five migrations only add objects; the CHECK is widened to a
superset (no existing row can violate it); no row has to be rewritten.

## 1. Release commit and what it contains

**Release commit: `65df3b9`.** Local `main` is ahead (wallet and design work); those commits are
**not** part of this release. Diff `ddf5c4b..65df3b9`:

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
plan. A standalone checkout of `65df3b9` type-checks, passes Vitest (290) and `deno check` of every
function.

**Intermediate commit `2216d38`** (tools, before «AOG only») is used **only** as the migrations
source of step 2: its `supabase/migrations` holds #1–#3, byte-identical to `65df3b9`. No function
and no frontend is ever deployed from it.

## 2. Migrations

| #   | File                                           | Release 1       | Effect on existing production data                                                                |
| --- | ---------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `20261019120000_availability_days_replace.sql` | **yes, step 2** | widens a CHECK on `app_private.idempotency_keys.operation` (superset); new RPC                    |
| 2   | `20261019130000_availability_owner_lock.sql`   | **yes, step 2** | trigger `availability_windows_lock_owner` (advisory lock per technician on write); rows untouched |
| 3   | `20261019140000_availability_rotation.sql`     | **yes, step 2** | new private table `availability_rotations`; drops the 2-arg RPC created by #1 in the same push    |
| 4   | `20261019150000_aog_only_status.sql`           | **yes, step 4** | `ADD VALUE 'aog_only'` to `availability_status` — cannot fail on existing rows; **irreversible**  |
| 5   | `20261019150100_aog_only_matching.sql`         | **yes, step 4** | `create or replace app_private.ranked_external_pool` (same signature and privileges)              |
| 6–8 | `20261019160000`/`160100`/`160200` (wallet)    | no              | release 2                                                                                         |

No DROP/TRUNCATE of anything that exists in production, no data rewrite. Migrations #1–#3 contain no
reference to `aog_only`.

## 3. Edge Functions

| Function                                                                                                 | Runtime change                                                      | Release 1          |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------ |
| `matching-evaluate`, `capacity-evaluate`                                                                 | `aog_only` rule + tolerant pool parser                              | **deploy, step 1** |
| `professional-availability`                                                                              | `PUT` (cycle save, needs #1–#3); `GET` also returns `rotation` (#3) | **deploy, step 3** |
| `work-requirements`, `professional-profile`, `professional-qualifications`, `user-preferences`, `health` | only the 40P01 → 409 error mapping; everything else is type-only    | no                 |
| `qualification-reviews`                                                                                  | —                                                                   | **never** (OD-3)   |

Never run `functions deploy` without names: it would deploy `qualification-reviews` and, from a
newer checkout, the wallet functions.

## 4. Safe order — one owner approval per step

**Principle:** the enum value `aog_only` — the only thing old readers cannot handle — arrives **last**
in the backend, when every reader of availability is already the release version. Before step 4 no
`aog_only` row can exist (the database rejects the value — tested, state SA); after step 4 no old
reader remains. Window W no longer exists.

Preparation (local, no remote write; done for the preflight, repeat if the worktrees were removed):

```bash
cd /home/pau/pau/Crew_Flex
git worktree add --detach ../cf-r1  65df3b9   # release: functions, migrations #1–#5
git worktree add --detach ../cf-r1a 2216d38   # migrations #1–#3 only
for d in cf-r1 cf-r1a; do mkdir -p ../$d/supabase/.temp
  cp supabase/.temp/{project-ref,pooler-url,linked-project.json,postgres-version} ../$d/supabase/.temp/; done
# link metadata only (project ref, pooler host without password, versions) — no secret is copied
git -C ../cf-r1 status --porcelain; git -C ../cf-r1a status --porcelain   # expect: empty
```

Always run the CLI **from the main repo** (`npx supabase … --workdir ../cf-…`) so the pinned CLI
(2.120.0) is used, not a version downloaded inside the worktree.

| Step | Owner command                                                                                                                         | Expected result / checks after the step                                                                                                        | STOP if                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 0    | done (§0)                                                                                                                             | GO                                                                                                                                             | —                                                                                                                            |
| 1    | `npx supabase functions deploy matching-evaluate capacity-evaluate --use-api --workdir ../cf-r1 --project-ref sbjkzrkmcekokkqiuvvh`   | `functions list`: only these two change version (v3); C1 → 401 each; C2 → 204 with `access-control-allow-origin: https://crew-flex.vercel.app` | any other function's version changed; a probe differs; deploy error                                                          |
| 2    | `npx supabase db push --dry-run --workdir ../cf-r1a` (must list exactly #1–#3), then `npx supabase db push --workdir ../cf-r1a`       | `migration list --linked` 13/13; Q4 = `{available,unavailable}`; Q5–Q9 as in §7; Q11 false; Q2 empty / 0                                       | the dry run lists anything else; a migration fails (the CLI stops; §9 "partial push"); Q4 shows `aog_only`                   |
| 3    | `npx supabase functions deploy professional-availability --use-api --workdir ../cf-r1 --project-ref sbjkzrkmcekokkqiuvvh`             | `functions list`: only this one changes (v3); C1 → 401; C3: `access-control-allow-methods` includes `PUT`                                      | step 2 not at 13/13; a probe differs                                                                                         |
| 4    | `npx supabase db push --dry-run --workdir ../cf-r1` (must list exactly #4 and #5), then `npx supabase db push --workdir ../cf-r1`     | 15/15; Q4 = `{available,unavailable,aog_only}`; Q11 true; Q12 true; Q2 empty / 0; C1 still 401 for the three functions                         | the dry run lists anything but #4/#5; any of the three functions is not at its release version (`functions list`)            |
| 5    | `git push origin 65df3b9:main` — **not** `git push origin main` (that would ship the wallet code)                                     | Vercel production deployment of `65df3b9` succeeds; §8                                                                                         | the push is not a fast-forward (`origin/main` ≠ `ddf5c4b`); the Vercel build fails (production stays on the previous deploy) |
| 6    | Production E2E with synthetic users (`docs/qa/PRODUCTION_E2E_RUNBOOK.md`): **three separate approvals** (seed, run, cleanup) — writes | runbook checks                                                                                                                                 | runbook criteria                                                                                                             |

Steps can be days apart: every state between them is stable and tested (§5). Step 5 needs step 4
done (the release frontend uses `PUT` and «AOG only»); the production frontend works on every
backend state.

Probes (no token, no write; replace `F` with the function name):

```bash
B=https://sbjkzrkmcekokkqiuvvh.supabase.co/functions/v1
# C1 no token → 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/matching-evaluate"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$B/capacity-evaluate"
curl -s -o /dev/null -w '%{http_code}\n'         "$B/professional-availability"
# C2/C3 CORS preflight → 204, exact origin, allowed methods
curl -s -D - -o /dev/null -X OPTIONS -H 'Origin: https://crew-flex.vercel.app' \
  -H 'Access-Control-Request-Method: POST' "$B/F" | grep -iE '^HTTP|access-control-allow-(origin|methods)'
```

## 5. Compatibility — every state of the safe order, reproduced locally

`bash scripts/local/release-compat/run.sh ddf5c4b 65df3b9 20261015130400 2216d38` (local Docker
only: resets the local DB to the production schema, serves each function from its exact commit's
worktree on its own port, applies migrations from the `2216d38` and `65df3b9` checkouts, then
restores). Result 2026-10-19: **111/111 as expected**. Without the 4th argument it replays the
original order (still 67/67).

| State                                     | Functions (commit)            | Schema                 | Result                                                                                                                                                    |
| ----------------------------------------- | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 production today                       | all `ddf5c4b`                 | 10                     | matching/capacity 200; availability GET 200, POST 201, PUT 405                                                                                            |
| S1 after step 1                           | matching + capacity `65df3b9` | 10                     | matching results and capacity **identical** to S0                                                                                                         |
| SA after step 2                           | as S1                         | 13                     | all as S1; enum still `{available,unavailable}`; a direct `aog_only` insert is **refused** by the database → no such row can exist                        |
| RA rollback of all functions at step 2    | all `ddf5c4b`                 | 13                     | all as S0 — rolling functions back before step 4 is safe                                                                                                  |
| SB after step 3                           | all `65df3b9`                 | 13                     | GET 200 with `rotation`; POST 201; **PUT 200**; POST/PUT with `aog_only` → clean **400** and **nothing written** (windows and idempotency keys unchanged) |
| SC inside step 4 (#4 applied, #5 not yet) | all `65df3b9`                 | 14 + `aog_only` rows   | all 200; that professional is **not** eligible for the urgent need and **is** for its AOG twin; capacity −1 for the urgent need only                      |
| SD after step 4                           | all `65df3b9`                 | 15 (± `aog_only` rows) | all 200; same eligibility as SC — no accidental eligibility                                                                                               |
| R1 forbidden rollback (shown, never done) | all `ddf5c4b`                 | 15 + `aog_only` rows   | old matching → **500** — why §9 forbids reinstalling old functions after step 4                                                                           |

Frontend combinations (browser, local, 2026-10-19): the **production** frontend (`ddf5c4b`) against
the release backend **with** `aog_only` rows renders availability, matches and capacity with no
client errors (5/5) — this covers every backend state, since the API only gains fields. The
**release** frontend with production-like env (only the two public variables) shows «AOG only», the
tools hub, no Documents entry (`/app/professional/documents` → 404), no Verifications entry;
`/app/admin/verifications` renders Not found (HTTP 200 because Next streams the layout first —
identical in `ddf5c4b`; the queue is never rendered) (9/9).

## 6. Regression evidence (local, 2026-10-19)

| Check                                                                                      | Result                                                                                                                            |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `65df3b9` standalone: `tsc`, Vitest, `deno check`                                          | PASS (290 tests)                                                                                                                  |
| `65df3b9` local E2E (functions served from `65df3b9`)                                      | 26/26 (the review test needs the local-only `qualification_review` flag row; without it the review answers 404, as in production) |
| Production test suite (`ddf5c4b`) against the **release** backend                          | 25/25 — existing contracts unchanged                                                                                              |
| RLS/PGlite suites incl. O (per-day replace, rotation privacy), P (AOG parity, 3 urgencies) | PASS                                                                                                                              |
| `scripts/local/db-race-check.sh all` (incl. concurrent day edits)                          | 6/6                                                                                                                               |
| Release-compat harness: safe order / original order                                        | 111/111 / 67/67                                                                                                                   |
| Browser: cycle generator 21/21, tools 35/35, AOG 6/6 (1440/1024/768/390/360 px)            | PASS                                                                                                                              |
| Production                                                                                 | **not verified** — no authenticated test has ever run there                                                                       |

## 7. Read-only verification queries

Run them inside `begin transaction read only; … rollback;` (SQL editor) or with
`npx supabase db query --linked -f <file>` using that wrapper. All are `SELECT`s of counts or catalog
data. Q10 compares `status::text`, so it also runs before the enum value exists.

```sql
-- Q1 baseline counts                               preflight: 3 · 0 · 0
select (select count(*) from auth.users) users, (select count(*) from public.organizations) orgs,
       (select count(*) from public.availability_windows) windows;
-- Q2 no review activation, no wallet (every step)  expect: no rows · 0
select name, enabled from app_private.feature_flags;
select count(*) from storage.buckets;
-- Q3 applied migrations                            expect: 10 → 13 (step 2) → 15 (step 4)
select version from supabase_migrations.schema_migrations order by version;
-- Q4 enum                                          expect: {available,unavailable} until step 4, then + aog_only
select enum_range(null::public.availability_status);
-- Q5 new table RLS-protected, owner-only policies  expect from step 2: true · 4 policies *_own
select relrowsecurity from pg_class where oid = to_regclass('public.availability_rotations');
select policyname, cmd from pg_policies where tablename = 'availability_rotations' order by 1;
-- Q6 RPC privileges                                expect from step 2: false, true
select has_function_privilege('anon', 'public.replace_availability_days(uuid,jsonb,jsonb)', 'execute') anon,
       has_function_privilege('authenticated', 'public.replace_availability_days(uuid,jsonb,jsonb)', 'execute') auth;
-- Q7 the 2-arg RPC does not exist                  expect: 0
select count(*) from pg_proc where proname = 'replace_availability_days' and pronargs = 2;
-- Q8 lock trigger                                  expect: 0 before step 2, 1 after
select count(*) from pg_trigger where tgname = 'availability_windows_lock_owner';
-- Q9 CHECK                                         expect from step 2: includes 'availability_days.replace'
select pg_get_constraintdef(oid) from pg_constraint where conname = 'idempotency_keys_operation_check';
-- Q10 aog_only rows (information)                  expect: 0 until step 5 (no UI can write it before)
select count(*) from public.availability_windows where status::text = 'aog_only';
-- Q11 new pool filter present                      expect: false until step 4, then true
select pg_get_functiondef('app_private.ranked_external_pool(uuid)'::regprocedure) like '%aog_only%';
-- Q12 rollback gate (§9)                           true = old functions may NEVER be reinstalled
select 'aog_only' = any(enum_range(null::public.availability_status)::text[]);
```

`docs/qa/release-1-preflight.sql` is the single-statement read-only query used in step 0 (Q1–Q10
plus counts by kind); it can be re-run before every step.

## 8. After-deploy functional checks (no writes)

After each step: C1/C2/C3 probes (§4), Q2 still empty / 0, `functions list` versions. After step 5:
`/`, `/login`, `/register` 200; `/app/**` and `/app/tools` 307 `/login` when anonymous; with the
owner's own account, viewing only: `/app/tools/torque` (120 lbf·in → 10 lbf·ft),
`/app/professional/availability` renders with the «AOG only» option. Saving a cycle or an AOG window
belongs to the production E2E (step 6, separate approvals).

## 9. Recovery — forward first, never destroying technician data

| Situation                             | Action                                                                                                                                                                                                            | Never                                                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Step 1 problem                        | redeploy `matching-evaluate`, `capacity-evaluate` by name from a `ddf5c4b` worktree (safe: no `aog_only` can exist yet — state RA)                                                                                | —                                                                                                        |
| Partial push in step 2 or 4           | STOP. The failed file is rolled back by its own transaction; earlier ones stay (each is additive and unused by old code). Fix forward: a new corrective migration, tested locally (harness), pushed with approval | `migration repair`, manual SQL, editing an applied migration                                             |
| Step 3 problem                        | while Q12 = false: redeploy `professional-availability` from `ddf5c4b` by name (safe — RA)                                                                                                                        | —                                                                                                        |
| Any function problem **after step 4** | **forward fix only**: fix in a new commit, local tests + harness, deploy that function by name with approval. Q12 = true is the gate: no `ddf5c4b` version of the three functions is ever reinstalled             | reinstalling `ddf5c4b` matching/capacity/availability (R1 → 500); converting or deleting `aog_only` rows |
| Frontend problem (step 5)             | Vercel: redeploy deployment `7126745962` (`ddf5c4b`) — safe on every backend state (5/5)                                                                                                                          | `git push --force`, history rewrite                                                                      |
| Schema                                | **never reverted**; the release objects are harmless for old code                                                                                                                                                 | DROP, TRUNCATE, reset                                                                                    |

**Data rule (owner, 2026-10-19):** availability rows — including `aog_only` preferences — are never
converted or deleted to make a rollback possible. Any such change would need its own explicit
authorization; this plan does not need one, because recovery after step 4 is always forward.

## 10. Irreversible or hard-to-reverse effects

- The enum value `aog_only` cannot be removed (step 4).
- Rows written by new features (saved patterns, split windows, `aog_only` windows) stay; all are
  valid for old code except `aog_only` for the three old functions — hence the §9 gate.
- A push to `main` is public immediately (Vercel production), reversible only by redeploying the
  previous deployment.

## 11. Evidence that release 1 activates neither the wallet nor qualification review

- **Wallet:** no wallet file, function or migration in `ddf5c4b..65df3b9`; neither dry run lists a
  wallet migration (§0); no bucket is created (Q2 = 0 after steps 2 and 4); the release frontend
  has no Documents route (404, §5). Release 2 would switch it on from Supabase
  (`app_private.feature_flags('document_wallet')`, enforced by the database, Storage policies and
  the function — `DOCUMENT_WALLET.md` §8), never from Vercel. Its retention periods and
  maintenance mechanism are **not approved**.
- **Qualification review:** `qualification-reviews` is not deployed (§3); release 1 adds no
  `feature_flags` row and no secret (Q2 empty); `QUALIFICATION_REVIEW_ENABLED` stays unset in
  Vercel; the release frontend shows no Verifications entry and the page renders Not found (§5).

## 12. Environment variables (no value written here) and authorizations

| Variable                                              | Service                           | Public/private | Release 1                                  |
| ----------------------------------------------------- | --------------------------------- | -------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                            | Vercel                            | Public         | unchanged                                  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                | Vercel                            | Public         | unchanged                                  |
| `QUALIFICATION_REVIEW_ENABLED`                        | Vercel (server) / Supabase secret | Private flag   | **unset**, unchanged                       |
| `ALLOWED_ORIGINS`                                     | Supabase secret                   | Private        | unchanged (`https://crew-flex.vercel.app`) |
| `STORAGE_PUBLIC_URL`, `DOCUMENTS_MAINTENANCE_ENABLED` | Supabase local `.env`             | Private        | **not set remotely**                       |

Each needs its own owner authorization: (1) step 1 · (2) step 2 · (3) step 3 · (4) step 4 ·
(5) step 5 · (6) steps 6a/6b/6c · (7) any recovery action of §9 · (8) any change to availability data.

## 13. Differences from the previous revision (same day)

| Previous                                                                       | Now                                                                                                       | Why                                                                                       |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| One `db push` of #1–#5 from `65df3b9`, then deploy `professional-availability` | Push #1–#3 from `2216d38` (step 2), deploy the function (step 3), push #4–#5 from `65df3b9` (step 4)      | Removes window W (old GET → 500 for a user with an `aog_only` row) instead of watching it |
| Q10 = 0 before step 3 as the control                                           | No control needed: the database refuses `aog_only` until every reader is new (tested SA/SB)               | A write between the check and the deploy could not be excluded                            |
| Rollback of matching/capacity allowed after converting `aog_only` rows         | After step 4, forward fix only; no row conversion (Q12 gate)                                              | Owner: never destroy technician preferences to simplify a rollback                        |
| Commands run inside the worktree                                               | CLI from the main repo with `--workdir` (+ `--project-ref` for deploys); link metadata copied, no secrets | A worktree has no `node_modules` (npx fetched another CLI version) nor link metadata      |
| Steps 0–5                                                                      | Steps 0–6 (E2E is now step 6)                                                                             | one more step                                                                             |
| Preflight planned                                                              | Preflight executed: GO (§0)                                                                               | owner authorization of step 0                                                             |
