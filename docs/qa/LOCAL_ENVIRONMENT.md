# Local environment — Supabase in Docker + synthetic data (2026-10-10)

Fully functional local stack: Postgres 17 with the two migrations and the deterministic seed, Auth,
PostgREST, Studio, Mailpit and the five Edge Functions, all on **127.0.0.1**. Nothing here touches the
remote project `sbjkzrkmcekokkqiuvvh`; the remote rules in `docs/architecture/ENVIRONMENTS.md` still apply.

## 1. Prerequisites (verified on WSL2 Ubuntu 24.04)

| Item         | State                                                                                                                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker       | Docker Desktop for Windows with the WSL integration for this distro (`docker version` works inside WSL, `/var/run/docker.sock` present). Docker Desktop must be running; it was started from WSL with `cmd.exe /c start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"`.                 |
| Supabase CLI | `pnpm exec supabase` 2.120.0 (dev dependency)                                                                                                                                                                                                                                                    |
| Ports        | Crew Flex uses **56321** (API/Kong), **56322** (Postgres), **56323** (Studio), **56324** (Mailpit), **56327** (analytics), **56320/56329** (shadow DB / pooler), inspector 8086. Chosen in `supabase/config.toml` because other local projects on this machine hold 54321–54327 and 55321–55324. |
| Next.js      | `pnpm dev` → port 3000 if free; on this machine a Windows process holds 3000, so Next picks **3001**. The app only reads `.env.local`.                                                                                                                                                           |

## 2. Bring-up

```bash
pnpm exec supabase start -x logflare,vector,supavisor,imgproxy,realtime   # first run pulls images; applies migrations + seed.sql
pnpm exec supabase status -o env                                            # API_URL=http://127.0.0.1:56321, DB_URL=…@127.0.0.1:56322
cp .env.local .env.production.local   # keep the remote values aside (both files are git-ignored)
printf 'NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<PUBLISHABLE_KEY from status>\n' > .env.local
cp -n supabase/functions/.env.example supabase/functions/.env               # ALLOWED_ORIGINS=localhost origins (local only)
pnpm exec supabase functions serve --env-file supabase/functions/.env       # the five functions at http://127.0.0.1:56321/functions/v1/<name>
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
  project (`link`, `projects`, `secrets`, `functions deploy`, `db push`, `migration up/repair`, `branches`).
  Before running it checks `supabase status` and requires API and DB URLs on 127.0.0.1/localhost.
  Guard behaviour is covered by `tests/security/local-guard.test.ts`.
- The repo stays linked to production for the remote procedures; that is why bare `supabase db …` commands
  are not used for local work.
- `.env.local`, `.env.production.local`, `.env.e2e` and `supabase/functions/.env` are git-ignored.

## 4. Synthetic accounts (local only; password for all: `crewflex-local-only`)

Deterministic UUIDs `00000000-0000-4000-8000-0000000000NN`. Names are NATO alphabet, e-mails on
`crewflex.test`. Nobody real.

| NN  | E-mail                       | Role / organization                              | Visibility  | Purpose                                                            |
| --- | ---------------------------- | ------------------------------------------------ | ----------- | ------------------------------------------------------------------ |
| 01  | admin.mro@crewflex.test      | admin · Demo MRO Madrid (MRO, ES)                | —           | Product example organization                                       |
| 02  | admin.other@crewflex.test    | admin · Demo Aero Services Lisbon (MRO, PT)      | —           | Cross-organization isolation                                       |
| 03  | admin.airline@crewflex.test  | admin · Demo Airline Ops Barcelona (airline, ES) | —           | AOG need, no internal workforce                                    |
| 11  | alpha@crewflex.test          | member · Demo MRO Madrid                         | private     | Internal, fully qualified → eligible                               |
| 12  | bravo@crewflex.test          | member · Demo MRO Madrid                         | private     | Internal, FTS expired 2026-09-30 → blocked                         |
| 13  | charlie@crewflex.test        | member · Demo MRO Madrid                         | private     | Plain member, no ratings; cannot see capacity                      |
| 14  | manager.mro@crewflex.test    | manager · Demo MRO Madrid                        | private     | Manager role: can create needs and see capacity                    |
| 21  | delta@crewflex.test          | external                                         | anonymous   | Eligible, pseudonymous ref                                         |
| 22  | echo@crewflex.test           | external                                         | open        | Eligible, name shown; SMS pending (soft)                           |
| 23  | foxtrot@crewflex.test        | external                                         | anonymous   | Eligible, SMS verified (soft score 100)                            |
| 24  | golf@crewflex.test           | external                                         | anonymous   | B1.1 **pending** → not verified                                    |
| 25  | hotel@crewflex.test          | external                                         | **private** | Never appears in any pool                                          |
| 26  | india@crewflex.test          | external                                         | anonymous   | Available only until 20 Oct → partial availability                 |
| 27  | juliett@crewflex.test        | external                                         | open        | TR-B737 instead of TR-A320 → missing for MAD; eligible for BCN AOG |
| 41  | kilo@crewflex.test           | external                                         | anonymous   | Available all October but **unavailable 19–21 Oct** → partial      |
| 42  | lima@crewflex.test           | member · Demo Aero Services Lisbon               | private     | Internal B2 + TR-A330 → LIS need fully covered (gap 0)             |
| 43  | mike@crewflex.test           | external                                         | anonymous   | B2 **expires 2026-11-04**, during the LIS need                     |
| 44  | november@crewflex.test       | external                                         | open        | B2 + TR-A350 → missing TR-A330                                     |
| 45  | oscar@crewflex.test          | external                                         | anonymous   | B1.1 **rejected**                                                  |
| 46  | papa@crewflex.test           | external                                         | anonymous   | B1.1 **withdrawn** → treated as not held                           |
| 47  | quebec@crewflex.test         | external                                         | open        | B1.1 + TR-B737, **no availability windows** → not available        |
| 31  | platform.admin@crewflex.test | platform_admin                                   | private     | Platform role (never from metadata)                                |

Work requirements: `B1.1 · A320 line maintenance reinforcement` (MAD, 18–22 Oct night, 2 ×, hard B1.1 +
TR-A320 + EWIS + HF + FTS, soft SMS → required 2, internally eligible 1, gap 1, external eligible 3 of 10),
`B2 · A330 avionics check support` (LIS, 2–6 Nov, 1 × → gap 0), `B1.1 · B737 AOG recovery` (BCN, 25–26 Oct,
AOG, 1 × → gap 1, Juliett eligible, Quebec not available), `CAT-A · line support (cancelled)` (status demo).

Row counts after `db reset`: 22 users/profiles, 19 technician profiles, 3 organizations, 8 memberships,
17 qualification types, 74 technician qualifications, 17 availability windows, 4 requirements,
12 requirement qualifications, 4 audit events.

## 5. Verification executed on 2026-10-10 (local only)

| Check                                                                                                                        | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm e2e:remote` against `http://127.0.0.1:56321` (`.env.e2e` with seed accounts; the production guard accepts local hosts) | **13 passed**: health, sign-in, 401, create/edit/delete window, persistence in a fresh session, isolation between professionals (function + PostgREST), 403 for professionals, authorized creation, capacity, deterministic matching, cross-organization 404                                                                                                                                                                                                                                                                                                                                                   |
| Browser flows (headless Chromium, scripted)                                                                                  | 19/20: login/logout, profile, availability create → edit → reload → delete, external professional kept out of the organization area, requirements list scoped to the org, capacity with gap, matching 3 eligible of 10 with explained blockers and pseudonymous refs, requirement creation, other-org admin → 404, plain member without capacity, manager with capacity, browser talked only to localhost. The one failure is the console check: Next dev mode logs `Performance.measure … negative time stamp` from its dev overlay and the expected 404 resource on the cross-org page; no application error |
| Evidence                                                                                                                     | `docs/audit/evidence/local-01…09-*.jpg`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Remote project                                                                                                               | untouched: no `--linked` write, no deploy, no push, no secret or Vercel change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
