# ADR-002: Keep the modular monolith; make domain boundaries explicit and harden incrementally

- Status: **Proposed** (2026-10-15) — needs owner acceptance. Until accepted, ADR-001 remains the rule and
  nothing here changes it.
- Deciders: Crew Flex engineering (proposal), owner (acceptance)
- Relates to: ADR-001 (Edge Functions as backend boundary), `memory-bank/02-architecture-map.md`

## Context

Verified against the code on 2026-10-15 (`a7fd5a7` + uncommitted work on `fix/remediation-2026-10-15`):

- One repository, one Next.js 16 app (Vercel), nine Supabase Edge Functions (Deno), one Postgres
  database with RLS on every table, ten migrations. Five functions and two migrations are in
  production; the rest are verified locally only.
- Business rules are pure TypeScript in `src/domain` (no I/O; only `zod` and sibling imports) and are
  imported by both runtimes. One engine each for qualification validity, availability coverage,
  eligibility/score, capacity and completeness.
- Correctness that must hold under concurrency or direct API access lives in Postgres: deferred
  constraint trigger (BR-1.4), atomic RPCs (passport), idempotency keys in the same transaction,
  row-locked review, column grants, DEFINER functions with in-body checks.
- Every Next.js write goes Server Action → `invokeEdgeFunction` → function → Postgres with the user's
  JWT. Direct PostgREST reads from the Next server exist for own context, the catalog and — as an
  exception — the internal workforce list (`src/features/workforce/api.ts`, under RLS/OD-4).
- Size: ~16 pages, ~9 functions, ~250 automated tests; one developer plus agents; one real user in
  production; no customer data yet.

## Problem

The product must grow into documents, consents, Candidate Pack, applications, confirmations,
assignments, organization verification, recruiter, tools and notifications (V1.3 parity, see
`docs/integration/crewflex-v13/`). Agents will do much of that work. The risks that actually showed up
so far were **not** caused by the architecture style but by:

1. Rules enforced in only one layer (E-3: BR-1.4 checked in the function but not in the DB).
2. Multi-step writes outside a transaction (I-3 passport; I-1 duplicate creates).
3. A SQL prefilter that could disagree with the TS engine (candidate pool cap).
4. Stale documentation leading to wrong environment assumptions.

The question: is a different architecture needed to grow safely, or are boundaries and rules enough?

## Alternatives

| Option | Description                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| A      | Modular monolith: Next + Edge Functions + Supabase, organised by domain (what we have)                                           |
| B      | A with strict Clean/Hexagonal layers (ports, adapters, use-case classes, repositories)                                           |
| C      | Backend fully in Next.js (Route Handlers/Server Actions talk to Postgres directly)                                               |
| D      | Separate services per domain (own deploy, own data)                                                                              |
| E      | Event-driven core (outbox, queue, asynchronous handlers)                                                                         |
| F      | A, reinforced incrementally: explicit domain boundaries, DB invariants for every cross-layer rule, parity tests, lint boundaries |

## Criteria and comparison

| Criterion                        | A                                                           | B                                    | C                                                                                                           | D                                | E                                | F                                             |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------- | --------------------------------------------- |
| Complexity / cost                | low                                                         | medium–high (indirection everywhere) | low                                                                                                         | high (infra, ops, contracts)     | high                             | low                                           |
| Security (RLS, user-context)     | strong                                                      | same                                 | weaker: tempts service-role or pooled connections in Node; loses the "function acts with user JWT" boundary | strong but many surfaces         | adds async auth context problems | strongest (adds DB invariants + review rules) |
| Transactional coherence          | Postgres transactions + RPCs                                | same                                 | same                                                                                                        | **lost** across services (sagas) | eventual by design               | same as A, made explicit                      |
| Single rule engine (Node + Deno) | yes                                                         | yes                                  | yes (one runtime)                                                                                           | duplication pressure             | handlers duplicate reads         | yes + parity tests                            |
| Multi-tenant privacy             | RLS + DEFINER                                               | same                                 | RLS only if every query uses the user client                                                                | per-service                      | per-handler                      | same as A                                     |
| Testing                          | PGlite + Docker + Deno                                      | more mocks                           | simpler (one runtime)                                                                                       | contract tests needed            | harder                           | as A                                          |
| Latency                          | +1 hop (Next → function)                                    | same                                 | lowest                                                                                                      | highest                          | async                            | as A                                          |
| Vendor lock-in                   | Supabase (Postgres portable; functions are plain Deno/HTTP) | same                                 | Vercel + Supabase                                                                                           | none specific                    | queue vendor                     | as A                                          |
| Agent productivity               | good: small, predictable files                              | worse: more files per change         | good                                                                                                        | poor: cross-repo context         | poor                             | **best**: rules + boundaries written down     |
| Future mobile/integrations       | yes (functions are an API)                                  | yes                                  | no (backend tied to the web app)                                                                            | yes                              | yes                              | yes                                           |

Notes:

- **C** would remove one hop and one runtime, which is a real gain, but ADR-001's reasons stand: a
  second client (mobile, partner API, recruiter tooling) would have to duplicate the backend, and the
  "every function acts with the caller's JWT" rule is the cheapest strong guarantee we have.
- **D/E** solve scaling and team-autonomy problems we do not have (one team, one database, no load) and
  would break the transactional invariants that fixed E-3/I-1/I-3.
- **B** adds ceremony without addressing any defect we actually found; the useful part of it (pure
  domain, no I/O) is already true of `src/domain`.

## Decision

**F — keep the modular monolith of ADR-001 and reinforce it incrementally.** Concretely:

1. **Domains are the unit of code organisation**, each spanning the same four places:
   `src/domain/<d>.ts` (pure rules) · `src/lib/validation/<d>.ts` (contracts) ·
   `supabase/functions/<d-operation>/` + migrations (persistence/authorization) ·
   `src/features/<d>/` (server data access, actions, UI).
2. **Postgres owns invariants that must survive direct API access or concurrency** (constraint
   triggers, RPC transactions, idempotency, column grants). TS owns explanation and scoring. A rule
   enforced in both places is tested in both (PGlite + unit), and SQL prefilters have parity tests
   against the TS engine.
3. **Writes always go through an Edge Function** acting with the user's JWT. Direct PostgREST reads from
   the Next server are allowed for own context and reference data; reads of _other users'_ data move
   behind a function when that domain gains writes (first: workforce, with member management).
4. **Privileged flows** are DEFINER functions with in-body checks, fail closed behind an owner-only DB
   flag when they depend on an open product decision, and are audited.
5. **No new runtime, service, queue or framework** without a new ADR that names the concrete problem.

### Domain boundaries

| Domain            | Owns (tables/RPCs)                                                                                                                 | Reads                                       | Rules / invariants                          | DTOs (`src/types/api.ts`)                   | Events (audit)                          | Sensitive data                       | Permission                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------- | --------------------------------------- | ------------------------------------ | ------------------------------------- |
| Identity          | `profiles` (via `handle_new_user`), Supabase Auth                                                                                  | —                                           | S-2, S-4; `platform_role` never self-set    | session actor (Next)                        | —                                       | e-mail (Auth only)                   | own                                   |
| Organizations     | `organizations`, `organization_members`                                                                                            | profiles                                    | BR-9, one org per user in UI                | `requireOrganizationContext`                | —                                       | membership                           | member/manager/admin                  |
| Professionals     | `technician_profiles`, `update_professional_profile`                                                                               | qualifications, availability (completeness) | BR-11; atomic save; optimistic lock         | `ProfessionalProfileResponse`               | — (PLAN: audit profile writes)          | base, experience, status, visibility | own                                   |
| Qualifications    | `technician_qualifications`, `qualification_types`, `declare_qualification`                                                        | catalog                                     | BR-2.x, S-5                                 | `Qualification`, `QualificationResponse`    | `qualification.created/updated/removed` | expiry, verification                 | own (write), org manager (read, OD-4) |
| Verification      | `review_qualification`, `own_qualification_reviews`, `app_private.feature_flags`                                                   | qualifications                              | BR-2.6, S-6, S-12; version check            | `ReviewQueueItem`, `ReviewDecisionResponse` | `qualification.reviewed`, `.verified`   | review note                          | platform admin (gated by OD-3)        |
| Availability      | `availability_windows`, `create_availability_window`                                                                               | —                                           | BR-4.x                                      | `AvailabilityWindow`                        | — (PLAN)                                | schedule                             | own                                   |
| Work Requirements | `work_requirements`, `work_requirement_qualifications`, `create_work_requirement_idempotent`, `enforce_requirement_qualifications` | catalog                                     | BR-1.x (BR-1.4 at commit)                   | `WorkRequirementResponse`                   | `requirement.created`                   | —                                    | manager/admin                         |
| Capacity          | — (computes)                                                                                                                       | requirement, internal pool                  | BR-6, same engine as matching               | `CapacityResponse`                          | —                                       | members' quals                       | manager/admin                         |
| Matching          | `get_requirement_candidate_pool`, `ranked_external_pool`, pool summary                                                             | requirement, pools                          | BR-3/5/7/8; pseudonyms; parity              | `MatchingResponse`, `ExternalPoolCoverage`  | —                                       | external candidates (minimised)      | manager/admin                         |
| Documents         | PLAN: private bucket + `documents` table, signed URLs ≤ 60 s                                                                       | —                                           | D-07, D-10, T6, T12                         | PLAN                                        | PLAN `document.*`                       | licences, IDs                        | own; others only via consent          |
| Applications      | PLAN: applications, consents, Candidate Pack, confirmations                                                                        | requirement, matching result                | D-06, D-07; re-check eligibility on confirm | PLAN                                        | PLAN                                    | identity unlock                      | professional + org                    |
| Assignments       | PLAN: day coverage, `covered` transition                                                                                           | applications                                | D-08, BR-1.9                                | PLAN                                        | PLAN                                    | —                                    | manager/admin                         |
| Recruiter         | PLAN: org type `staffing_agency` + represented clients                                                                             | organizations                               | D-12                                        | PLAN                                        | PLAN                                    | client names                         | agency roles                          |
| Tools             | PLAN: pure converters/calculators (no persistence needed first)                                                                    | —                                           | D-11                                        | PLAN                                        | —                                       | —                                    | any user                              |
| Billing           | OUT (OD-7)                                                                                                                         | —                                           | —                                           | —                                           | —                                       | payment data (never stored by us)    | —                                     |

PLAN rows describe where a future domain would live; none of those tables or functions exist.

## Consequences

- ➕ No rewrite; every existing test, migration and deploy procedure stays valid.
- ➕ Each future block (documents, applications, assignments, recruiter) is a new domain column in
  the four places above; none requires changing the core flow.
- ➕ Agents get one rule for "where does this go" and a STOP list for what needs a human.
- ➖ The extra Next → function hop remains (latency, cold starts). Accepted; measure before optimising.
- ➖ Two runtimes remain; shared code must stay dependency-light with explicit `.ts` imports.
- ➖ Supabase lock-in for Auth/Storage/Functions. Postgres schema and pure domain are portable.
- ➖ Generated DB types lag local-only migrations (`pnpm db:types` targets production). Regenerate from
  the local stack (`scripts/local/sb-local.sh gen types typescript --local --schema public`) when the
  schema changes locally.

## Constraints and risks

| Risk                                                | Mitigation                                                    |
| --------------------------------------------------- | ------------------------------------------------------------- |
| Rule implemented in one layer only (E-3 class)      | Decision 2; security reviewer checklist (`memory-bank/04`)    |
| Prefilter ≠ engine (pool class)                     | Parity tests mandatory (rls section M)                        |
| DEFINER function trusted like RLS                   | S-10 checklist + "other org / other user" tests               |
| Direct reads of other users' data spreading in Next | Decision 3; only `workforce` today                            |
| Main-only production (OD-9)                         | Gates + explicit authorization; re-open OD-9 before real orgs |
| No import-boundary lint                             | Evolution step 1                                              |

## Evolution strategy (in order, each small and independently useful)

1. Add an ESLint `no-restricted-imports` rule: `src/domain/**` may not import `@/` aliases, React, Next or Supabase.
2. Move `listWorkforce` behind the planned `organization-workforce` function when member management lands.
3. Audit profile and availability writes (`*.updated`) when consents/documents arrive (needed for D-07).
4. Documents: private bucket + table + signed-URL function, owner-only first (D-10), then consented sharing (D-07).
5. Applications/consents/Candidate Pack as one domain with its own state machine (D-06), eligibility re-check at confirmation using `evaluateMatch`.

## Reconsider this decision when

- A second client (mobile app, partner API) needs operations the functions do not expose → still A/F, but review function granularity.
- p95 latency of a user-facing page is dominated by the Next → function hop after cold-start mitigation.
- Asynchronous work appears (notifications, document scanning, outreach) → introduce an outbox table +
  scheduled function (still inside the monolith) before any queue service.
- More than one team works on independent domains with conflicting release cadences.
- Data residency or a customer contract requires physically separated data.
