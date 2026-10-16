# 05 · Data model gaps

> Phase 0.8 (2026-10-15). Schema reference: `docs/product/DATA_MODEL.md` and
> `supabase/migrations/`. **No new column was added in this phase**: every field below is a
> proposal with the information the brief requires (need, type, constraints, visibility, use in
> matching, permissions, persistence). Fields that change matching need decisions in `08`.

## Implemented this phase — `20261015120000_integrity_hardening.sql` (local only)

Non-destructive; no column, no data change.

| Change                                                                 | Why                                                                                          | Compatibility                                                                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `revoke update (qualification_type_id)` on `technician_qualifications` | BR-2.8 type immutability was EF-only                                                         | No app path updates the type (EF PATCH schema has no type)                                                                  |
| `revoke insert` on `technician_profiles`                               | Only `handle_new_user` (DEFINER) creates them; an organization account could self-insert one | No app path inserts it                                                                                                      |
| Trigger `enforce_qualification_expiry` (BEFORE INSERT/UPDATE)          | BR-2.7 was EF-only                                                                           | Seed and existing tests pass; one RLS test fixture gained an `expires_at`                                                   |
| `CHECK (ends_at <= starts_at + 366 days)` on `availability_windows`    | BR-4.6 was Zod-only                                                                          | Fails the migration if a longer window already exists (remote had no business rows on 2026-10-10; re-check before applying) |
| Trigger `audit_qualification_change`                                   | DATA_MODEL reserved `qualification.created/updated`; adds `qualification.removed`            | Seed inserts now produce `qualification.created` with `actor_profile_id = null`                                             |

**Deploy note:** must be applied remotely together with (or before) any code that relies on it;
the Edge Functions already map `23514` to `VALIDATION_ERROR` and never forward the DB message.

## P — Professional passport

| #   | Field                 | Need (V1.3 source)                                          | Type / constraints                                                                                    | Visibility                                                                     | Matching                                                           | Permissions                                   | Persistence                   |
| --- | --------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------- | ----------------------------- |
| P1  | `work_countries`      | Work-permit gate (demo `workCountries`, server `countries`) | `text[]` of ISO-3166 alpha-2, ≤ 30, unique                                                            | Owner; org managers of the requirement's pool see only "meets / does not meet" | Hard when requirement has `country` (R-05)                         | Owner via EF; self-declared, never "verified" | `technician_profiles` column  |
| P2  | `english_level`       | Soft "Inglés técnico ≥ B2"                                  | enum A1…C2, nullable                                                                                  | Same as other passport fields                                                  | Soft only if adopted (C-10)                                        | Owner                                         | Column                        |
| P3  | Blocked organizations | `blockEmployer` / `blocked[]`                               | Table `technician_blocked_organizations(technician_profile_id, organization_id, created_at)`, PK both | **Owner only** (the blocked org must not learn it)                             | Excluded inside `get_requirement_candidate_pool` before any output | Owner insert/delete (RLS `= auth.uid()`)      | Table, cascade on either side |
| P4  | `mobilization_hours`  | AOG/Urgente hard limit                                      | `smallint` 0–168, nullable                                                                            | Owner + pool output                                                            | Hard only with AOG design (R-07)                                   | Owner                                         | Column                        |
| P5  | Normalised base       | Location matching                                           | `base_code` FK to an airports/bases catalog                                                           | Pool output (already returns `base_location`)                                  | Informational until C-10                                           | Owner                                         | Column + catalog              |

Not proposed: phone/e-mail in the passport (identity unlock belongs to block 3 consent), rates
(OD-7), shift pattern (client-side generator producing windows, R-07/C-8).

## Q — Qualifications

| #   | Field                                                | Need                                         | Type / constraints                                                                          | Visibility                                                | Matching                                                    | Permissions                              | Persistence |
| --- | ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- | ----------- |
| Q1  | `restrictions`                                       | V1.3 demo: restricted rating is not eligible | `text` ≤ 500, nullable; editing resets verification (extend `reset_verification_on_change`) | Owner, verifier, pool output as boolean `restricted` only | Hard blocker `HARD_QUALIFICATION_RESTRICTED` when non-empty | Owner writes; verifier may confirm       | Column      |
| Q2  | `licence_category_type_id` on type ratings           | Rating valid for a category (demo)           | FK to a `LICENSE` type, nullable                                                            | Same as row                                               | Hard pairing if requirement asks for category + rating      | Owner declares, verifier confirms        | Column      |
| Q3  | `verified_by`, `verified_at`, `review_note`          | Traceable verification                       | uuid FK profiles, timestamptz, text ≤ 1000                                                  | Owner sees status + note; verifier all                    | None (status already drives matching)                       | **Only** the verification RPC (no grant) | Columns     |
| Q4  | Catalog growth: B1.2, B1.4, B3, engines, more skills | V1.3 lists                                   | Rows in `qualification_types` (migration, `on conflict do nothing`)                         | Public catalog                                            | As any type                                                 | Migration only                           | Rows        |
| Q5  | `evidence_document_id`                               | Link to wallet                               | FK `documents`, nullable                                                                    | Owner; org only via pack rules                            | None                                                        | Owner                                    | Block 2     |

## R — Work requirements

| #   | Field                       | Need                                             | Type / constraints                                                                                             | Visibility  | Matching                                                                  | Permissions   | Persistence              |
| --- | --------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------- | ------------- | ------------------------ |
| R1  | `min_years_experience`      | Hard gate in both V1.3 engines                   | `smallint` 0–60, nullable                                                                                      | Org members | Hard blocker `INSUFFICIENT_EXPERIENCE` (self-declared value — explain it) | admin/manager | Column                   |
| R2  | `country`                   | Base/country coherence, work permit              | `char(2)` ISO alpha-2                                                                                          | Org members | With P1                                                                   | admin/manager | Column                   |
| R3  | Any-of qualification groups | "A320 **or** A321 rating"                        | `work_requirement_qualifications.group_key smallint` — satisfied if any row in the group is met                | Org members | Engine change in `evaluateMatch`                                          | admin/manager | Column                   |
| R4  | Shifts                      | Non-contiguous days, ≤ 24 h shifts (server V1.3) | Table `work_requirement_shifts(id, requirement_id, starts_at, ends_at, hours)`; one per local date; no overlap | Org members | Availability per shift; partial staffing later                            | admin/manager | Table                    |
| R5  | Economics / logistics       | Fee summary, flights, hotel                      | —                                                                                                              | —           | None                                                                      | —             | Not proposed (OD-7, C-9) |

## M — Matching data path

| #   | Gap                                                                        | Proposal                                                                                  |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| M1  | External pool capped at 100 **before** eligibility, ordered by uuid (R-11) | Prefilter on "holds every hard type with `status = active`", then cap; return `truncated` |
| M2  | Blocked organizations not applied                                          | `not exists (…technician_blocked_organizations…)` in the external branch (needs P3)       |
| M3  | Requirement status ignored by evaluators                                   | EFs refuse `cancelled`/`closed` requirements with `CONFLICT`                              |

## I — Integrity

| #   | Gap                                                                                                     | Proposal                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | No idempotency: a retried POST after a timeout duplicates a requirement or availability window          | `Idempotency-Key` header (uuid) stored in `idempotency_keys(actor, key, response, created_at)` with 24 h TTL; EF replays the stored response |
| I2  | BR-1.4 (≥ 1 hard qualification) bypassable by direct insert/delete on `work_requirement_qualifications` | Revoke direct insert/delete; add RPCs for edits; constraint trigger `deferrable initially deferred` checking ≥ 1 hard per requirement        |
| I3  | `professional-profile` PATCH performs two non-atomic updates                                            | One SECURITY INVOKER RPC `update_professional_profile(...)`                                                                                  |
| I4  | Profile/availability writes not audited                                                                 | Only when a reader needs them (privacy: avoid audit as a location history)                                                                   |
