# 04 · Target architecture for the V1.3 functionality

> Phase 0.8 (2026-10-15). Extends `docs/architecture/ARCHITECTURE.md`; it does not replace it.
> Nothing here is implemented unless `02-parity-matrix.md` says so.

## Invariants (unchanged)

```
Browser → Next.js (Server Components, server actions) → Supabase Edge Functions (Deno, caller JWT)
        → PostgreSQL + RLS (column grants, SECURITY DEFINER only for narrow, audited read paths)
```

- One domain engine in `src/domain` (pure TS, `.ts` imports), imported by Next and by Edge Functions.
  Capacity and matching both call `evaluateMatch` (`src/domain/capacity.ts`).
- Identity from the JWT `sub` only. Strict Zod schemas reject identity/verification fields.
- The database is the last line: every business rule that protects integrity has a DB backstop
  (constraint, trigger, grant or RLS); the Edge Function adds field-level messages.
- No browser-authoritative data, no second database, no service role in user flows, no LLM in
  eligibility.

## What V1.3 contributes, and where it lands

| V1.3 asset                                                                                  | Lands as                                                                                       | Notes                                                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `business.js` rules (rating restrictions, min years, country, transitions, `projectedPack`) | New pure functions in `src/domain/*` + tests, **only after the matching decision** (D-02…D-07) | Never copy the 75/25 score                                                    |
| `server/rules.mjs` shift model (`validateJob`, `selectShifts`)                              | `src/domain/shifts.ts` (pure) when requirements get shifts (D-08)                              | Keep UTC instants; timezone only for "one shift per local date"               |
| Confirmation re-check list (`app.mjs` confirm)                                              | SECURITY INVOKER RPC `confirm_assignment` with row locks                                       | Block 3                                                                       |
| `tools/engine.js` + `tests/tools.test.mjs`                                                  | `src/tools/*.ts` pure modules + ported tests; routes under `/app/tools`                        | No Supabase calls; favourites in `localStorage` (per-viewer convenience only) |
| `tools/knowledge.js`                                                                        | Static data module after editorial review                                                      | Labelled "orientative, not controlled documentation"                          |
| Modal (`Shared.jsx`: portal, focus trap, Escape, inert, restore)                            | `src/components/ui/Dialog.tsx` when first needed (native `<dialog>`)                           | Behaviour, not code                                                           |
| Month calendar + paint states                                                               | Already in Next (`AvailabilityManager.tsx`)                                                    | Add AOG-only state after D-05                                                 |
| PackViewer, coverage tiles, logistics strip, comparison table                               | Block 3 / C-9 UIs                                                                              | Visual reference only                                                         |

## Professional block (phase 0.8, local)

| Concern            | Component                                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passport read/edit | `/app/professional/profile` → server action → EF `professional-profile` (GET/PATCH) → `profiles`, `technician_profiles`                                                                                                   |
| Qualifications     | `/app/professional/qualifications` → EF `professional-qualifications` (GET/POST/PATCH/DELETE) → `technician_qualifications` (verification protected by grants + RLS + trigger; BR-2.7, type immutability now DB-enforced) |
| Availability       | `/app/professional/availability` → EF `professional-availability` → `availability_windows` (366-day max DB-enforced)                                                                                                      |
| Matching           | EF `capacity-evaluate`, `matching-evaluate` → RPC `get_requirement_candidate_pool` (DEFINER, manager-only, pseudonymous) → `evaluateMatch`                                                                                |
| Audit              | DEFINER triggers: `requirement.created`, `qualification.created/updated/removed/verified`                                                                                                                                 |

## Verification (blocked by OD-3)

> **Superseded 2026-10-15 (remediation):** implemented **locally**, fail-closed, as EF `qualification-reviews`,
> `/app/admin/verifications` and RPC `review_qualification(id, decision, expected_updated_at, note, request_id)`
> with columns `reviewed_by`, `reviewed_at`, `review_note` (≤ 500) and the owner-only flag
> `app_private.feature_flags('qualification_review')` (`20261015130400`). The names below are the original
> target design; do not create `qualification-verifications` or `verified_by`. Production activation still
> needs OD-3.

Target design as written in phase 0.8 (who verifies is undecided):

```
platform_admin → /app/admin/verifications (Server Component, platform_role check)
  → EF qualification-verifications (GET queue / POST decision {id, decision, note})
    → RPC review_qualification(p_id, p_decision, p_note)  -- SECURITY DEFINER
        • requires is_platform_admin() (from profiles.platform_role, never from the request)
        • sets verification_status ∈ {verified, rejected}, verified_by, verified_at, note
        • writes qualification.verified / qualification.rejected (existing trigger + new one)
```

No column grant on `verification_status` is ever given to `authenticated`; the RPC is the only
path. Evidence review requires documents (block 2) for anything beyond attestation.

## Documents (block 2, planned)

```
Storage bucket `qualification-evidence` (private, no public URLs)
  path: <technician_profile_id>/<document_id>
documents table: id, owner, qualification_id?, kind, mime, size, sha256, expires_on,
                 scan_status (quarantine|clean|infected|error), review_status, created_at
```

- Upload: EF issues a **signed upload URL** for `<uid>/<new id>` after validating size (≤ 5 MB),
  declared MIME in an allow-list (PDF/PNG/JPEG); Storage RLS restricts object paths to the owner.
- Quarantine: new objects are unreadable to anyone but the owner until `scan_status = clean`.
  Scanning needs a real scanner service (not available; `server/scanner.mjs` proves nothing).
  Until a scanner exists, **no third party can read a document** — this is the safe default.
- Read by an organization: only through an EF that checks pack consent + application status
  (R-09) and returns a **short-lived signed URL** (e.g. 60 s), auditing `document.accessed`.
- Matchable data (qualification rows) and shareable evidence (documents) stay separate: matching
  never reads documents; documents never change eligibility except through a verifier decision.

## Contracting (block 3, planned — not started, needs explicit authorisation)

> Superseded sketch (2026-10-20): consents are **not** columns on `applications`; the model is
> `application_consents` + `candidate_pack_items` in `CANDIDATE_PACK.md` §2, and the audit name is
> `pack.document_url_issued`, not `document.accessed`. The transition contract is `APPLICATIONS_STATE_MACHINE.md`.

```
applications(id, requirement_id, technician_profile_id, status, consent_pack_at,
             consent_contact_at, pack_snapshot jsonb, created_at, …)
application_events(id, application_id, from_status, to_status, actor, reason, created_at)
assignments(application_id, starts_at, ends_at)   -- confirmed only, feed capacity/availability
```

- Transitions in a pure `src/domain/applications.ts` (`transitionError` semantics from V1.3,
  server state names, R-08) + RPC per transition (SECURITY INVOKER, RLS by participant role).
- `confirm_assignment`: `select … for update` on the requirement, re-run `evaluateMatch` on
  current data, check no overlapping assignment for the technician, per-shift seat count, consent.
- Idempotency: unique active application per (requirement, technician) + `Idempotency-Key`.
- Candidate Pack: snapshot at application time (`buildPack` semantics); projection per viewer
  (`projectedPack` semantics, tested).

## Recruiter (inventory only)

An agency organization (`staffing_agency`) acts **on behalf of** a represented client. Required
before any implementation: `represented_clients` (owned by the agency), requirements with
`on_behalf_of_client_id`, consent scoped to agency **and** client, no inheritance of the client
organization's member rights. Billing out of V1.

## AOG (inventory only)

Separate concepts, none derived from the others: (1) operational urgency declared by the
requester with a reason; (2) commercial band (only if OD-7 needs one); (3) technician opt-in
(`aog_only` availability windows, quiet hours); (4) contact channel (OUT in V1); (5) labour
restrictions (out of scope; never claim legal rest evaluation).
