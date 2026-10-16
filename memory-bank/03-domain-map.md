# 03 · Domain map

Canonical: `docs/product/BUSINESS_RULES.md` (rule text, BR ids), `docs/product/DATA_MODEL.md`,
`supabase/migrations/*.sql`, `src/domain/**`. This file only maps **where** things are and **which
invariant protects what**. Never copy rule text here — link the BR id.

## Entities (implemented, 10 public tables + `app_private`)

```
auth.users 1─1 profiles ─┬─1 technician_profiles 1─* technician_qualifications *─1 qualification_types
                          │                       1─* availability_windows
                          └─* organization_members *─1 organizations 1─* work_requirements 1─* work_requirement_qualifications *─1 qualification_types
audit_events (append-only, written by triggers / DEFINER RPCs)
app_private.idempotency_keys · app_private.feature_flags   (not exposed by PostgREST)
```

| Practical aggregate   | Root                        | Members                           | Invariants (BR id → enforcement)                                                                                                                                    |
| --------------------- | --------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Professional passport | `technician_profiles`       | `profiles.display_name`           | BR-11 (pure); atomic save via `update_professional_profile` (I-3)                                                                                                   |
| Qualification         | `technician_qualifications` | catalog type                      | BR-2.6 (only platform admin verifies; no grant on `verification_status`); BR-2.7 (`enforce_qualification_expiry`); BR-2.8 (re-dating resets review, type immutable) |
| Availability          | `availability_windows`      | —                                 | BR-4.1–4.6; ≤ 366 days (DB check)                                                                                                                                   |
| Work requirement      | `work_requirements`         | `work_requirement_qualifications` | BR-1.1–1.3 (checks); **BR-1.4 ≥1 hard, ≤20 — deferred constraint trigger for `open`/`covered`** (E-3); BR-1.8 (RLS manager/admin); BR-1.9 never deleted             |
| Organization          | `organizations`             | `organization_members`            | BR-9; one org per user in the UI (`requireOrganizationContext`)                                                                                                     |

## States

| Entity                        | Values                                                | Transitions in code                                                                                                                       |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `work_requirements.status`    | `draft` · `open` · `covered` · `cancelled` · `closed` | Created `open`; **no transition UI or API yet** (BR-1.9 PARTIAL)                                                                          |
| `verification_status`         | `pending` · `verified` · `rejected` · `expired`       | `pending → verified/rejected` only via `review_qualification` (local, OD-3); any re-dating → `pending`; `expired` value exists, no writer |
| qualification `status`        | `active` · `withdrawn`                                | Owner, both directions                                                                                                                    |
| `availability_windows.status` | `available` · `unavailable`                           | Owner CRUD                                                                                                                                |
| `profile_visibility`          | `private` · `anonymous` · `open`                      | Owner (BR-8)                                                                                                                              |
| `requirement_urgency`         | `planned` · `urgent` · `aog`                          | Informational (BR-1.6, D-05 open)                                                                                                         |

## Deterministic engines — ONE implementation each

| Engine                                                     | Function (file)                                         | Used by                                                                            | Rules      |
| ---------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| Qualification validity                                     | `validityForPeriod` (`src/domain/qualification.ts`)     | matching                                                                           | BR-2       |
| Availability coverage                                      | `availabilityCoverage` (`src/domain/availability.ts`)   | matching                                                                           | BR-4       |
| Eligibility + soft score                                   | `evaluateMatch` (`src/domain/matching.ts`)              | `matching-evaluate`, `capacity-evaluate`                                           | BR-3, BR-5 |
| Capacity                                                   | `evaluateCapacity` (`src/domain/capacity.ts`)           | `capacity-evaluate`, org dashboard                                                 | BR-6       |
| Evaluability guard                                         | `assertEvaluableRequirement` (`src/domain/capacity.ts`) | `evaluateCapacity` + `matching-evaluate` (refuse a requirement without hard quals) | BR-1.4     |
| Passport completeness                                      | `profileCompleteness` (`src/domain/professional.ts`)    | professional overview                                                              | BR-11      |
| External pool selection (SQL **prefilter**, not an engine) | `app_private.ranked_external_pool` (`20261015130300`)   | `get_requirement_candidate_pool`                                                   | BR-7       |

**Parity rule.** The SQL prefilter only _orders and caps_ candidates (eligible-first) — the verdict is
always `evaluateMatch`. Its "hard-eligible" predicate must agree with `evaluateMatch`; proven by
`tests/db/rls.test.ts` section M (300 random profiles + 50/100/101/500 sizes). Any change to BR-2/3/4
must update both and keep section M green.

## Pools and privacy (BR-7, BR-8)

- Internal pool: members of the requirement's org, named.
- External pool: `anonymous`/`open`, not members, holding ≥1 required type; **max 100 evaluated**
  (R-D3 open); per-requirement pseudonym `CF-…` (T-04); `private` never appears.
- `get_requirement_external_pool_summary` tells the UI whether the external result is complete.

## Not modelled yet (PLAN — do not assume they exist)

Documents/Storage, consents, Candidate Pack, applications (D-06), proposals, confirmations,
assignments/day coverage (D-08), organization verification/KYB (C-14, OD-5), recruiter clients (D-12),
rating restrictions (D-02), min experience as hard rule (D-03), work-permit countries (D-04), AOG-only
availability (C-8, D-05), requirement terms/rates (C-9), tools/logbook (D-11), notifications, billing (OD-7).

## Pending functional decisions that change rules

OD-3/D-01 (verification), D-02…D-05 (matching inputs), D-06/D-07 (application + unlock), D-08 (shifts),
D-09/OD-4 (internal visibility), R-D3 (pool cap), R-D4 (drafts), R-D5 (completeness). Index:
[`07-decisions-index.md`](07-decisions-index.md).
