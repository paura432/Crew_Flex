# Environments — MAIN-ONLY (single production environment)

Status (2026-10-10, Phase 0.7): **Crew Flex has one environment.** `main` → Vercel Production → Supabase
`sbjkzrkmcekokkqiuvvh`. There is no staging project, no Supabase branch, no staging Git branch and no
staging Vercel domain, by decision of the owner (OD-9, resolved temporarily). The staging design that
previously lived in this file is kept in Git history (`4400efd` on `feat/crewflex-parity-migration`,
`47d0db4` on `main`) and is **not** an active procedure.

## 1. Topology

```
GitHub paura432/Crew_Flex · main ──▶ Vercel Production https://crew-flex.vercel.app
                                        └──▶ Supabase PRODUCTION sbjkzrkmcekokkqiuvvh (eu-central-1)
```

| Concern            | Value                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git                | `main` is the only permanent branch; short-lived local branches are optional, `main` is pushed directly                                          |
| Vercel             | Production = `main` (auto-deploy on push). No Preview/branch domain is part of the procedure                                                     |
| Supabase           | `sbjkzrkmcekokkqiuvvh` (`Crew_Flex`), linked locally (`supabase/.temp/project-ref`)                                                              |
| Schema             | `supabase/migrations/*` applied with `supabase db push` (linked) after local review                                                              |
| Edge Functions     | `supabase functions deploy <name> --project-ref sbjkzrkmcekokkqiuvvh --use-api`                                                                  |
| Function secrets   | `ALLOWED_ORIGINS=https://crew-flex.vercel.app` (set 2026-10-09); nothing else is custom                                                          |
| Vercel env vars    | Production scope: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` of that project                                             |
| Auth               | e-mail confirmation ON; E2E accounts are auto-confirmed individually (Admin API), never globally                                                 |
| Data               | real users **and** clearly synthetic E2E accounts (`e2e…@` / `…+e2e…@`), cleaned after each campaign                                             |
| Local `.env.local` | points to the **local** Docker stack (`127.0.0.1:56321`) since 2026-10-11; remote values live in `.env.remote.backup` (never `.env.production*`) |

The code is environment-agnostic: the app reads only the two `NEXT_PUBLIC_*` values (`src/lib/env.ts`);
functions read platform-provided variables plus `ALLOWED_ORIGINS`.

### Auth e-mail links (password recovery, 2026-10-19)

`requestPasswordResetAction` sends `redirectTo = <origin>/auth/confirm?next=/reset-password`. Supabase only
honours it when the URL is allow-listed: locally `supabase/config.toml` `additional_redirect_urls` includes
`http://localhost:3001/**`; **production needs the glob `https://crew-flex.vercel.app/auth/confirm**` added to Auth → URL
Configuration → Redirect URLs** (owner action, Auth setting) before the recovery flow is published — otherwise
the link falls back to the Site URL and the reset page reports «needs a valid reset link». An exact entry does not
match: the link carries `?next=/reset-password` and GoTrue matches entries as globs against the full URL (a bare
hostname match applies only when the Site URL host is already the Vercel host — read it first).

## 2. Risk assumed and compensating controls

Every push to `main` is a production deploy and every remote test runs on real infrastructure. Accepted
on 2026-10-10 because the product has a single real account and no customer data yet. Compensations:

| Control                                                                                                                                                 | Where                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Quality gate before every push: `pnpm check`, `pnpm build`, `git diff --check`; Husky pre-commit (lint-staged, typecheck, tests)                        | `package.json`, `.husky/pre-commit`                                        |
| Migrations: non-destructive only, reviewed, `db push --dry-run` first, never `reset`/`DROP`/`TRUNCATE` remotely                                         | `AGENTS.md`, `README.md`                                                   |
| Functions: deploy one at a time, smallest first, verify with probes between steps; rollback = `functions delete` or redeploy of the previous commit     | `docs/audit/DEPLOYMENT_PLAN.md`                                            |
| RLS on every table (26 policies remotely; 29 locally with the unapplied migrations) + JWT verified in code; the service role is never read by functions | migrations, `supabase/functions/_shared`, `repo-hygiene` test              |
| Remote E2E writes need **two** conditions: authorized ref == URL ref == linked ref, and a per-run confirmation typed on the command line                | `tests/e2e/guard.ts`, `scripts/e2e/_guard.sh`, `e2e-production-guard` test |
| Synthetic data only, obviously named, scoped cleanup script; global Auth settings untouched; no notifications, no mass matching                         | `scripts/e2e/seed-users.sh`, `scripts/e2e/cleanup-synthetic.sh`            |
| Every remote mutation is logged in `docs/audit/DEPLOYMENT_PLAN.md` with date, command and result                                                        | execution logs §8–§9                                                       |

Re-evaluate OD-9 (a separate staging project) before the first real organization onboards or before
any migration that rewrites existing rows.

## 3. Remote E2E on the single project (authorized runs only)

Production uses its own git-ignored file, `.env.e2e.production` (mode 600; production URL, publishable key,
`E2E_AUTHORIZED_PROJECT_REF`, the 3 synthetic accounts with generated passwords). `.env.e2e` stays on the
local Docker stack (`pnpm e2e:remote`). Both guards refuse a stored `E2E_WRITE_CONFIRM` in **any**
`.env.e2e*` file. Each of the three write steps below needs its own owner approval.

```bash
cp .env.e2e.example .env.e2e.production   # then fill it (never E2E_WRITE_CONFIRM, never a secret key)
set -a; . ./.env.e2e.production; set +a
# 1. create the accounts once (secret key from `supabase projects api-keys --project-ref <ref> --reveal`, shell only)
SUPABASE_SECRET_KEY='<sb_secret_…>' E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) \
  bash scripts/e2e/seed-users.sh
# 2. run the ten checks (writes one window, deletes it; leaves one requirement in the synthetic org)
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) pnpm e2e:production
# 3. remove the synthetic accounts and their rows when the campaign is over
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) bash scripts/e2e/cleanup-synthetic.sh --dry-run
E2E_WRITE_CONFIRM=WRITE:sbjkzrkmcekokkqiuvvh:$(date -u +%F) bash scripts/e2e/cleanup-synthetic.sh
```

Without `E2E_AUTHORIZED_PROJECT_REF` matching the URL and the linked project, or without the per-run
`E2E_WRITE_CONFIRM`, the suite throws before signing in and the scripts exit with code 2. A skipped suite is
never reported as PASS.

## 4. Guard-rails

- `supabase link` stays on `sbjkzrkmcekokkqiuvvh`; deploy commands still name `--project-ref` explicitly.
- Nothing destructive remotely: no `db reset`, `DROP`, `TRUNCATE`, mass `DELETE`, unjustified `migration repair`.
- Secrets never touch the repo: `sb_secret_…`, DB passwords and tokens live only in the operator's shell.
- Any future second environment is a new decision (OD-9), not an implicit side effect of a script.
