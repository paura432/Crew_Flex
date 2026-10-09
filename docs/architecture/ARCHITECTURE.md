# Architecture

## Overview

```
Browser
 │  cookies (Supabase session, httpOnly-capable via @supabase/ssr)
 ▼
Next.js (App Router, Server Components by default)
 │  proxy.ts: refresh session, redirect unauthenticated /app/**
 │  server-only: invokeEdgeFunction(name, {method, body, query}) with user access token
 │  direct PostgREST reads under RLS only for own context + reference data
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
  lib/supabase/         browser / server / proxy clients (separate files)
  lib/validation/       Zod schemas shared by forms, server actions and Edge Functions
  lib/env.ts            public env parsing
  server/               server-only helpers (session/actor, edge invoke)
  types/                database row types
supabase/
  migrations/           versioned SQL (source of truth)
  seed.sql              synthetic local data
  functions/_shared/    http envelope, cors, auth, errors, logging, supabase client, candidate pool
  functions/<name>/     one function per domain operation
tests/
  db/                   PGlite migration + RLS tests
  security/             repo hygiene tests
fixtures/               typed synthetic fixtures for tests
```

## Shared domain code

`src/domain/**` and `src/lib/validation/**` are imported by Next.js **and** by Edge Functions
(relative imports with explicit `.ts` extensions; `zod` resolved via `supabase/functions/deno.json`).
There is one matching algorithm and one capacity algorithm.

## Rendering

`cacheComponents` is **disabled** in V0: all `/app/**` routes depend on the session and are dynamic.
Revisit when public/marketing pages grow (ADR-001 consequences).

## Environment status

| Capability                              | Status                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Local Next.js dev/build                 | Works                                                                     |
| Local Supabase stack (`supabase start`) | Requires Docker — not available on the bootstrap machine                  |
| Migration + RLS verification            | PGlite (Postgres 17 WASM) in Vitest with `auth` stubs                     |
| Edge Functions verification             | `deno check` + `deno test`                                                |
| Remote project link/apply/deploy        | BLOCKED: no credentials for `sbjkzrkmcekokkqiuvvh` on this machine (OD-2) |
