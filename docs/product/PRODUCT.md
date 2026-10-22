# Crew Flex — Product

> Status vocabulary used across docs: **IMPLEMENTED**, **PARTIAL**, **PLANNED**, **OPEN DECISION**.
> Sources: `CrewFlex_Blueprint_Producto_v1.pdf` (Oct 2026), prototype `CrewFlex_v1.1.html`, and the
> Foundation V0 engineering brief (current direction — wins on conflict, see `OPEN_DECISIONS.md`).

## One-line definition

Crew Flex turns qualifications, availability and operational demand into **mobilisable technical
capacity**. First vertical: **aviation / aircraft maintenance workforce**.

## Problem

- An MRO rarely needs "a mechanic". It needs e.g. _2 × B1.1, A320 family, EWIS + HF + FTS valid,
  Madrid, night shift, 18–21 Oct_.
- That information lives in CVs, chats, spreadsheets, agencies and personal networks. It is not
  structured, not reusable and not comparable.
- Technicians resend the same licences and certificates to every employer.
- Short blocks of availability (3–4 free days) are wasted: job boards are not built to turn them
  into capacity.
- Urgency changes everything: a campaign in six months and an AOG tonight cannot use the same
  process.

## Users

| User                                  | Side     | Notes                                                                |
| ------------------------------------- | -------- | -------------------------------------------------------------------- |
| Professional (technician)             | Supply   | B1/B2, Cat A, mechanics, sheet metal, NDT… Often already employed.   |
| Organization member / manager / admin | Demand   | MRO, airline, operator. Defines requirements, manages its workforce. |
| Recruiter / staffing agency           | Demand   | A customer type, not a competitor. **PLANNED** (not in V0).          |
| Platform admin                        | Platform | Verification, support. Privileged and audited.                       |

## Jobs to be done (organization)

1. What technical capacity do I need? → **Work Requirement**
2. What capacity do I have internally? → **Internal workforce**
3. What capacity am I missing? → **Capacity gap**
4. Who really meets the requirements? → **Deterministic eligibility**
5. Who is available on the required dates? → **Availability windows**
6. How can I cover the gap? → **Eligible external network** → Candidate Pack → Coverage
7. What evidence proves a person is valid? → **Verification status + documents**

## Capacity-first thesis

```
ORGANIZATION REQUIREMENT → INTERNAL WORKFORCE → CAPACITY ANALYSIS → CAPACITY GAP
  → ELIGIBLE EXTERNAL NETWORK → CANDIDATE PACK → COVERAGE
```

Crew Flex is **not** a job board. A requirement is first evaluated against the organization's own
workforce; only the **gap** is taken to the external network.

```
MADRID · 18–21 OCT · NIGHT · 2 × B1.1 A320 FAMILY · EWIS + HF + FTS (hard)

REQUIRED 2   INTERNALLY ELIGIBLE 1   GAP 1   EXTERNAL ELIGIBLE 3
```

## Value proposition

- **Professional:** a free professional space for licences, type ratings, training, availability
  and preferences. The professional controls visibility. Useful even when happily employed.
- **Organization:** express a real operational need (not a free-text vacancy), see the gap
  immediately, and get an explainable list of people who actually qualify and are available.

## Professional side

Profile, qualifications (licences, type ratings, training, approvals, skills) with expiry and
verification status, availability windows, visibility controls. Tools hub (converters, glossary,
contractor calculators) from the prototype is **LATER**.

## Organization side

Organization account with member roles (member / manager / admin), internal workforce, work
requirement builder, capacity overview, matching preview. Recruiter flow is **LATER**.

## Privacy

- Not a public directory. Default visibility is `private`.
- **Matchable data ≠ shareable data.** A qualification can participate in matching without exposing
  the document that proves it, nor the person's identity.
- External candidates are shown pseudonymously unless the professional chose `open` visibility.
- See `SECURITY_PRIVACY.md`.

## Matching

Deterministic. **LLM ≠ eligibility engine.** Hard requirements are filters; a high score can never
compensate a missing hard requirement. Soft requirements contribute to a score. Every result is
explainable (blockers + reasons). See `BUSINESS_RULES.md`.

## Candidate Pack

Structured dossier generated from the profile and shared **with consent** for a specific
requirement. **PARTIAL** (local only, 2026-10-24): the dated technical copy frozen when the professional applies
(«Ver expediente», BR-25); identity, contact and documents wait for D-07 P3 and the scanner (`CANDIDATE_PACK.md`).

## Planned / Urgent / AOG

Urgency is stored on every requirement (`planned`, `urgent`, `aog`). In V0 it is displayed and
filterable. «Distribuir aviso Urgente / AOG» — one in-app notice per professional who opted in for that urgency,
respecting visibility, blocks, restrictions, eligibility, availability, mobilization and quiet hours, the organization
told only how many — is **IMPLEMENTED (local only)**, package outreach, BUSINESS_RULES BR-26. Differentiated outreach
intensity, priority contact and commercial logic are **PLANNED**; e-mail, SMS and push stay OUT.

## Non-goals (now)

Payments, invoicing, commissions, chat, email/SMS/WhatsApp/push, OCR/CV parsing, automatic document
verification, LLM features, ratings, payroll, contractor tax tools, recruiter marketplace, advanced
analytics. See `V1_SCOPE.md`.

## Business model

Pricing hypotheses (publication fee, 3–4 % success fee, Urgent/AOG premium, Recruiter plan) are
**OPEN DECISION** per the blueprint. Nothing commercial is implemented.
