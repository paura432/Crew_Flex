# ADR-001: Use Supabase Edge Functions as application backend boundary

- Status: Accepted (2026-10-09)
- Deciders: Crew Flex engineering

## Context

Crew Flex handles sensitive professional data (licences, availability, employment status) and its
core value is a set of business rules (eligibility, capacity) that must be consistent, auditable and
never duplicated between client and server. We use Supabase (Postgres + Auth + Storage). Supabase
lets the browser query Postgres directly under RLS, or route operations through Edge Functions.

## Decision

1. **Application operations** (writes, multi-step operations, matching, capacity, anything needing
   secrets or external APIs) go through **Supabase Edge Functions**, one function per domain
   operation.
2. Edge Functions act **in the user's context** (caller JWT → RLS). Service role is not a default.
3. **RLS remains mandatory** on every table as defense in depth.
4. Simple reads of the caller's own context and reference data (own memberships, own profile,
   qualification catalog) may use PostgREST directly from the Next.js server under RLS.
5. Pure business logic lives in `src/domain` and is shared by Next.js and Deno.
6. Next.js calls Edge Functions from the **server** (Server Components / Server Actions), forwarding
   the user's access token. The browser does not hold a direct dependency on functions in V0.
7. `cacheComponents` disabled for V0 (all app routes are session-dependent).

## Consequences

- ➕ Centralized validation, authorization, business rules, audit and secret access.
- ➕ Consistent response contract and error normalization.
- ➕ A single matching/capacity implementation, testable without Supabase.
- ➖ **Every call through an Edge Function adds latency and attack surface** compared with direct
  RLS access (extra hop, cold starts, CORS, another runtime to secure and monitor).
- ➖ Two runtimes (Node for Next.js, Deno for functions) → shared code must be dependency-light and
  use explicit `.ts` import extensions.
- ➖ Without Docker, local function serving requires the remote project; V0 verifies functions with
  `deno check` / `deno test`.

## Alternatives considered

| Alternative                                            | Why not (now)                                                                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Direct browser → PostgREST for everything              | Business rules would leak to the client or be duplicated in SQL; secrets impossible.                                     |
| Next.js Route Handlers / Server Actions as the backend | Ties backend to the web app's hosting; future mobile/integrations would duplicate it.                                    |
| Separate Node API service                              | More infrastructure (YAGNI).                                                                                             |
| Everything in SQL (RPC)                                | Matching explanation logic is clearer and more testable in TS. We still use SQL for atomic writes and data minimization. |
