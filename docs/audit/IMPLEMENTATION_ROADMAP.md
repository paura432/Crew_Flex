# Implementation roadmap

> **Partly historical.** Step 0 ("create staging", "no functions deployed") is DONE/CANCELLED: functions
> were deployed 2026-10-09 and staging was dropped by OD-9. The verifier flow is implemented locally
> (OD-3-gated). The authoritative rollout list (incl. `20261015130400`) is
> `docs/audit/CREWFLEX_DIFF_CURRENT.md` §5; current state in `memory-bank/01-current-state.md`.

Ordered by real dependencies found in the audit. Each phase ends with `pnpm check`, `pnpm build`, tests
for every new policy/function, and a parity update in `PARITY_MATRIX.md`.

## Step 0 — Remote activation (needs explicit approval; no code)

| Action                                                                                                             | Why                                                       | Risk                                  | Effort |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------- | ------ |
| `supabase functions deploy health work-requirements capacity-evaluate matching-evaluate professional-availability` | Nothing EF-backed works in the deployed app today         | Low (new functions, no schema change) | S      |
| `supabase secrets set ALLOWED_ORIGINS=https://crew-flex.vercel.app`                                                | CORS allowlist for production                             | Low                                   | XS     |
| Create one synthetic test professional + organization (confirmed e-mail) for E2E                                   | Only way to verify authenticated screens and RLS remotely | Low (synthetic)                       | XS     |
| Decide e-mail confirmation policy (OD-8)                                                                           | Blocks automated E2E sign-up                              | —                                     | —      |

Phase 0.5 (2026-10-09) detailed this step in `DEPLOYMENT_PLAN.md`: ordered sequence (secret → `health` →
`professional-availability` → the rest), per-step rollback (`functions delete`), three synthetic
auto-confirmed accounts created per user (global `mailer_autoconfirm` stays off, OD-8 untouched), and the
remote E2E suite `tests/e2e/remote-smoke.test.ts` (`pnpm e2e:remote`). Backend audit: `EDGE_FUNCTIONS_AUDIT.md`
(READY; CORS fail-closed hardening applied locally). Current verdict: **NO-GO until authorized** — see the
plan §7. Phases 1–7 below are unchanged and remain blocked behind step 0.

## Phase 0.6 (2026-10-09) — sources recovered, staging before anything else

- **Step 0 is now "create STAGING"** (`docs/architecture/ENVIRONMENTS.md` §4): second Supabase project,
  identical migrations, functions with `--project-ref <staging-ref> --use-api`, three synthetic accounts,
  Vercel Preview bound to staging, `pnpm e2e:remote` (10 checks). Production deploy only after that passes.
- Marketplace features (phase 6) stay frozen until staging is verifiable, as requested.
- Where the recovered candidates land if approved (no new phases; IDs in `FEATURE_INVENTORY.md` §J–M):
  - Phase 1 (profile): CF-J01 engagement modes, CF-L01 onboarding intent, CF-L03 completeness hint,
    CF-J04 "employer hidden" rule in BR-8, CF-J11/J12 rules in `BUSINESS_RULES.md`, FD-19 human-in-the-loop sentence.
  - Phase 2 (qualifications/availability): CF-K19 licence authority, CF-L05 one-tap 72 h window, FD-21 modes (C-8).
  - Phase 3 (documents/privacy): CF-L09 tool-calibration document type, FD-22 per-case authorisation, CF-K06 expiry alerts.
  - Phase 4/5 (needs/capacity): CF-K16 publish-time preview (reuse `capacity-evaluate` on draft), FD-28 fields (C-9).
  - Phase 6 (marketplace): CF-L07 apply preview sheet (= FD-23 Candidate Pack spec), CF-K17/L11 blocker shown to the technician, CF-K09 document request.
  - Phase 7: CF-K07 AOG outreach (opt-in, FD-24), CF-L10 logbook disclaimer (FD-25), tools priorities (FD-26).
  - Open decisions before any of the above: C-7/C-14 visibility + org verification, C-10 matching inputs
    (FD-20, CF-J10, L04, K08), C-12 brand identity, C-13 multi-vertical, C-15 launch order, OD-7 pricing (FD-29, K12, L13).

## Phase 0.7 (2026-10-10) — main-only, production activation

- **Staging is cancelled** (OD-9 resolved temporarily): one environment, `main` → Vercel → Supabase
  `sbjkzrkmcekokkqiuvvh`; `docs/architecture/ENVIRONMENTS.md` rewritten, staging wrapper not merged.
- The five functions and `ALLOWED_ORIGINS` were already deployed on 2026-10-09; Phase 0.7 verifies them
  with the guarded remote E2E (`tests/e2e/guard.ts`) and the deployed UI, then unblocks Phases 1–7.
- Phases 1–7 keep their order; everything connects to the same project.

## Phase 1 (DONE locally 2026-10-11) · Phase 1.5 ES/EN (DONE locally 2026-10-11) · Phase 1.6 review

- Phase 1: `professional-profile`, `professional-qualifications`, passport + qualifications UI, BR-2.7/2.8,
  BR-11 completeness (`docs/audit/PHASE1_PROFILE_QUALIFICATIONS.md`).
- Phase 1.5: next-intl without routing, catalogs ES/EN, `/app/settings`, `user-preferences` function,
  migration `20261011120000_preferred_locale`, locale precedence, formats, tests
  (`docs/product/I18N_STRATEGY.md`, `docs/audit/I18N_COVERAGE.md`).
- Phase 1.6: full functional review and re-classified matrix (`FULL_FUNCTIONAL_REVIEW.md`, `PARITY_MATRIX.md`).
- **Not deployed**: the three functions and the migration wait for explicit authorization (step 0b below).

## Step 0b — Deploy phases 1/1.5 to production (needs explicit approval)

`supabase db push` (migration `20261011120000_preferred_locale`, additive) → `supabase functions deploy
professional-profile professional-qualifications user-preferences` → guarded `pnpm e2e:remote` (19 checks)
→ `git push` (Vercel). Rollback: `functions delete` per function; the column is nullable and unused by
the previous build.

## Prioritised next phases (dependencies first, `FULL_FUNCTIONAL_REVIEW.md` §10)

| Order | Phase                                       | Depends on    | Unlocks                                | Size |
| ----- | ------------------------------------------- | ------------- | -------------------------------------- | ---- |
| 1     | Step 0b deploy                              | authorization | everything professional-side in prod   | S    |
| 2     | Verifier flow (privileged, audited EF + UI) | OD-3          | hard eligibility for new professionals | M    |
| 3     | Wallet documental (CF-D01–D05)              | 2 (linkage)   | evidence behind verification           | L    |
| 4     | Org settings + invitations (F09/F10)        | —             | real internal workforce                | M    |
| 5     | Requirement lifecycle + filters (F05/F03)   | —             | operations hygiene                     | S    |
| 6     | Model decisions C-7/C-8/C-9/C-10/C-14       | founders      | B04/B05/C05/G02 + recovered candidates | —    |
| 7     | Marketplace (E01–E06, F07, H04, C07)        | 2–6           | the original S1 flow                   | XL   |
| 8     | Urgent ops, tools, logbook, notifications   | 7             | S1 completeness                        | M    |

## Phase 1 — Identity & profile (P0) · value high · risk low · M (historical plan)

- `professional-profile` EF (GET/PATCH): base location, mobility, years, current status, visibility.
- Profile edit UI with S1 passport step 1 + 4 layout (identity, rate/mobility where modelled).
- Visibility editing (CF-H01) → makes the professional matchable.
- Tests: Zod, Deno, RLS (own-only update, `profile_id` immutable).
- Depends on: nothing. Blocks: everything professional-side.

## Phase 2 — Qualifications & availability (P0) · value high · risk medium · M

- **Availability: done in this branch** (CF-C01–C04). Remaining: "Solo AOG" state and shift pattern
  generator after OD C-8.
- `professional-qualifications` EF (POST/PATCH/DELETE; always `pending`; evidence change resets).
- Qualifications UI = S1 passport step 2/3 (type, issued, expires).
- Tests: RLS D-section already covers tampering; add EF tests.

## Phase 3 — Documents & privacy (P1) · value high · risk high (privacy) · L

- Migration: `documents` (object_path, block, expires_at, verification_status, qualification_id FK),
  private bucket `evidence`, storage policies.
- `professional-documents` EF: upload URL, list, signed download (≤ 60 s), delete.
- Wallet UI (S1 blocks and expiry chips).
- Block-employer preference (CF-H02) + visibility `verified` level decision (OD C-7).

## Phase 4 — Organizations & needs (P1) · value high · risk medium · L

- Org settings (CF-F09), members/invitations with consent (CF-F10).
- Requirement status transitions + pause (CF-F05), list filters/search (CF-F03).
- Decide OD C-9 (economics, logistics, explicit days, split coverage) and extend `work_requirements`
  with a non-destructive migration if approved.

## Phase 5 — Capacity & matching (P0 already implemented; P1 extensions) · M

- Soft score inputs beyond qualifications (OD C-10), compare view and candidate drawer (CF-F06).
- Per-day coverage once assignments exist (CF-E06).

## Phase 6 — Marketplace (P1) · value high · risk high · XL

- Migration: `applications`, `application_events`, `candidate_packs`, `messages` (optional).
- Opportunity visibility rule for professionals; apply with days, documents, consent (CF-E03).
- State machine from S1 `fh()` as pure domain + EF; assignment conflicts; calendar `assigned`.
- Pipeline UI for organizations (CF-F07).

## Phase 7 — Urgent/AOG, recruiter, tools (P2) · M

- Opt-ins + quiet hours (CF-G06), outreach record without external messaging (CF-G05).
- Recruiter client representation (CF-F11), tools hub and logbook (CF-I01/I02), notifications (CF-A04).

Changes vs the brief's orientative order: none in sequence; availability was pulled forward into this
execution as the first verifiable slice (brief §22), and the remote activation step was added because
the audit showed no functions deployed.
