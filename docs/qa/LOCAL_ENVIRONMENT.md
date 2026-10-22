# Local environment — Supabase in Docker + synthetic data (2026-10-10)

Fully functional local stack: Postgres 17 with all migrations in `supabase/migrations/` (ten on 2026-10-15) and
the deterministic seed, Auth, PostgREST, Studio, Mailpit and every Edge Function (nine on 2026-10-15), all on **127.0.0.1**. Nothing here touches the
remote project `sbjkzrkmcekokkqiuvvh`; the remote rules in `docs/architecture/ENVIRONMENTS.md` still apply.

## 1. Prerequisites (verified on WSL2 Ubuntu 24.04)

| Item         | State                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker       | Docker Desktop for Windows with the WSL integration for this distro (`docker version` works inside WSL, `/var/run/docker.sock` present). Docker Desktop must be running; start it from WSL with `powershell.exe -NoProfile -Command "Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"` (the `docker` shim appears ~15 s later; the Crew Flex containers auto-start with the volume intact). |
| Supabase CLI | `pnpm exec supabase` 2.120.0 (dev dependency)                                                                                                                                                                                                                                                                                                                                                                           |
| Ports        | Crew Flex uses **56321** (API/Kong), **56322** (Postgres), **56323** (Studio), **56324** (Mailpit), **56327** (analytics), **56320/56329** (shadow DB / pooler), inspector 8086. Chosen in `supabase/config.toml` because other local projects on this machine hold 54321–54327 and 55321–55324.                                                                                                                        |
| Next.js      | `pnpm dev` → port 3000 if free (free on 2026-10-11; on 2026-10-10 a Windows process held it and Next picked **3001**). The app only reads `.env.local`.                                                                                                                                                                                                                                                                 |

## 2. Bring-up

```bash
pnpm exec supabase start -x logflare,vector,supavisor,imgproxy,realtime   # first run pulls images; applies migrations + seed.sql
pnpm exec supabase status -o env                                            # API_URL=http://127.0.0.1:56321, DB_URL=…@127.0.0.1:56322
cp .env.local .env.remote.backup      # keep the remote values aside (git-ignored). NEVER name it .env.production*
printf 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from status>\n' > .env.local
cp -n supabase/functions/.env.example supabase/functions/.env               # ALLOWED_ORIGINS=localhost origins (local only)
pnpm exec supabase functions serve --env-file supabase/functions/.env       # every function at http://127.0.0.1:56321/functions/v1/<name>
pnpm dev                                                                    # http://localhost:3000 (or 3001)
```

Re-seed from scratch (destroys only the local Docker database, asks for confirmation):

```bash
bash scripts/local/sb-local.sh db reset
```

`supabase stop` stops the containers and keeps the volume; `supabase stop --no-backup` would discard it.

## 3. Safety rules for local database work

- Every CLI call against the database goes through `scripts/local/sb-local.sh`, which refuses `--linked`,
  `--project-ref`, `--project-id`, any non-local `--db-url`, and the subcommands that can reach a remote
  project (`link`, `projects`, `secrets`, `functions deploy`, `db push`, `migration repair`, `branches`); `migration up` is allowed only with the
  forced `--local` (applies pending migrations without a reset).
  Before running it checks `supabase status` and requires API and DB URLs on 127.0.0.1/localhost.
  Guard behaviour is covered by `tests/security/local-guard.test.ts`.
- The repo stays linked to production for the remote procedures; that is why bare `supabase db …` commands
  are not used for local work.
- `.env.local`, `.env.remote.backup`, `.env.e2e` and `supabase/functions/.env` are git-ignored.
- **Pitfall found on 2026-10-10:** Next.js loads `.env.production.local` (and `.env.production`) for
  `next build` / `next start`, with priority over `.env.local`. A remote backup under that name made two
  production-mode smoke runs sign in against the remote Auth endpoint with a synthetic e-mail (rejected,
  no write). The backup is now `.env.remote.backup` and `scripts/local/ui-smoke.mjs` refuses to run when
  `.env.production*` or `.env` exists or `.env.local` is not local.

## 4. Synthetic accounts (local only; password for all: `crewflex-local-only`)

Deterministic UUIDs `00000000-0000-4000-8000-0000000000NN`. Names are NATO alphabet, e-mails on
`crewflex.test`. Nobody real.

| NN  | E-mail                       | Role / organization                                       | Visibility  | Purpose                                                            |
| --- | ---------------------------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| 01  | admin.mro@crewflex.test      | admin · Demo MRO Madrid (MRO, ES)                         | —           | Product example organization                                       |
| 02  | admin.other@crewflex.test    | admin · Demo Aero Services Lisbon (MRO, PT)               | —           | Cross-organization isolation                                       |
| 03  | admin.airline@crewflex.test  | admin · Demo Airline Ops Barcelona (airline, ES)          | —           | AOG need, no internal workforce                                    |
| 11  | alpha@crewflex.test          | member · Demo MRO Madrid                                  | private     | Internal, fully qualified → eligible                               |
| 12  | bravo@crewflex.test          | member · Demo MRO Madrid                                  | private     | Internal, FTS expired 2026-09-30 → blocked                         |
| 13  | charlie@crewflex.test        | member · Demo MRO Madrid                                  | private     | Plain member, no ratings; cannot see capacity                      |
| 14  | manager.mro@crewflex.test    | manager · Demo MRO Madrid                                 | private     | Manager role: can create needs and see capacity                    |
| 21  | delta@crewflex.test          | external                                                  | anonymous   | Eligible, pseudonymous ref                                         |
| 22  | echo@crewflex.test           | external                                                  | open        | Eligible, name shown; SMS pending (soft)                           |
| 23  | foxtrot@crewflex.test        | external                                                  | anonymous   | Eligible, SMS verified (soft score 100)                            |
| 24  | golf@crewflex.test           | external                                                  | anonymous   | B1.1 **pending** → not verified                                    |
| 25  | hotel@crewflex.test          | external                                                  | **private** | Never appears in any pool                                          |
| 26  | india@crewflex.test          | external                                                  | anonymous   | Available only until 20 Oct → partial availability                 |
| 27  | juliett@crewflex.test        | external                                                  | open        | TR-B737 instead of TR-A320 → missing for MAD; eligible for BCN AOG |
| 41  | kilo@crewflex.test           | external                                                  | anonymous   | Available all October but **unavailable 19–21 Oct** → partial      |
| 42  | lima@crewflex.test           | member · Demo Aero Services Lisbon                        | private     | Internal B2 + TR-A330 → LIS need fully covered (gap 0)             |
| 43  | mike@crewflex.test           | external                                                  | anonymous   | B2 **expires 2026-11-04**, during the LIS need                     |
| 44  | november@crewflex.test       | external                                                  | open        | B2 + TR-A350 → missing TR-A330                                     |
| 45  | oscar@crewflex.test          | external                                                  | anonymous   | B1.1 **rejected**                                                  |
| 46  | papa@crewflex.test           | external                                                  | anonymous   | B1.1 **withdrawn** → treated as not held                           |
| 47  | quebec@crewflex.test         | external                                                  | open        | B1.1 + TR-B737, **no availability windows** → not available        |
| 31  | platform.admin@crewflex.test | platform_admin · admin · CrewFlex Operaciones (other, ES) | private     | Platform role (never from metadata)                                |

Work requirements: `B1.1 · A320 line maintenance reinforcement` (MAD, 18–22 Oct night, 2 ×, hard B1.1 +
TR-A320 + EWIS + HF + FTS, soft SMS → required 2, internally eligible 1, gap 1, external eligible 3 of 10),
`B2 · A330 avionics check support` (LIS, 2–6 Nov, 1 × → gap 0), `B1.1 · B737 AOG recovery` (BCN, 25–26 Oct,
AOG, 1 × → gap 1, Juliett eligible, Quebec not available), `CAT-A · line support (cancelled)` (status demo).

Row counts after `db reset`: 22 users/profiles, 19 technician profiles, 4 organizations, 9 memberships,
17 qualification types, 74 technician qualifications, 17 availability windows, 4 requirements,
12 requirement qualifications, 4 audit events.

## 5. Verification executed on 2026-10-10 (local only)

| Check                                                                                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm e2e:remote` against `http://127.0.0.1:56321` (`.env.e2e` with seed accounts; the production guard accepts local hosts) | **13 passed**: health, sign-in, 401, create/edit/delete window, persistence in a fresh session, isolation between professionals (function + PostgREST), 403 for professionals, authorized creation, capacity, deterministic matching, cross-organization 404                                                                                                                                                                                                                                                                                                                                                   |
| Browser flows (headless Chromium, scripted)                                                                                  | 19/20: login/logout, profile, availability create → edit → reload → delete, external professional kept out of the organization area, requirements list scoped to the org, capacity with gap, matching 3 eligible of 10 with explained blockers and pseudonymous refs, requirement creation, other-org admin → 404, plain member without capacity, manager with capacity, browser talked only to localhost. The one failure is the console check: Next dev mode logs `Performance.measure … negative time stamp` from its dev overlay and the expected 404 resource on the cross-org page; no application error |
| Evidence                                                                                                                     | `docs/audit/evidence/local-01…09-*.jpg`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Remote project                                                                                                               | untouched: no `--linked` write, no deploy, no push, no secret or Vercel change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 6. Re-verification on 2026-10-11 (local only, existing database kept)

- Docker Desktop was stopped at session start; after starting it the `crew-flex` containers came back
  with the previous volume, so **no `db reset` was run**: the database already held the seed (22 synthetic
  users, 74 qualifications, 17 windows, 4 seeded requirements) plus the requirements left by the 2026-10-10
  checks. Both migrations applied (`20261009120000`, `20261009120100`), Postgres 17.11, 10 tables with RLS,
  26 policies. `db reset` stays available when a clean slate is wanted (`bash scripts/local/sb-local.sh db reset`).
- Results: E2E 13/13 (`node --env-file=.env.e2e node_modules/vitest/vitest.mjs run tests/e2e`, same command
  as `pnpm e2e:remote`; the alias keeps its name because the same suite runs against production under the
  two-condition guard), browser smoke 19/20 on `http://localhost:3000` (the one failure is the console check
  picking up the intended 404 on the cross-organization page), `pnpm check` (lint, typecheck, 114 unit/RLS
  tests, Prettier, deno lint/check, 22 Deno tests), `pnpm build`, `git diff --check`. Screenshots
  `docs/audit/evidence/local-01…09-*.jpg` refreshed.
- Each run of the E2E suite leaves one `E2E <timestamp>` requirement and the smoke one
  `Local UI check · B2 A330` in the synthetic organizations (V0 has no delete path). Remove them with
  `bash scripts/local/cleanup-test-rows.sh` (`--dry-run` lists; goes through `sb-local.sh`, local only;
  everything else in the seed is untouched). Passport/qualification tests restore the seed values themselves.
- `next build`/`next typegen` terminate a running `pnpm dev` (exit 143): run the gates first, then start dev.
- Remote project untouched: no `--linked`, no deploy, no push, no secret or Vercel change.

## 7. Phase 1 — passport and qualifications (2026-10-11, local only)

- Seven functions served locally (`professional-profile`, `professional-qualifications` added);
  `supabase/config.toml` carries their `verify_jwt = false` blocks. Not deployed. Phase 1.5 adds
  `user-preferences` (eight functions) and migration `20261011120000_preferred_locale`, applied locally with
  `bash scripts/local/sb-local.sh migration up` (now allowed, forced `--local`; no reset, data kept) and types
  regenerated with `bash scripts/local/sb-local.sh gen types typescript --local --schema public`.
- Verification: `pnpm check` (lint, typecheck, Vitest incl. RLS F-block, Prettier, Deno lint/check,
  32 Deno tests), `pnpm build`, local E2E 17/17, browser smoke with the passport and qualification
  flows at 1440/768/390 (`docs/audit/evidence/local-10…13-*.jpg`). Full report:
  `docs/audit/PHASE1_PROFILE_QUALIFICATIONS.md`.
- Seed accounts exercised: `delta` (external, anonymous; edits passport, declares B2/TR-A350, withdraws
  FTS → MAD eligible 3 → 2 → restored), `echo` (professional B, isolation), `admin.mro` (matching),
  `alpha` (organization admin reads but cannot edit a member's qualification).

## 8. Phase 1.5/1.6 — ES/EN and functional review (2026-10-11, local only)

- Language: `/app/settings` for every account; seed accounts start with no preference (`preferred_locale`
  NULL → browser language, headless Chromium = English). Tests restore the preference they change; after an
  interrupted smoke run, reset with
  `docker exec -i supabase_db_crew-flex psql -U postgres -d postgres -c "update public.profiles set preferred_locale = null"`.
- Browser smoke: 59 checks (English + Spanish flows 6/7, Spanish screenshots `local-14…21-*.jpg`). Chromium
  builds under `~/.cache/ms-playwright` change between sessions (other projects install/remove revisions):
  pick an existing one with `ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome`.
- Verification run: `pnpm check` (Vitest 150 incl. i18n/RLS G/resolve, Deno 36), `pnpm build`, local E2E 19/19,
  smoke, `git diff --check`. Report: `docs/audit/FULL_FUNCTIONAL_REVIEW.md`, `docs/audit/I18N_COVERAGE.md`.

## 9. Remediation run (2026-10-15) — what changed and how to reproduce

- **Docker from WSL works again** (`/var/run/docker.sock` present). Symptom seen: the CLI got
  `DbConnectError … read ECONNRESET` on 127.0.0.1:56322 while the port was open and the container healthy
  (the Docker Desktop port proxy was stale; the DB never saw the connection). Fix: `docker restart
supabase_db_crew-flex` (volume kept), wait for `supabase status`, retry. No reset, no volume removal.
- Migrations `20261015120000` … `20261015130400` were applied **incrementally** to the local DB with
  `bash scripts/local/sb-local.sh migration up` (no reset). Fresh creation is covered by the PGlite suite
  (`tests/db`, all migrations + seed from scratch).
- The seed now inserts each requirement and its qualifications in **one statement** (BR-1.4 is checked at
  commit since `20261015130000`).
- Local review flow needs three switches: `QUALIFICATION_REVIEW_ENABLED=true` in `.env.local` (Next.js
  server flag: navigation entry, `/app/admin/verifications`, review action — 404/refused otherwise),
  the same variable in `supabase/functions/.env` (template updated) and, once per local database, `docker exec supabase_db_crew-flex psql -U postgres -c
"insert into app_private.feature_flags (name, enabled) values ('qualification_review', true)"`. Never set
  either remotely before OD-3 is approved. (`alter database … set` of a custom parameter is not allowed for
  the Supabase `postgres` role, hence the table.)
- Concurrency checks that need two real sessions: `bash scripts/local/db-race-check.sh` (E-3 ×2, I-1, review;
  local container only, restores the seed).
- E2E: `pnpm e2e:remote` with `.env.e2e` pointing at `http://127.0.0.1:56321` runs `remote-smoke` (19) and the
  local-only `local-remediation` suite (6; skipped for any non-local URL). Both suites run in parallel:
  never use the same synthetic professional for writes in both (`remote-smoke` edits Delta).
- Browser smoke: prefer a **production build** (`pnpm build && pnpm exec next start -p 3002`, `BASE=http://localhost:3002`).
  In `next dev`, React's dev-only performance tracks intermittently log `Failed to execute 'measure' on
'Performance' … negative time stamp` on unrelated pages, which fails check 17; the production build has none.
- Stop a background `next start` with `pkill -f "[n]ext start -p 3002"` (the bracket keeps `pkill` from
  matching its own command line).
