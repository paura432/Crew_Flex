# 07 · Decisions index

Index only. The decision text, options and defaults live in the linked canonical docs. Status as of
2026-10-22. "Default today" = what the code does now.

Sources: `docs/architecture/ADR-*.md` · `docs/product/OPEN_DECISIONS.md` (C-x, OD-x, R-Dx) ·
`docs/integration/crewflex-v13/08-product-decisions.md` (D-x, T-x) ·
`docs/integration/crewflex-v13/03-business-rule-conflicts.md` (R-x).

## Architecture (ADR)

| ID      | Topic                                             | Status                                         |
| ------- | ------------------------------------------------- | ---------------------------------------------- |
| ADR-001 | Edge Functions as backend boundary, RLS mandatory | ACCEPTED 2026-10-09                            |
| ADR-002 | Modular monolith by domain, incremental hardening | PROPOSED 2026-10-15 (owner acceptance pending) |

## Accepted / resolved

| ID            | Topic                                                                                                                                                                   | Where                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| C-1           | Real backend now (no mock-first)                                                                                                                                        | OPEN_DECISIONS                                                              |
| C-2           | Explainable eligibility first, score second                                                                                                                             | OPEN_DECISIONS                                                              |
| C-3           | Hard requirements need `verified`                                                                                                                                       | OPEN_DECISIONS, BR-3                                                        |
| C-4           | Partial availability not eligible in V0                                                                                                                                 | OPEN_DECISIONS, BR-4.4                                                      |
| C-5           | Bilingual ES/EN, fallback `en`                                                                                                                                          | OPEN_DECISIONS, I18N_STRATEGY                                               |
| C-6           | Missing sources recovered                                                                                                                                               | OPEN_DECISIONS                                                              |
| C-7           | Visibility private/anonymous/open in V0                                                                                                                                 | OPEN_DECISIONS, BR-8                                                        |
| OD-2          | Supabase access — CLI linked, deploy executed 2026-10-09                                                                                                                | OPEN_DECISIONS (management API returned 403 on 2026-10-15: re-check access) |
| OD-9          | Main-only, single production environment (TEMPORARY)                                                                                                                    | OPEN_DECISIONS, ENVIRONMENTS                                                |
| D-11          | Tools scope: units, torque, durations now; fuel after a technical review (owner 2026-10-19)                                                                             | 08-product-decisions §Owner decisions of 2026-10-19                         |
| D-13          | Platform admins: «Ver como» switcher over their own account (Técnico/Empresa/Recruiter placeholder/Administración), owner 2026-10-22                                    | 08-product-decisions §Owner decisions of 2026-10-22                         |
| D-06 Q2–Q7    | Application state machine ratified 2026-10-22 for local implementation (Q7: no `accepted → rejected`; T-08…T-14 technical defaults)                                     | `APPLICATIONS_STATE_MACHINE.md` §4, 08-product-decisions §2026-10-22        |
| D-12 (vis.)   | Every professional sees published, current requirements; eligibility separate and explained (2026-10-22, local)                                                         | 08-product-decisions §2026-10-22                                            |
| M05           | Requirement lifecycle: open ↔ paused, closed terminal, edit only without applications (2026-10-22, local)                                                               | 08-product-decisions §2026-10-22                                            |
| D-07 P1/P2/P4 | Candidate Pack direction ratified 2026-10-22 (contact from accepted + consent; clean scanned documents only; identity with contact). P3 OPEN, no third-party access     | `CANDIDATE_PACK.md` §4                                                      |
| Q-01          | Minimum password 12 (2026-10-22, local; production Auth unchanged)                                                                                                      | 08-product-decisions §2026-10-22                                            |
| R-08 (D-06)   | New proposal = new version; explicit acceptance; accepted commitments never changed retroactively (owner 2026-10-19)                                                    | `docs/product/APPLICATIONS_STATE_MACHINE.md` §4                             |
| C-8 / D-05    | AOG = declared urgency; `aog_only` windows count only for `urgency = aog` (owner 2026-10-19)                                                                            | 08-product-decisions §Owner decisions of 2026-10-19                         |
| T-01…T-07     | Technical decisions of the V1.3 audit (single engine, intervals, score 0 when blocked, per-requirement pseudonyms, DB backstops, managers-only workforce, zips ignored) | 08-product-decisions                                                        |

## Open — need a human (blocking first)

Consolidated pack with classes (decided / owner proposal to ratify / Claude proposal / unanswered):
`docs/integration/crewflex-v13/14-decision-pack.md` (2026-10-20). New: **T22** — enable «require current
password» in production Auth (evidence: `docs/product/SECURITY_PRIVACY.md` §T22).

| ID                     | Topic                                                               | Blocks                                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **OD-3 / D-01 / R-D1** | Who verifies qualifications in production, with which evidence      | Direction accepted 2026-10-19 (manual verification by authorised platform admins, evidence + audit). STILL BLOCKED for production: evidence procedure and verifier list not reviewed; `qualification-reviews` + flags stay OFF |
| OD-1                   | Repo owner (personal vs organization)                               | —                                                                                                                                                                                                                              |
| OD-4 / D-09            | Internal workforce visibility without explicit consent              | Member invitations                                                                                                                                                                                                             |
| OD-5 / C-14            | Organization verification (KYB)                                     | "Verified orgs" visibility, external network access policy                                                                                                                                                                     |
| OD-6 / D-04            | Launch countries, work permits                                      | Cross-border needs                                                                                                                                                                                                             |
| OD-7                   | Commercial model                                                    | Payments, AOG premium                                                                                                                                                                                                          |
| OD-8                   | E-mail confirmation policy                                          | —                                                                                                                                                                                                                              |
| OD-10                  | Public GitHub repository intended?                                  | —                                                                                                                                                                                                                              |
| C-9 / D-08             | Requirement terms, rates, logistics, shifts/non-contiguous days     | Need-builder parity, partial staffing                                                                                                                                                                                          |
| C-10 / D-02 / D-03     | Matching inputs: rating restrictions, min experience, English, rate | Safe matching for certifying roles                                                                                                                                                                                             |
| C-11                   | Audio-derived founder decisions                                     | —                                                                                                                                                                                                                              |
| C-12                   | Brand identity (S1 light/orange vs S4/S5 dark/cyan)                 | Marketing site                                                                                                                                                                                                                 |
| C-13                   | Multi-vertical core                                                 | — (strategy only)                                                                                                                                                                                                              |
| C-15                   | Launch order (supply-first vs demand-first)                         | Go-to-market                                                                                                                                                                                                                   |
| D-06                   | Application state machine                                           | RATIFIED 2026-10-22 (local) — see Accepted. Production activation still needs OD-3 (nobody verified) and a separate deploy authorisation                                                                                       |
| D-07 P3                | Candidate Pack: access-log retention period                         | P1/P2/P4 ratified 2026-10-22 (direction). **P3 open (legal)** + scanner (D-10): third-party document access stays OFF                                                                                                          |
| D-10                   | Document scanning before third-party access                         | Direction accepted 2026-10-19 (private Storage). Third-party sharing blocked until a scanning mechanism is approved                                                                                                            |
| D-12 (recruiter)       | Recruiter model                                                     | Provisional model 2026-10-19 (agency organization + represented clients). Implementation later. Visibility part ratified 2026-10-22 (Accepted)                                                                                 |
| R-D2                   | Idempotency key retention                                           | — (ops)                                                                                                                                                                                                                        |
| R-D3                   | External pool beyond 100: paginate or keep cap + notice             | Large networks                                                                                                                                                                                                                 |
| R-D4                   | May `draft` requirements stay incomplete                            | Draft UI                                                                                                                                                                                                                       |
| R-D5                   | Passport completeness definition                                    | —                                                                                                                                                                                                                              |

## Proposed reject / superseded

| ID                                  | Topic                                      | State                                                |
| ----------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| C-16                                | Reputation and distance in ranking         | PROPOSED REJECT                                      |
| Staging environment (pre-OD-9 plan) | `feat/crewflex-parity-migration` `4400efd` | SUPERSEDED by OD-9 (do not create a staging project) |
| V1.3 75/25 affinity score           | —                                          | REJECTED by T-03                                     |
| V1.3 stable `T-<uuid>` refs         | —                                          | REJECTED by T-04                                     |
