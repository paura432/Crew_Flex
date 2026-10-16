# Full functional review — Crew Flex on `main` (phase 1.6, 2026-10-11, local only)

Scope: every route, component, Edge Function, table and policy on `main` after phases 1 (passport +
qualifications) and 1.5 (ES/EN), checked against `CrewFlex_v1.1.html` (S1), the S4–S8 sources, the
blueprint and `FEATURE_INVENTORY.md`. Everything was exercised on the LOCAL Docker stack with the 22
synthetic accounts; production (`sbjkzrkmcekokkqiuvvh`), Vercel and remote secrets were not touched.
The per-feature verdicts are in `PARITY_MATRIX.md`; this document records how they were reached.

## 1. Sources re-read

S1 prototype (state model `tech-me`, `je()` matching, `fh()` pipeline, `wh()` privacy, `kh()` passport,
calendar), S4 aviation landing, S5 corporate one-pager, S6 Lutes Recrew, S7 JobSlice mobile demo, S2
blueprint, S8 proposal — all previously inventoried (`SOURCE_INVENTORY.md`). No feature outside the 87
rows was found in them; **one feature the app has and the inventory lacked** was added: **CF-A08
Settings + language preference** (S1 has a settings tab with demo controls, never a language choice).
Duplicates: none. Omitted from the matrix before and now explicit: the 404 page, the app error boundary
and the loading state (counted under CF-A02/shell, not as features).

## 2. Route sweep (every page opened, in ES and EN)

| Route                                         | Reachable from nav | Roles tested                                                     | Result |
| --------------------------------------------- | ------------------ | ---------------------------------------------------------------- | ------ |
| `/`                                           | public             | anonymous (es/en/fr/cookie)                                      | OK     |
| `/login`, `/register`                         | public             | anonymous; signed-in users are redirected                        | OK     |
| `/app` (redirect by account)                  | brand link         | professional → `/app/professional`, org → `/app/organization`    | OK     |
| `/app/professional`                           | Overview           | delta, echo (external); alpha/charlie (internal)                 | OK     |
| `/app/professional/profile`                   | Passport           | delta edit/persist; echo isolation                               | OK     |
| `/app/professional/qualifications`            | Qualifications     | delta declare/edit/remove; B isolation                           | OK     |
| `/app/professional/availability`              | Availability       | delta CRUD + reload                                              | OK     |
| `/app/organization`                           | Dashboard          | admin.mro (capacity), charlie (member: no capacity), manager.mro | OK     |
| `/app/organization/requirements`              | Requirements       | admin.mro (only own org rows)                                    | OK     |
| `/app/organization/requirements/new`          | New requirement    | admin.mro create; charlie → permission state                     | OK     |
| `/app/organization/requirements/[id]`         | list links         | admin.mro; admin.other → 404                                     | OK     |
| `/app/organization/requirements/[id]/matches` | capacity CTA       | admin.mro (3 of 10 eligible); admin.other → 404                  | OK     |
| `/app/organization/workforce`                 | Workforce          | admin.mro                                                        | OK     |
| `/app/settings`                               | Settings (all)     | delta, admin.mro                                                 | OK     |
| 404 / error boundary                          | —                  | cross-org requirement                                            | OK     |

No inaccessible route or component was found: every `page.tsx` is linked from the shell or from a page,
and the dead-export scan (`FULL_FUNCTIONAL_REVIEW.md` §4) found only pre-existing helpers.

## 3. Domain-by-domain findings

### Identity

Registration, login, logout, session refresh, redirects and the new Settings/preferences are real and
verified locally (E2E 1/9a/15/15b, smoke 1/7/5h–5m). Sign-up is implemented but not exercised end to end
(e-mail confirmation required locally too; Mailpit could be wired into the smoke later). Roles come from
the database (`organization_members`, `platform_role`), never from the client (RLS C, E, F, G).

### Professional

Dashboard (completeness + next step), passport, qualifications and availability are real, persisted via
Edge Functions and verified in both languages. Gaps vs S1: contact fields, employer + block, English
level, engines, skills, rate, countries, tools, shift pattern (open decisions C-9/C-10, CF-H02), "Solo
AOG" day state (C-8), pattern generator. Verification remains privileged: no API path can set `verified`.

### Wallet documental

Absent (CF-D01–D05 NOT_FOUND). Storage bucket, documents table, signed URLs and verification linkage are
the next phase by decision; the qualification model already carries the review state a document would attach to.

### Organizations

Dashboard, requirement creation, detail, capacity and workforce are real. Missing: organization settings
(CF-F09), member invitations with consent (CF-F10, no insert path by design), requirement status
transitions UI (CF-F05, policy exists), list filters/search (CF-F03), economics/logistics/day-list fields (C-9).

### Matching

Deterministic, explainable, identical in ES and EN (smoke 11/11e: "3 eligible of 10" = "3 elegibles de
10", same blockers). Hard filters, soft score, availability coverage, pseudonymous external refs, private
profiles excluded, cross-organization 404s. Missing vs S1: compare view, candidate drawer, text search,
soft inputs beyond qualifications (C-10), reputation/distance rejected (C-16).

### Marketplace

Opportunities, applications, state machine, Candidate Pack, messaging: NOT_FOUND (phase 6). The
professional side cannot see or apply to requirements; the organization side has no pipeline.

### Operaciones urgentes

Urgency is stored and displayed (planned/urgent/AOG); AOG distribution, notifications, opt-ins, quiet
hours are absent (phase 7, FD-24).

### Herramientas profesionales

Logbook and tools hub absent (S1 client-side utilities); SOURCE_ONLY/NOT_FOUND, phase 7.

## 4. Code-level checks

- English text left in JSX: grep for capitalised sentences inside tags → 0 hits after phase 1.5.
- Dead exports (heuristic scan): `buttonClass`, `requirementQualificationInput`, `MAX_WINDOW_DAYS`,
  `dayStart`, `toDate`, `Constants` pre-existed (public helpers); phase 1.5 leftovers were removed.
- No `service_role` in `src/` (hygiene test), identity never from the client (strict schemas, E2E 11/12/15).
- Matching logic untouched by i18n: `src/domain/*` unchanged; explanations became structured keys with
  a test asserting the same structure (`explain.test.ts`).

## 5. Role walk-through (local accounts, password `crewflex-local-only`)

| Account                            | Scenario                     | Access / nav                | Allowed                                          | Denied                                         | Language                                                  |
| ---------------------------------- | ---------------------------- | --------------------------- | ------------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------- |
| delta (external, valid, anonymous) | eligible for MAD             | professional nav + Settings | passport, qualifications, availability, language | organization area (redirect/404)               | ES/EN persisted (smoke 5h–5m)                             |
| golf (B1.1 pending)                | not verified → blocked       | same                        | same                                             | —                                              | n/a (seen from matching)                                  |
| bravo (FTS expired, internal)      | expired → blocked internally | professional nav            | same                                             | —                                              | matching shows "caducada/expired"                         |
| hotel (private)                    | never in pools               | professional nav            | same                                             | —                                              | smoke "no private Hotel"                                  |
| india/kilo (partial availability)  | partial → blocked            | —                           | —                                                | —                                              | "Available for only 48.78%" / "Disponible solo el 48.78%" |
| quebec (no windows)                | not available                | —                           | —                                                | —                                              | BCN AOG need                                              |
| admin.mro (MRO admin)              | capacity, matching, create   | org nav + Settings          | create, capacity, matches, workforce             | other org's requirement (404)                  | ES/EN (smoke 11c–11g)                                     |
| admin.other (2nd org)              | isolation                    | org nav                     | own org                                          | MAD requirement + matches (404)                | EN                                                        |
| charlie (member)                   | no capacity                  | org nav                     | list, detail facts                               | capacity analysis, new requirement             | EN                                                        |
| manager.mro                        | capacity                     | org nav                     | capacity                                         | —                                              | EN                                                        |
| echo (professional B)              | isolation                    | professional nav            | own rows                                         | A's passport/qualifications/windows/preference | EN                                                        |

## 6. Integration flows (local Supabase, no mocks)

| Flow | Steps                                                                    | Evidence                         | Result |
| ---- | ------------------------------------------------------------------------ | -------------------------------- | ------ |
| 1    | Login → Passport → Edit → Save → Reload                                  | smoke 5b, E2E 11                 | PASS   |
| 2    | Passport → Declare qualification → pending → Matching                    | smoke 5d–5g, E2E 12/14           | PASS   |
| 3    | Availability → Edit window → Save → Matching                             | smoke 3–5, E2E 2–5, domain tests | PASS   |
| 4    | Organization → Create need → Capacity → Gap → Matching                   | smoke 12/10/11, E2E 6/7/8        | PASS   |
| 5    | Org A → Org B's data → denied                                            | smoke 13/13b, E2E 10, RLS B      | PASS   |
| 6    | Settings → Español → Navigate → Reload → Spanish kept                    | smoke 5i–5l                      | PASS   |
| 7    | Settings → English → Sign out → Sign in → English kept (cookies cleared) | smoke 5m, E2E 15                 | PASS   |

## 7. Visual review vs S1

Kept: navy sidebar, orange CF mark, light canvas, panel/metric cards, chip vocabulary, calendar grid,
passport sections, visibility option cards (S1 `visibility-grid`), step-numbered form sections. Differences
(by design, `VISUAL_PARITY.md`): English/Spanish copy instead of Spanish-only, capacity-first dashboard,
no demo topbar, no wizard stepper (single form). Spanish copy is longer; the smoke confirms no horizontal
overflow at 1440/768/390 on passport, qualifications, settings, organization dashboard and matches in ES.
Screenshots: `docs/audit/evidence/local-14…21-*.jpg`.

## 8. Security

Verified again after i18n: JWT via `getClaims`, owner = JWT subject in all five professional/user
functions, RLS second layer (tests A–G), strict schemas reject identity/privileged fields (E2E 11/12/15),
`verification_status` never writable, private profiles never enumerated, no service role in the
frontend, language preference isolated per user (RLS G, E2E 15), matching results identical in both
languages (smoke 11e). Error messages: codes only; `issues[].message` are keys, never SQL or stack details.

## 9. Regressions

None observed: all previous E2E (13) and smoke checks pass; the phase 1 checks pass; domain tests
unchanged. Two behaviours changed on purpose: date format is now day · month · year via locale patterns
(was `en-GB` hardcoded — same output in English), and validation/API issues carry keys instead of prose.

## 10. Classification of missing work (dependency / priority)

1. **Deploy** phase 1/1.5 (functions + migration) — blocks every professional-side and language feature
   in production. Authorization needed.
2. **Verifier flow** (privileged, audited) — the only way a hard requirement can ever be met by a new
   professional; depends on OD-3 (who verifies).
3. **Wallet documental** (CF-D01–D05) — depends on 2 for linkage semantics; private bucket + signed URLs.
4. **Organization settings + invitations** (CF-F09/F10) — independent; unlocks internal workforce growth.
5. **Requirement lifecycle** (CF-F05, F03) — independent, small.
6. **Model decisions** C-7/C-14 (verified orgs), C-8 (AOG day), C-9 (offer richness), C-10 (soft inputs) —
   gate B04/B05/C05/G02/J*/K*/L*.
7. **Marketplace** (E01–E06, F07, H04, C07) — depends on 2–6.
8. **Urgent ops, tools, logbook, notifications** (G05/G06, I01/I02, A04, K07) — last.
