# ADR-003: Training («Formación», CrewFlex v1.9) inside the existing Next.js + Supabase monolith

- Status: **Accepted for LOCAL implementation** (2026-10-29). The owner asked for v1.9 parity and delegated technical
  decisions. Business, legal and privacy policies stay with the owner (NEEDS_DECISION list below). Nothing is deployed
  without a separate per-step authorisation.
- Relates to: ADR-001 (Edge Functions as backend boundary, RLS mandatory), ADR-002, D-06/R-08 (application state machine,
  versioned proposals), D-07/D-10 (Candidate Pack, wallet), OD-3 (verification), OD-7 (money), T-15 (assignment protection).
- Reference: `tmp/CrewFlex_v1.9.0.zip` (sha256 `e5847409…`), its `docs/V1.9.0.md`, `server/training.mjs`,
  `src/features/training/*`. Requirement matrix: `docs/integration/crewflex-v19/V19_MATRIX.md` (V19-001…041).

## Context

v1.9 adds a training marketplace: providers publish courses and editions (convocatorias) with sessions; professionals save,
ask, request a seat, accept terms and get confirmed; admins review providers, courses and editions. v1.9 runs it on a Node +
SQLite server with its own session model. We must migrate the capabilities, not the architecture: one database, one Auth,
one notification system, one user model.

## Decisions

1. **Provider = an existing organization.** No new account type or role. A `training_providers` row (1:1 with
   `organizations`) carries the provider profile and its review state. Organization `admin`/`manager` members manage it
   (`has_org_role`). Platform admins review it. An admin never reviews their own organization (S-16 pattern).
2. **Data model** (new tables, RLS in the same migration): `training_providers`, `training_courses`, `training_editions`
   (convocatorias), `training_sessions` (`tstzrange` per live session, IANA zone per edition), `training_favorites`,
   `training_requests` (`kind` inquiry | seat; one active request per edition × professional), `training_offers`
   (immutable, versioned terms snapshot, as R-08), `training_request_events` (append-only history) and `training_messages`.
   Review decisions are columns + `audit_events`. Money is `bigint` cents + `currency` (EUR, GBP, CHF, USD) + `price_unit`
   (person, engine, module, quote). No floating point and no payment.
3. **Writes only through SECURITY DEFINER RPCs** with in-body actor checks, an explicit transition table in
   `app_private` (mirrored by a pure TS table in `src/domain/training.ts`), optimistic version checks and idempotency keys
   (`app_private.idempotency_keys`). Tables have SELECT policies only; no direct INSERT/UPDATE/DELETE grants.
4. **Seats are transactional.** Confirming locks the edition row (`FOR UPDATE`), then counts confirmed seats in the same
   transaction. Two concurrent confirmations serialise on that lock, so the capacity can never be exceeded. A race test
   proves it (as `scripts/local/db-race-check.sh`).
5. **Overlaps are bidirectional and hour-based.** Confirming a seat refuses if a live session overlaps a confirmed
   employment assignment of the same professional. `transition_application` (confirm) refuses if the assignment period
   overlaps a confirmed training session. A training session never writes availability days: the calendar shows an «F»
   marker from a read-only RPC and does not block the whole day.
6. **API boundary:** one Edge Function `training` (user JWT, no service role). Zod schemas in
   `src/lib/validation/training.ts` are shared by the function and the Next.js server actions. Types are in `src/types/api.ts`.
   Lists are paginated on the server (catalog: 12 per page, as v1.9).
7. **Catalog requires a session** (deny-by-default, S-1). The v1.9 public catalog for anonymous visitors is a privacy and
   security exception for the owner (NEEDS_DECISION N-4).
8. **Notifications** reuse `public.notifications` with a new `notification_kind` value `training`, written by triggers on
   request events and review decisions.
9. **Activation gate:** the feature flag `training` (`app_private.feature_flags`, `public.is_feature_enabled`) hides the
   UI and refuses the RPCs when off. It is ON locally and OFF in production until the owner authorises a release.
10. **No automatic certification (V19-034):** no training transition writes qualifications, documents, badges,
    Candidate Pack, logbook, commissions or invoices. A DB test asserts it.
11. **Account closure and export:** closing an account is refused while the user has future confirmed seats. The private
    export includes the user's own training rows and the messages of their own requests. Retention beyond that is
    NEEDS_DECISION N-3.

## NEEDS_DECISION (owner) — safe defaults implemented

| Id  | Question                                                         | Default in code                                                        |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| N-1 | Who may verify training providers, with which evidence           | Platform admins only, behind the `training` flag (off in prod)         |
| N-2 | Commercial approval criteria for providers, courses and editions | Admin records a free-text reason; no automatic approval                |
| N-3 | Retention of requests and messages after closure or cancellation | Same as the account closure today (cascade); no extra retention        |
| N-4 | Public catalog without a session                                 | Session required                                                       |
| N-5 | Sharing the student's e-mail with a provider                     | Never shared; the provider sees the display name and the note          |
| N-6 | Platform admins reading private request conversations            | Admins read requests for support, but **not** messages                 |
| N-7 | Legal text for Part-147 / direct-approval scope declarations     | Provider declaration + reference, labelled «declaración del proveedor» |
| N-8 | Taxes, cancellation terms and price display as commitments       | Shown as the provider's own text, «informativo»; nothing charged       |
| N-9 | Staffing agencies (D-12) acting as training providers            | Allowed for any organization type, subject to review                   |

## Consequences

- No second source of truth. The new tables hang off `organizations` and `profiles`; `auth.uid()` is the only identity.
- Two existing functions change, both by `create or replace` with the same signature and new regression tests:
  `transition_application` (training overlap check on confirm) and the account closure guard.
- Out of scope (V19-041): integrated payments, LMS, block seat booking, external calendar sync.
