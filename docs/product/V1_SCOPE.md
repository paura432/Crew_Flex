# V1 Scope

Current phase: **Foundation + Prototype V0**. Milestone:

> An organization creates a technician need. Crew Flex computes its capacity and shows the gap.
> Then it determines which professionals really meet the requirements and explains why.

## NOW (Foundation V0)

| Item                                                                                        | Status                                          |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Repo, quality gates (ESLint, Prettier, Husky, lint-staged, Vitest)                          | IMPLEMENTED                                     |
| Product + architecture documentation                                                        | IMPLEMENTED                                     |
| Email/password auth (sign in, sign up, sign out, session refresh)                           | IMPLEMENTED                                     |
| `/app/**` protected (proxy redirect + server-side session check)                            | IMPLEMENTED                                     |
| Data model V0 + RLS from first migration                                                    | IMPLEMENTED                                     |
| Edge Functions: `health`, `work-requirements`, `capacity-evaluate`, `matching-evaluate`     | IMPLEMENTED                                     |
| Deterministic matching + capacity (pure TS, tested)                                         | IMPLEMENTED                                     |
| Organization dashboard with capacity overview                                               | IMPLEMENTED                                     |
| Requirements list / create / detail / matches                                               | IMPLEMENTED                                     |
| Organization workforce (read-only list)                                                     | IMPLEMENTED                                     |
| Professional passport (edit) + qualifications (declare/edit/withdraw/remove) + availability | IMPLEMENTED (local; functions not yet deployed) |
| Audit foundation (`requirement.created`, `qualification.verified`)                          | IMPLEMENTED                                     |
| Remote apply of migrations + function deploy                                                | BLOCKED (see final report / `ARCHITECTURE.md`)  |

## NEXT

- Deploy `professional-profile` and `professional-qualifications` to production (explicit authorization).
- Availability: "AOG only" day state and shift-pattern generator (OD C-8).
- Organization member management (`organization-workforce` function): invite/add members.
- Platform-admin verification flow (privileged, audited) for qualifications.
- Private Storage bucket for evidence documents + short-lived signed URLs.
- Playwright journeys for the vertical slice.

## LATER

- Candidate Pack (consent-based, per requirement).
- Partial coverage (several technicians covering one requirement period by day blocks).
- Urgent / AOG outreach intensity, opt-in priority contact.
- Recruiter workspace and client representation.
- Tools hub (converters, glossary, contractor calculators) and logbook from the prototype.
- Rates, logistics and contract conditions on requirements.

## OUT (not this product phase)

Payments, Stripe, invoicing, commissions, chat, email automation, SMS, WhatsApp, push, OpenAI/RAG/
embeddings, CV parser, OCR, automatic document verification, Candidate Pack PDF, ratings, payroll,
contractor tax calculators, advanced analytics, full admin back office.
