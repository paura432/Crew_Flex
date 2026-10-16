# Crew Flex

Crew Flex turns qualifications, availability and operational demand into **mobilisable technical
capacity**. First vertical: aviation / aircraft maintenance workforce.

An organization defines a requirement (e.g. _2 × B1.1, A320 family, EWIS + HF + FTS, Madrid, night,
18–21 Oct_). Crew Flex evaluates its internal workforce, shows the **capacity gap**, and lists the
external professionals who **really** meet the requirements — explaining why each one is or is not
eligible. Matching is deterministic; no LLM decides eligibility.

Status: **Foundation + Prototype V0** — see [`docs/product/V1_SCOPE.md`](docs/product/V1_SCOPE.md).

## Architecture

```
Browser → Next.js (App Router, server-side) → Supabase Edge Functions (Deno) → PostgreSQL + RLS
                     ├─ Supabase Auth (cookies via @supabase/ssr)
                     └─ direct reads under RLS: own context, catalog, internal workforce (no direct writes)
```

Details: [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md),
[`ADR-001`](docs/architecture/ADR-001-foundation.md), [`ADR-002`](docs/architecture/ADR-002-modular-domain-architecture.md).
Agents and new engineers: start with [`AGENTS.md`](AGENTS.md) and [`memory-bank/`](memory-bank/README.md).

## Requirements

- Node.js ≥ 24, pnpm 10 (`corepack enable`)
- Deno 2 (Edge Function lint/check/tests)
- Docker (local Supabase stack — the standard way to verify migrations, functions and E2E;
  `docs/qa/LOCAL_ENVIRONMENT.md`). The Supabase CLI is a dev dependency
  (`pnpm exec supabase`).

## Install

```bash
git clone <repo> crew-flex && cd crew-flex
pnpm install          # also installs Husky hooks (prepare)
```

## Environment

```bash
cp .env.example .env.local
```

| Variable                               | Kind   | Notes                               |
| -------------------------------------- | ------ | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | public | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | `sb_publishable_…` — not privileged |

There are **no server secrets** in the Next.js app. Backend secrets are Supabase Edge Function
secrets (`pnpm exec supabase secrets set NAME=value`). Never put a service role or `sb_secret_` key
in any `.env*` file used by the frontend.

## Supabase

| Item                         | Location                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| Migrations (source of truth) | `supabase/migrations/`                                                   |
| Local synthetic seed         | `supabase/seed.sql` (password for all seed users: `crewflex-local-only`) |
| Edge Functions               | `supabase/functions/`                                                    |
| Config                       | `supabase/config.toml`                                                   |

```bash
# Local stack (needs Docker; ports 563xx, see docs/qa/LOCAL_ENVIRONMENT.md)
pnpm exec supabase start -x logflare,vector,supavisor,imgproxy,realtime
bash scripts/local/sb-local.sh db reset   # local-only wrapper: applies migrations + seed, refuses remote targets
pnpm exec supabase functions serve --env-file supabase/functions/.env

# Remote project (needs an account with access to the project)
pnpm exec supabase login
pnpm exec supabase link --project-ref sbjkzrkmcekokkqiuvvh
pnpm exec supabase db push           # non-destructive migrations only, after review
pnpm exec supabase functions deploy <name> --project-ref sbjkzrkmcekokkqiuvvh --use-api   # one at a time
pnpm db:types                        # generate src/types/database.generated.ts
```

## Run

```bash
pnpm dev     # http://localhost:3000
```

Seed users (local stack only, password `crewflex-local-only`): 3 organization admins, a manager, 4 internal
technicians and 14 external professionals covering every eligibility outcome. Full table and the local
procedure: [`docs/qa/LOCAL_ENVIRONMENT.md`](docs/qa/LOCAL_ENVIRONMENT.md).

## Tests

```bash
pnpm test          # Vitest watch
pnpm test:run      # domain, validation, RLS (PGlite), repo hygiene
pnpm test:edge     # Deno tests for Edge Functions
pnpm e2e:remote    # remote E2E on the single project; needs .env.e2e + E2E_WRITE_CONFIRM per run (ENVIRONMENTS.md §3)
```

## Quality gates

```bash
pnpm check         # lint, typecheck, test:run, format:check, lint:edge, typecheck:edge, test:edge
pnpm build
```

Pre-commit runs lint-staged + typecheck + unit tests. See
[`docs/qa/QUALITY_GATES.md`](docs/qa/QUALITY_GATES.md).

## Edge Functions

`health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`, `professional-availability`,
`professional-profile`, `professional-qualifications`, `user-preferences`, `qualification-reviews` (which of them are
deployed: [`memory-bank/01-current-state.md`](memory-bank/01-current-state.md)). Contract, errors and auth
flow: [`docs/architecture/EDGE_FUNCTIONS.md`](docs/architecture/EDGE_FUNCTIONS.md).

## Git workflow (main-only, temporary — OD-9)

`main` is the only permanent branch and deploys automatically to Vercel Production, which uses the single
Supabase project. Before every push: `pnpm check`, `pnpm build`, `git diff --check`. No force-push, no
history rewrite. Details and the risk statement: [`docs/architecture/ENVIRONMENTS.md`](docs/architecture/ENVIRONMENTS.md).

## Migrations

Every structural change is a new file in `supabase/migrations/`. Process: migration → local
verification (`pnpm test:run` RLS suite, then `bash scripts/local/sb-local.sh migration up` on the Docker stack) → review → remote
apply. No `DROP`, `TRUNCATE` or remote resets.

## Project structure

```
src/app/            routes (thin)
src/features/       auth, requirements, capacity, matching, workforce, qualifications, professional,
                    availability, preferences, reviews
src/domain/         pure business logic (shared with Edge Functions)
src/lib/            env, Supabase clients, Zod validation, formatting
src/server/         server-only: session actor, Edge Function invoker
src/components/     ui primitives + layout
supabase/           config, migrations, seed, functions
tests/              PGlite RLS tests, env-gated E2E, i18n, security guards, memory-bank checks
fixtures/           synthetic typed fixtures
docs/               product, architecture, QA, audit, V1.3 integration
memory-bank/        dated operational context (read after AGENTS.md)
```

## Security principles

Security > domain correctness > data integrity > product clarity > maintainability > UI polish >
feature count. RLS on every table from the first migration; Edge Functions act as the user;
identity only from the verified JWT; matchable data ≠ shareable data; private by default. See
[`docs/product/SECURITY_PRIVACY.md`](docs/product/SECURITY_PRIVACY.md) and [`AGENTS.md`](AGENTS.md).
