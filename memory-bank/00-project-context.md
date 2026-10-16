# 00 · Project context

Canonical: `docs/product/PRODUCT.md` (definition, users, thesis), `docs/product/V1_SCOPE.md` (scope).
This file is the two-minute version; it adds nothing those files do not say.

## Problem

An MRO rarely needs "a mechanic"; it needs _2 × B1.1, A320 family, EWIS + HF + FTS valid, Madrid,
night shift, 18–21 Oct_. That information lives in CVs, chats and spreadsheets: unstructured, not
comparable, re-sent to every employer. Short availability blocks (3–4 free days) are wasted, and an
AOG tonight cannot follow the same process as a campaign in six months.

## What Crew Flex is

A platform that turns **qualifications + availability + operational demand** into **mobilisable
technical capacity**. First (and only funded) vertical: **aviation maintenance workforce**. The
multi-vertical claim of the marketing sources is strategy only (OD C-13), not a modelling goal.

## Capacity-first, not a job board

```
REQUIREMENT → INTERNAL WORKFORCE → CAPACITY ANALYSIS → GAP → ELIGIBLE EXTERNAL NETWORK → CANDIDATE PACK → COVERAGE
                └──────────────── implemented (V0) ────────────────┘   └─ planned (consent, applications) ─┘
```

A requirement is first evaluated against the organization's own people; only the **gap** goes to the
external network, and the external network is **pseudonymous** unless the professional chose `open`.
There are no vacancies, no CV inbox, no public directory, no "% affinity" ranking.

## Actors

| Actor                             | Side     | In code today                                                                 |
| --------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Professional (technician)         | Supply   | `account_type = professional`; passport, qualifications, availability         |
| Organization member/manager/admin | Demand   | `organization_members.role`; requirements, capacity, matching (manager/admin) |
| Platform admin                    | Platform | `profiles.platform_role = platform_admin`; review queue (local only, OD-3)    |
| Recruiter / staffing agency       | Demand   | enum value `staffing_agency` only — no behaviour (LATER, D-12)                |

## Non-negotiables (from PRODUCT / AGENTS)

- **Deterministic eligibility.** Hard requirements are filters; a score never compensates a missing
  hard requirement; ineligible ⇒ score 0. **LLM ≠ eligibility engine.**
- **Matchable ≠ shareable.** A qualification can count for matching without exposing its document or
  the person's identity. Default visibility `private`.
- **Self-declared ≠ verified.** Hard requirements need `verified` (BR-3); only a platform admin
  verifies (OD-3 still open for production).

## Value proposition

- Professional: a free, private space for licences, ratings, training and availability that is useful
  even when happily employed; they control visibility.
- Organization: express a real operational need, see the gap immediately, get an explainable list of
  people who actually qualify and are available.

## Limits (OUT for this phase — `V1_SCOPE.md` §OUT)

Payments, invoicing, commissions, chat, e-mail/SMS/WhatsApp/push, OCR/CV parsing, automatic document
verification, LLM features, ratings, payroll, Candidate Pack PDF, advanced analytics, full back office.
Business model (fees, AOG premium) is OD-7: nothing commercial is implemented.

## Reference material (not specifications)

- `CrewFlex_v1.3_Unificada.zip` at the repo root (git-ignored, public-repo rule T-07): a functional
  prototype with its own Node/SQLite server. Its engines are **references only** (T-01); integration
  status lives in `docs/integration/crewflex-v13/`.
- Older prototypes and the blueprint: `docs/audit/SOURCE_INVENTORY.md`, `docs/audit/sources/`.
