# V1 Scope

Current phase: **Foundation + Prototype V0**. Milestone:

> An organization creates a technician need. Crew Flex computes its capacity and shows the gap.
> Then it determines which professionals really meet the requirements and explains why.

## NOW (Foundation V0)

| Item                                                                                                                                                                                                                                               | Status                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Repo, quality gates (ESLint, Prettier, Husky, lint-staged, Vitest)                                                                                                                                                                                 | IMPLEMENTED                                                                                                               |
| Product + architecture documentation                                                                                                                                                                                                               | IMPLEMENTED                                                                                                               |
| Email/password auth (sign in, sign up, sign out, session refresh)                                                                                                                                                                                  | IMPLEMENTED                                                                                                               |
| Password recovery (`/forgot-password` → e-mail → `/auth/confirm` → `/reset-password`; no enumeration; other sessions revoked)                                                                                                                      | IMPLEMENTED (local only) — publishing needs the production Auth redirect URL (owner)                                      |
| `/app/**` protected (proxy redirect + server-side session check)                                                                                                                                                                                   | IMPLEMENTED                                                                                                               |
| Data model V0 + RLS from first migration                                                                                                                                                                                                           | IMPLEMENTED                                                                                                               |
| Edge Functions: `health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`                                                                                                                                                            | IMPLEMENTED                                                                                                               |
| Deterministic matching + capacity (pure TS, tested)                                                                                                                                                                                                | IMPLEMENTED                                                                                                               |
| Organization dashboard with capacity overview                                                                                                                                                                                                      | IMPLEMENTED                                                                                                               |
| Requirements list / create / detail / matches; close (V1.8 `job.status`, terminal, audited — local 2026-10-20)                                                                                                                                     | IMPLEMENTED                                                                                                               |
| Organization workforce (read-only list; managers/admins only, members see a notice)                                                                                                                                                                | IMPLEMENTED                                                                                                               |
| Professional passport (edit) + qualifications (declare/edit/withdraw/remove) + availability                                                                                                                                                        | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Audit foundation (`requirement.created`, `qualification.created/updated/removed/verified`)                                                                                                                                                         | IMPLEMENTED (`qualification.created/updated/removed`: production since 2026-10-16; `qualification.verified`: local, OD-3) |
| DB backstops for EF-only rules + candidate-pool selection order (phase 0.8, migrations `20261015120000`, `20261015120100`)                                                                                                                         | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Bilingual UI (ES/EN), Settings page, persisted language preference (`user-preferences`)                                                                                                                                                            | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Remediation 2026-10-15: BR-1.4 in the DB (E-3), atomic passport (I-3), idempotent creates (I-1), eligible-first external pool + completeness summary (`20261015130000`…`130300`)                                                                   | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Platform-admin qualification review (`review_qualification`, `qualification-reviews`, `/app/admin/verifications`, `20261015130400`)                                                                                                                | IMPLEMENTED — schema in production (`130400`), flow OFF at all 3 layers (OD-3); function not deployed                     |
| Availability work/rest cycle generator (V1.8 parity: preview, save/discard, atomic `PUT`, migration `20261019120000`)                                                                                                                              | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Professional tools (D-11, owner 2026-10-19): unit conversion (22 quantities), torque conversion, durations — `/app/tools`, client-side engine 1.0.0                                                                                                | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Availability: per-technician write lock + saved cycle pattern + undo (`20261019130000`, `20261019140000`)                                                                                                                                          | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Availability «AOG only» (`aog_only`, BR-4.8, owner decision C-8/D-05; `20261019150000`, `150100`)                                                                                                                                                  | IMPLEMENTED — in production since release 1 (`65df3b9`, 2026-10-19); authenticated E2E in production not run              |
| Document wallet, owner only (D-10; private bucket, `professional-documents`, `20261019160000`/`160100`); no third-party sharing until a scanner is approved                                                                                        | IMPLEMENTED (local only, 2026-10-19; not deployed)                                                                        |
| Platform-admin «Ver como» switcher (D-13, owner 2026-10-22; v1.8 «Probar como»): Técnico / Empresa / Recruiter / Administración over the admin's own account, the sidebar shows the active view's menu, `/app/admin` home, Recruiter = placeholder | IMPLEMENTED (local only, 2026-10-22; not deployed)                                                                        |
| Requirement lifecycle: pause/resume, close, edit without applications (M05, owner 2026-10-22; `20261022130000/130100`, PUT)                                                                                                                        | IMPLEMENTED (local only, 2026-10-22; not deployed)                                                                        |
| Opportunities for professionals with own eligibility explained (M07, D-12, owner 2026-10-22; `20261022130200`, `opportunities`)                                                                                                                    | IMPLEMENTED (local only, 2026-10-22; not deployed)                                                                        |
| Applications and hiring circuit, both sides (M08, D-06 Q2–Q7 + R-08, owner 2026-10-22; `20261022130300`, `applications`)                                                                                                                           | IMPLEMENTED (local only, 2026-10-22; not deployed)                                                                        |
| Remote apply of migrations + function deploy                                                                                                                                                                                                       | DONE for release 1 (15 migrations, 8 functions, 2026-10-19); later local work needs a new owner-approved plan             |

## NEXT

- (Done 2026-10-19 for release 1 — kept for history) Production rollout of everything verified locally (explicit authorization; full order in
  `docs/audit/CREWFLEX_DIFF_CURRENT.md` §5): migrations `20261011120000` → `20261015120000` → `120100` →
  `130000` → `130100` → `130200` → `130300` **and `130400`** (its schema is required by
  `professional-qualifications`; the review stays closed without the owner-only flag row and the function
  secret — recommended option (a); option (b) patches the function instead, see §5), then the functions `work-requirements`, `capacity-evaluate`, `matching-evaluate`,
  `professional-availability`, `professional-profile`, `professional-qualifications`, `user-preferences`,
  then push `main`. A partial set breaks pages (e.g. matches needs `summary.pool`).
- V1.3 integration plan and pending decisions: `docs/integration/crewflex-v13/` (D-01…D-12).
- Availability: AOG opt-in / priority contact (not part of the C-8 decision).
- Organization member management (`organization-workforce` function): invite/add members.
- Approve OD-3 / D-01, then deploy `qualification-reviews` with `QUALIFICATION_REVIEW_ENABLED=true` and
  insert the `qualification_review` flag row (the flow itself is implemented locally, 2026-10-15).
- Document wallet to production (needs the file-cleanup on account deletion, M-3) and, after a scanner decision, sharing through the Candidate Pack (D-07, `CANDIDATE_PACK.md`).
- Playwright journeys for the vertical slice.

## LATER

> **Owner, 2026-10-22 (SCOPE-2):** every LATER item below is now implementable **locally** («copiarlo todo»), with
> v1.8's behaviour as the documented default where a decision is open (`08-product-decisions.md` §SCOPE-2). OUT stays out.

- Candidate Pack (consent-based, per requirement).
- Partial coverage (several technicians covering one requirement period by day blocks).
- Urgent / AOG outreach intensity, opt-in priority contact.
- Recruiter workspace and client representation (platform admins see a «Próximamente» placeholder since 2026-10-22, D-13).
- Tools hub beyond D-11: fuel sheet (after a technical review of its wording), glossary/ATA, daily challenge, translator; logbook from the prototype. Contractor calculators stay OUT.
- Rates, logistics and contract conditions on requirements.

## OUT (not this product phase)

Payments, Stripe, invoicing, commissions, chat, email automation, SMS, WhatsApp, push, OpenAI/RAG/
embeddings, CV parser, OCR, automatic document verification, Candidate Pack PDF, ratings, payroll,
contractor tax calculators, advanced analytics, full admin back office.
