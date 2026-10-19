# Production rollout plan — parity batches of 2026-10-19 · FOR OWNER APPROVAL

> **Nothing here has been executed.** Every step that touches production (`db push`,
> `functions deploy`, `git push`, secrets, Vercel) is run by the owner, one approval per step
> (AGENTS.md "STOP", OD-9 main-only: a push to `main` is a production deploy). Production today:
> `origin/main` = `ddf5c4b` (code `f158308`), 10 migrations, 8 functions (memory-bank/01).

## 1. What would ship

| Wave                                                                                     | Contents                                                                                                                                                                                | Commits (local `main`, not pushed)                                                      |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| docs                                                                                     | V1.8 delta audit, E2E runbook, decision log, design docs D-06/D-07/D-12                                                                                                                 | `727d8ab`, earlier local commits `bbccf10`…`f116e61`, and the docs commit of this batch |
| **1** (release commit **`65df3b9`**, verified standalone: types, Vitest 290, Deno check) | Availability cycle generator (atomic per-day save, saved pattern, undo, no silent split, per-technician lock), «AOG only» (BR-4.8), tools (units, torque, durations — client-side only) | `fdbce9c`, `4ea8d9e`, `2216d38`, `ae90796` + `65df3b9`                                  |
| **2**                                                                                    | Document wallet (owner only, private bucket)                                                                                                                                            | `969adb2` — **not recommended yet** (§6)                                                |

The frontend ships everything in one push, but the wallet stays hidden in production: its page and
nav entry are behind the server flag `DOCUMENT_WALLET_ENABLED`, unset in Vercel (§7).

## 2. Migrations — exact list and order

| #   | File                                           | Wave | Effect on existing data                                                                                                            |
| --- | ---------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `20261019120000_availability_days_replace.sql` | 1    | Widens the `app_private.idempotency_keys.operation` CHECK (existing rows stay valid); adds RPC (2-arg)                             |
| 2   | `20261019130000_availability_owner_lock.sql`   | 1    | Replaces that RPC body; adds trigger `availability_windows_lock_owner` (per-technician advisory lock; existing rows untouched)     |
| 3   | `20261019140000_availability_rotation.sql`     | 1    | New private table `availability_rotations`; drops the 2-arg RPC created by #1 (never used in production) and creates the 3-arg one |
| 4   | `20261019150000_aog_only_status.sql`           | 1    | `ALTER TYPE availability_status ADD VALUE 'aog_only'` — cannot fail on existing rows                                               |
| 5   | `20261019150100_aog_only_matching.sql`         | 1    | `create or replace app_private.ranked_external_pool` (same signature)                                                              |
| 6   | `20261019160000_document_wallet.sql`           | 2    | New enums, table, private bucket `professional-documents`, Storage policies, RPC, audit trigger                                    |
| 7   | `20261019160100_document_wallet_hardening.sql` | 2    | Storage upload requires a technician profile; size check fails closed                                                              |

Compatibility: all additive (no DROP of anything that exists in production, no data rewrite).
Production data on 2026-10-16: 1 real user, no organizations — re-check counts in the preflight.

## 3. Exact order — wave 1 (avoids review finding HIGH-1)

A migration that adds `aog_only` before the functions understand it would let one professional's
`aog_only` window make every matching/capacity evaluation that includes them fail. Hence:

| Step | Owner command (sketch)                                                                                                                | Check right after                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Preflight: `git status` clean, `git rev-parse HEAD`; `npx supabase migration list --linked` (10/10); read-only counts                 | Nothing pending remotely; counts match memory-bank/01                                                                                                                                                                                      |
| 1    | `npx supabase functions deploy matching-evaluate capacity-evaluate work-requirements --use-api` (**by name**, never bare)             | Each without token → 401; OPTIONS from `https://crew-flex.vercel.app` → 204 with exact origin                                                                                                                                              |
| 2    | `npx supabase db push` **from a checkout of `65df3b9`** (`git worktree add ../cf-wave1 65df3b9`), so only #1–#5 exist and are applied | `migration list --linked` 15/15; read-only SQL: `select enum_range(null::availability_status)` contains `aog_only`; RLS on `availability_rotations`; anon has no EXECUTE on `replace_availability_days(uuid,jsonb,jsonb)`; trigger present |
| 3    | `npx supabase functions deploy professional-availability --use-api`                                                                   | 401 without token; OPTIONS allows `PUT`                                                                                                                                                                                                    |
| 4    | `git push origin main` (Vercel build)                                                                                                 | Vercel status success; `/app/tools` → 307 to login when anonymous; `/app/professional/documents` 404 for a signed-in user (flag unset)                                                                                                     |
| 5    | Production E2E (separate approval, `docs/qa/PRODUCTION_E2E_RUNBOOK.md`)                                                               | Runbook checks + cycle save + AOG window, synthetic accounts only, then cleanup                                                                                                                                                            |

`qualification-reviews` is **never** deployed (OD-3 stays closed in production).
`professional-profile`, `professional-qualifications`, `user-preferences`, `health` need no redeploy.

## 4. BR-4.6 impact

Before: a calendar click on a day covered by a longer window was refused. Now: that day goes to an
unsaved draft with a warning ("N days are inside a longer or partial-hour window…"); only on save is
that day cut out of the window, the rest kept, in one transaction. Production impact: existing
windows are never changed by the deploy itself; only an explicit save by their owner edits them.

## 5. Evidence (local, 2026-10-19)

`pnpm check` PASS (Vitest 346 + docs/i18n, Deno 63, lint, types, format) · `pnpm build` PASS ·
`git diff --check` PASS · RLS/PGlite suites incl. O (per-day replace + rotation privacy), P (aog_only
SQL = TS, 3 urgencies), Q (wallet) PASS · local E2E 27/27 · `scripts/local/db-race-check.sh all` 6/6
(incl. concurrent day edits) · browser checks: cycle generator 21/21, tools 35/35, AOG 6/6, wallet
15/15 at 1440/1024/768/390/360 px · two independent reviews (no Critical; High-1 fixed by order +
tolerant parser). Production: **not verified** (no authenticated E2E has ever run there).

## 6. Wave 2 (wallet) — not ready

Blockers: (1) **M-3** files of a deleted account stay in the bucket (needs a cleanup design, likely a
purge function with a documented service-role justification); (2) no scanner → sharing stays off by
design (D-10), which is fine for owner-only use. When approved: `db push` #6–#7 → `functions deploy
professional-documents --use-api` → enable the flag (§7). `STORAGE_PUBLIC_URL` must **not** be set
remotely (local Docker only).

## 7. Environment variables

| Variable                               | Service                           | Public/private | Purpose                                    | Environment                                                                                                                                                   |
| -------------------------------------- | --------------------------------- | -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Vercel                            | Public         | Supabase project URL                       | all                                                                                                                                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel                            | Public         | Client key (RLS applies)                   | all                                                                                                                                                           |
| `QUALIFICATION_REVIEW_ENABLED`         | Vercel (server) + Supabase secret | Private flag   | OD-3 gate                                  | **unset** in production                                                                                                                                       |
| `DOCUMENT_WALLET_ENABLED`              | Vercel (server)                   | Private flag   | Wallet gate (this batch)                   | **unset** in production — enabling it is an exception to the "two variables" rule that needs owner approval (alternative: remove the flag in code for wave 2) |
| `ALLOWED_ORIGINS`                      | Supabase secret                   | Private        | CORS allow-list                            | production: `https://crew-flex.vercel.app`                                                                                                                    |
| `STORAGE_PUBLIC_URL`                   | Supabase local `.env`             | Private        | Rewrites signed-URL origin in local Docker | local only, **never** remote                                                                                                                                  |

No secret value is written in this repository.

## 8. Rollback and its limits

- Frontend: Vercel redeploy of deployment `7126745962` (`ddf5c4b`).
- Functions: redeploy the previous code by name from `ddf5c4b` (same `--use-api` command).
- Database: migrations are additive and are **not** reverted (no DROP in production). Limits:
  (1) the `aog_only` enum value cannot be removed; (2) if `aog_only` windows exist and functions are
  rolled back to versions without the tolerant parser, HIGH-1 returns — so never roll the functions
  back below step 1's versions, or first convert those windows (a data change that needs its own
  approval); (3) rows written by the new RPCs (rotations, split windows) stay valid for old code.
