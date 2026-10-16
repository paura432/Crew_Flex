# 06 · Implementation roadmap (V1.3 → Next)

> Phase 0.8 (2026-10-15). Increments are small, local-first and verifiable. Remote apply/deploy is
> always a separate, explicitly authorised step (OD-9: `main` = production). Complements
> `docs/audit/IMPLEMENTATION_ROADMAP.md` (deployment order and earlier steps).

## Status of the phase 0.8 increments

| Inc. | Scope                                                 | State                                                                                                                                                                                                | Evidence / blocker                                                                             |
| ---- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A    | V1.3 audit, parity matrix, rule comparison, decisions | **DONE**                                                                                                                                                                                             | `01`–`05`, `08`                                                                                |
| B    | Editable professional passport                        | DONE in phase 1 (2026-10-11), unchanged now. Field extensions (work countries, English, mobilisation) **blocked** by D-03/D-04/D-05                                                                  | RLS F, `professional.test.ts`; UI re-check blocked today (no local function runtime, see `07`) |
| C    | Editable qualifications with protected verification   | DONE in phase 1 + **hardened now** (DB backstops, audit). Verification by an admin **blocked** by D-01 (OD-3)                                                                                        | RLS D, F, I                                                                                    |
| D    | Availability integrated                               | DONE in phase 1 + 366-day DB check now. AOG-only/shift patterns **blocked** by D-05 (C-8)                                                                                                            | matching.test 5/5b/6, RLS availability + I                                                     |
| E    | Matching end-to-end                                   | **PARTIAL**: pool selection fix (R-11), shared-evaluator test, workforce crash fix. Full journey re-run **blocked today** (local Edge runtime unavailable) and step 5 (verification) blocked by D-01 | RLS "capped external pool…", capacity.test, `map.test.ts`, browser check                       |
| F    | Storage + document verification                       | NOT STARTED (planned in `04`) — needs D-01, D-07, D-10                                                                                                                                               | —                                                                                              |

## Status after the remediation of 2026-10-15 (`docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md`)

| Inc. | State (local; nothing remote)                                                                                               |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| E-3  | **DONE** — `20261015130000` (deferred constraint trigger + engine guard); PGlite, real-Postgres race and local E2E evidence |
| I-1  | **DONE** — `20261015130200` + `Idempotency-Key` in the three create endpoints and forms                                     |
| I-3  | **DONE** — `20261015130100` (atomic RPC + optimistic concurrency, `CF412`)                                                  |
| E-4  | **DONE** — `src/server/edge-functions.test.ts`: rejected fetch/timeout → `NETWORK_ERROR`, non-envelope → generic error      |
| R-11 | **DONE (superseded)** — `20261015130300`: eligible candidates first + completeness summary in the API/UI                    |
| V-1  | **IMPLEMENTED LOCALLY** — `20261015130400`, `qualification-reviews`, `/app/admin/verifications`; remote blocked by OD-3     |

## Recommended next increments (in order)

> **2026-10-15:** E-3, I-1, I-3, E-4, R-11 and V-1 below are **done locally** (table above). They are kept as
> the design record; do not re-implement them. Increments B/E "blocked today (no local runtime)" were unblocked
> the same day (local E2E 25/25, smoke 78/78). The remote rollout list is in
> `docs/audit/CREWFLEX_DIFF_CURRENT.md` §5 (it includes `20261015130400`, schema only).

### E-3 — Close the BR-1.4 bypass (technical, no decision)

- Revoke direct `insert`/`delete` on `work_requirement_qualifications` from `authenticated`;
  constraint trigger (deferrable) "≥ 1 hard per requirement"; keep `create_work_requirement`.
- Tests: RLS — a manager cannot leave a requirement without hard qualifications by direct writes.

### I-1 — Idempotent POSTs (technical)

- `Idempotency-Key` header on `work-requirements` POST and `professional-availability` POST
  (05 §I1). Server actions generate the key once per form submission.
- Tests: Deno — replay returns the first response; RLS — key is per actor.
- Covers the brief's critical case "retries do not create duplicates" (today NOT covered).

### I-3 — Atomic passport update (technical)

- `update_professional_profile` RPC (SECURITY INVOKER) replacing the two updates in the EF.

### E-4 — Explicit "network error is never success" test

- Unit test for `src/server/edge-functions.ts`: a rejected `fetch` maps to `NETWORK_ERROR`, and the
  server actions return a failure state (today only code-reviewed).

### V-1 — Verification flow (after D-01)

- RPC `review_qualification` (DEFINER, `is_platform_admin()`), EF `qualification-verifications`,
  `/app/admin/verifications`. Columns Q3 (`verified_by`, `verified_at`, `review_note`).
- Unblocks step 5 of the end-to-end journey and real production eligibility.

### M-2 — Matching inputs (after D-02, D-03, D-04)

- `restrictions` (hard blocker), `min_years_experience`, `country` + `work_countries`, any-of groups.
- Every new blocker gets a code, an i18n explanation (ES/EN), a matching.test case and a
  BUSINESS_RULES row in the same change.

### Block 2 — Documents (after D-07, D-10)

Private bucket, signed upload URLs, quarantine, metadata, owner-only reads; third-party reads only
through pack consent + acceptance. No OCR, no automatic verification.

### Block 3 — Contracting (explicit authorisation required)

Applications, events, assignments, Candidate Pack snapshot/projection, confirmation RPC with locks
(04 §Contracting). State machine per D-06.

### Block 4 — Tools (after D-11)

1. `src/tools/units.ts` (22 magnitudes) + port `tests/tools.test.mjs` round-trip and factor tests.
2. Torque with tolerance range. 3. Durations. 4. Fuel conversion/plan/balance with the V1.3
   regression example (11 920 kg expected, −40 kg balance, −120 kg vs objective). 5. Glossary + ATA
   after editorial review. All pure, no Supabase; disclaimers kept verbatim in meaning.

### Recruiter and AOG

Inventory only (`02` §3, `04`). No implementation before D-05 and D-12.

## Dependencies

```
D-01 (verifier) ──► V-1 ──► real eligibility in production ──► Block 3 confirmations
D-07, D-10 ───────► Block 2 ──► Candidate Pack documents
D-02/03/04 ───────► M-2 ──► need builder parity (V13-C05)
OD-4 + invitation ─► organization-workforce EF ──► internal capacity in production (V13-C02)
E-3, I-1, I-3, E-4: independent, can start now
```

## Remote steps (never automatic)

Order when authorised: apply `20261011120000`, `20261015120000`, `20261015120100` (check first that
no availability window exceeds 366 days and no active qualification lacks a required expiry —
queries in `07`), deploy the changed functions, then push `main`. `main` auto-deploys to Vercel.
