# Implementation roadmap

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

## Phase 1 — Identity & profile (P0) · value high · risk low · M

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
