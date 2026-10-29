# Architecture

## Overview

```
Browser
 │  cookies (Supabase session, httpOnly-capable via @supabase/ssr)
 ▼
Next.js (App Router, Server Components by default)
 │  proxy.ts: refresh session, redirect unauthenticated /app/**, CSP nonce, 404 for platform-only pages (X-11)
 │  server-only: invokeEdgeFunction(name, {method, body, query}) with user access token
 │  direct PostgREST reads under RLS: own context + reference data; exception: internal workforce
 │  (src/features/workforce/api.ts, other members' data under can_view_member / OD-4) — ADR-002 §Decision 3
 ▼
Supabase Edge Functions (Deno)                       Supabase Auth (email/password, JWT)
 │                                                    Edge Function Secrets (runtime only)
 ├─ CORS allowlist                                    Storage private buckets (PLANNED)
 ├─ authenticate (auth.getClaims) → actor
 ├─ authorize (org role from DB)
 ├─ validate (Zod, strict, size-limited)
 ├─ business rules (src/domain — shared pure TS)
 ├─ audit (DB triggers)
 ▼
PostgreSQL
 └─ RLS on every table (defense in depth) + SECURITY DEFINER helpers with explicit checks
```

## Trust boundaries

| Boundary                       | Trusted?                       | Rule                                                                            |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------- |
| Browser → Next.js              | Untrusted input                | Zod validation in server actions; Server Components by default.                 |
| Next.js server → Edge Function | Untrusted input (re-validated) | User access token forwarded; no privileged key.                                 |
| Edge Function → Postgres       | User context                   | Supabase client created with the caller's `Authorization` header → RLS applies. |
| Definer functions              | Privileged                     | Explicit `auth.uid()` + role checks, `search_path = ''`, minimal output.        |
| Edge Function Secrets          | Server-only                    | Never logged, never returned.                                                   |

## Where code lives

```
src/
  app/                  routes only (thin): layout, pages, loading/error states
  components/ui/        design-system primitives
  components/layout/    app shell, navigation
  features/<domain>/    api.ts (server data access), actions.ts (server actions), components/
  domain/               PURE business logic — no I/O, no framework. Shared with Edge Functions.
  lib/supabase/         server + proxy clients (no browser data client)
  lib/validation/       Zod schemas shared by forms, server actions and Edge Functions
  lib/env.ts            public env parsing
  server/               server-only helpers (session/actor, edge invoke)
  i18n/                 next-intl config, locale resolution (catalogs in /messages)
  types/                API contracts (api.ts) + generated database types
supabase/
  migrations/           versioned SQL (source of truth)
  seed.sql              synthetic local data
  functions/_shared/    http envelope, cors, auth, errors, logging, supabase client, candidate pool
  functions/<name>/     one function per domain operation
tests/
  db/                   PGlite migration + RLS tests
  e2e/                  env-gated E2E (local Docker stack, or guarded remote)
  i18n/                 catalog parity
  security/             repo hygiene + local/remote guards
  docs/                 memory-bank integrity
scripts/local/          local-only wrapper, race checks, browser smoke, cleanup
memory-bank/            dated operational context for agents (see memory-bank/README.md)
fixtures/               typed synthetic fixtures for tests
```

## Shared domain code

`src/domain/**` and `src/lib/validation/**` are imported by Next.js **and** by Edge Functions
(relative imports with explicit `.ts` extensions; `zod` resolved via `supabase/functions/deno.json`).
There is one matching algorithm and one capacity algorithm.

## Rendering

`cacheComponents` is **disabled** in V0: all `/app/**` routes depend on the session and are dynamic.
Revisit when public/marketing pages grow (ADR-001 consequences).

## Environment status (verified 2026-10-15)

| Capability                   | Status                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local Next.js dev/build      | Works                                                                                                                                                                                                        |
| Local Supabase stack         | Works: Docker Desktop via WSL, ports 563xx, only through `scripts/local/sb-local.sh` (`docs/qa/LOCAL_ENVIRONMENT.md`)                                                                                        |
| Migration + RLS verification | PGlite in Vitest (every run) **and** the local Docker database (incremental `migration up`, race checks)                                                                                                     |
| Edge Functions verification  | `deno check` / `deno test` + `supabase functions serve` locally + local E2E                                                                                                                                  |
| Remote project               | Linked; 5 functions deployed 2026-10-09, 2 migrations applied. Any further apply/deploy needs **explicit owner authorization** (OD-9). Management API returned 403 for the current CLI account on 2026-10-15 |

Current deployed-vs-local state: `memory-bank/01-current-state.md`. (Until 2026-10-11 this table said Docker
was unavailable and the remote project had no credentials; both are historical.)
