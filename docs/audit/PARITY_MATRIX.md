# Parity matrix — real functionality (phase 1.6 review, 2026-10-11)

Derived from `FEATURE_INVENTORY.md` (87 rows: 55 from S1/S2/brief + 32 recovered from S4–S8). This
revision re-audited every row against the code on `main` and the LOCAL Docker stack; the narrative is in
`FULL_FUNCTIONAL_REVIEW.md`. Statuses (allowed vocabulary):

- **VERIFIED_LOCAL** — exercised end to end on the local stack (E2E over the Edge Functions, PGlite RLS
  tests and/or the browser smoke in ES and EN) with the evidence named in the row.
- **IMPLEMENTED_UNVERIFIED** — code and unit/RLS tests exist, no end-to-end run of that specific behaviour.
- **PARTIAL** — part of the source behaviour exists.
- **UI_ONLY** — rendered, not backed by persistence. **MOCKED** — fake data in the app (none).
- **SOURCE_ONLY** — only in a prototype/source. **NOT_FOUND** — expected by brief/S1, absent.
- **BLOCKED** — waits on a decision or a remote action. **DEFERRED** — consciously out of this phase.

Columns: Next UI = route/component · EF = Edge Function · PG = tables/functions · RLS = policy coverage ·
ES/EN = both languages verified on that screen (✓) · Tests = automated evidence.

## A · Platform / account

| ID         | Functionality                            | HTML ref                    | Next UI                          | EF                 | PG                           | RLS               | ES  | EN  | Tests                                              | Status                                                                                        |
| ---------- | ---------------------------------------- | --------------------------- | -------------------------------- | ------------------ | ---------------------------- | ----------------- | --- | --- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| CF-A01     | Sign up (professional / org)             | S1 role switch (demo)       | `/register` `RegisterForm`       | — (Supabase Auth)  | trigger `handle_new_user`    | insert by trigger | ✓   | ✓   | `auth.test.ts`, RLS "sign-up trigger"              | IMPLEMENTED_UNVERIFIED (remote needs e-mail confirmation; local sign-up not exercised in E2E) |
| CF-A02     | Sign in / out / session                  | —                           | `/login`, shell sign-out         | —                  | —                            | —                 | ✓   | ✓   | smoke 1/7, E2E 1/9a                                | VERIFIED_LOCAL                                                                                |
| CF-A03     | Role switch demo                         | S1 topbar                   | — (real auth instead)            | —                  | —                            | —                 | —   | —   | —                                                  | DEFERRED (demo artefact)                                                                      |
| CF-A04     | Notifications centre                     | S1 `notifications`          | absent                           | —                  | —                            | —                 | —   | —   | —                                                  | NOT_FOUND                                                                                     |
| CF-A05     | Audit trail UI                           | S1 settings tab             | absent (table + triggers only)   | —                  | `audit_events` (append-only) | admin read        | —   | —   | RLS "audit"                                        | PARTIAL                                                                                       |
| CF-A06     | Reset demo data                          | S1                          | —                                | —                  | —                            | —                 | —   | —   | —                                                  | DEFERRED (demo artefact)                                                                      |
| CF-A07     | Mobile preview toggle                    | S1                          | — (responsive layout instead)    | —                  | —                            | —                 | ✓   | ✓   | smoke @768/@390                                    | DEFERRED (demo artefact)                                                                      |
| **CF-A08** | **Settings + language preference (new)** | S1 `settings` tab (partial) | `/app/settings` `LocaleSwitcher` | `user-preferences` | `profiles.preferred_locale`  | own only          | ✓   | ✓   | E2E 15/15b, RLS G, smoke 5h–5m/11c, `resolve.test` | VERIFIED_LOCAL                                                                                |

## B · Professional identity

| ID     | Functionality                                   | HTML ref           | Next UI                                                    | EF                            | PG                                                   | RLS                 | ES  | EN  | Tests                                 | Status                                                            |
| ------ | ----------------------------------------------- | ------------------ | ---------------------------------------------------------- | ----------------------------- | ---------------------------------------------------- | ------------------- | --- | --- | ------------------------------------- | ----------------------------------------------------------------- |
| CF-B01 | Professional dashboard                          | S1 `home`          | `/app/professional` (passport %, counts)                   | — (RLS read)                  | profiles, technician_*                               | own                 | ✓   | ✓   | smoke 2/5i                            | PARTIAL (no opportunities/applications widgets)                   |
| CF-B02 | Passport identity (name, base)                  | S1 step 1          | `/app/professional/profile` `ProfileForm`                  | `professional-profile`        | profiles.display_name, technician_profiles           | own                 | ✓   | ✓   | E2E 11, RLS F, smoke 5b/5c, Deno      | VERIFIED_LOCAL (e-mail/phone/employer not modelled → SOURCE_ONLY) |
| CF-B03 | Licences, type ratings, declaration             | S1 step 2          | `/app/professional/qualifications` `QualificationsManager` | `professional-qualifications` | technician_qualifications                            | own, pending forced | ✓   | ✓   | E2E 12–14, RLS D/F, smoke 5d–5g, Deno | VERIFIED_LOCAL                                                    |
| CF-B04 | Years, English, engines, skills, courses        | S1 step 3          | years + courses only                                       | profile / qualifications      | technician_profiles.years_experience, TRAINING types | own                 | ✓   | ✓   | as B02/B03                            | PARTIAL (English, engines, skills → OD C-10)                      |
| CF-B05 | Rate, shift pattern, mobility, tools, countries | S1 step 4          | mobility + status only                                     | `professional-profile`        | technician_profiles.mobility/current_status          | own                 | ✓   | ✓   | as B02                                | PARTIAL (rate, pattern, tools, countries → OD C-9/C-10)           |
| CF-B06 | Passport summary + completeness                 | S1 step 5 / `ga()` | overview metric + next step                                | —                             | derived (`profileCompleteness`)                      | —                   | ✓   | ✓   | `professional.test.ts`, smoke 2       | VERIFIED_LOCAL                                                    |

## C · Availability

| ID     | Functionality                   | HTML ref      | Next UI                          | EF                          | PG                   | RLS  | ES  | EN  | Tests                                    | Status              |
| ------ | ------------------------------- | ------------- | -------------------------------- | --------------------------- | -------------------- | ---- | --- | --- | ---------------------------------------- | ------------------- |
| CF-C01 | View calendar + windows         | S1 `calendar` | `/app/professional/availability` | `professional-availability` | availability_windows | own  | ✓   | ✓   | smoke 3, 5k                              | VERIFIED_LOCAL      |
| CF-C02 | Add window / mark day           | S1            | same                             | same (POST)                 | same                 | own  | ✓   | ✓   | E2E 2, smoke 3                           | VERIFIED_LOCAL      |
| CF-C03 | Edit window / day state         | S1            | same                             | same (PATCH)                | same                 | own  | ✓   | ✓   | E2E 3a/4, smoke 4                        | VERIFIED_LOCAL      |
| CF-C04 | Delete window / clear day       | S1            | same                             | same (DELETE)               | same                 | own  | ✓   | ✓   | E2E 3b/5, smoke 5                        | VERIFIED_LOCAL      |
| CF-C05 | "Solo AOG" day state            | S1            | absent                           | —                           | enum change needed   | —    | —   | —   | —                                        | BLOCKED (OD C-8)    |
| CF-C06 | Shift pattern generator         | S1            | absent                           | —                           | —                    | —    | —   | —   | —                                        | SOURCE_ONLY         |
| CF-C07 | Assigned days                   | S1            | absent (needs applications)      | —                           | —                    | —    | —   | —   | —                                        | NOT_FOUND (phase 6) |
| CF-C08 | Matching uses real availability | S1 `sd()`     | matches page                     | `matching-evaluate`         | RPC pool             | role | ✓   | ✓   | `matching.test.ts`, E2E 14, smoke 11/11e | VERIFIED_LOCAL      |

## D · Documents (wallet)

| ID         | Functionality                                           | HTML ref  | Next UI | EF  | PG                  | RLS | ES  | EN  | Tests | Status                              |
| ---------- | ------------------------------------------------------- | --------- | ------- | --- | ------------------- | --- | --- | --- | ----- | ----------------------------------- |
| CF-D01–D05 | Upload / list / download / remove / verification status | S1 `docs` | absent  | —   | — (Storage PLANNED) | —   | —   | —   | —     | NOT_FOUND (next phase, by decision) |

## E · Opportunities & applications

| ID         | Functionality                                                           | HTML ref                        | Next UI | EF  | PG  | RLS | ES  | EN  | Tests | Status              |
| ---------- | ----------------------------------------------------------------------- | ------------------------------- | ------- | --- | --- | --- | --- | --- | ----- | ------------------- |
| CF-E01–E06 | Browse, detail, apply, my applications, state machine, per-day coverage | S1 `jobs`/`apply`/`fh()`/`Li()` | absent  | —   | —   | —   | —   | —   | —     | NOT_FOUND (phase 6) |

## F · Organization

| ID     | Functionality                  | HTML ref          | Next UI                                          | EF                                       | PG                                    | RLS            | ES  | EN  | Tests                                               | Status                                                 |
| ------ | ------------------------------ | ----------------- | ------------------------------------------------ | ---------------------------------------- | ------------------------------------- | -------------- | --- | --- | --------------------------------------------------- | ------------------------------------------------------ |
| CF-F01 | Org dashboard (capacity-first) | S1 `home`         | `/app/organization`                              | `work-requirements`, `capacity-evaluate` | work_requirements                     | member/manager | ✓   | ✓   | smoke 8/10/11c                                      | VERIFIED_LOCAL (S1 metrics differ by design)           |
| CF-F02 | Create need                    | S1 `create`       | `/requirements/new` `RequirementForm`            | `work-requirements` POST                 | RPC `create_work_requirement` + audit | admin/manager  | ✓   | ✓   | E2E 6/9b, smoke 12/11f/11g, `work-requirement.test` | VERIFIED_LOCAL (reduced fields → OD C-9)               |
| CF-F03 | Requirements list              | S1 `manage`       | `/requirements` (no filters/search)              | `work-requirements` GET                  | work_requirements                     | member         | ✓   | ✓   | smoke 9                                             | PARTIAL                                                |
| CF-F04 | Requirement detail             | S1                | `/requirements/[id]` + capacity + internal cards | `capacity-evaluate`                      | —                                     | member/manager | ✓   | ✓   | smoke 10/14/15                                      | VERIFIED_LOCAL                                         |
| CF-F05 | Pause / status transitions     | S1                | absent (policy exists)                           | —                                        | `work_requirements_update_manager`    | manager        | —   | —   | —                                                   | PARTIAL                                                |
| CF-F06 | Search candidates              | S1 `candidates`   | `/requirements/[id]/matches`                     | `matching-evaluate`                      | RPC pool                              | admin/manager  | ✓   | ✓   | E2E 8/10, smoke 11/11b/11d/11e                      | VERIFIED_LOCAL (compare/drawer/search → PARTIAL vs S1) |
| CF-F07 | Pipeline actions               | S1 `applications` | absent                                           | —                                        | —                                     | —              | —   | —   | —                                                   | NOT_FOUND (phase 6)                                    |
| CF-F08 | Internal workforce list        | brief             | `/workforce` `WorkforceList`                     | — (RLS read)                             | organization_members + joins          | admin/manager  | ✓   | ✓   | RLS F "admins read", smoke nav                      | VERIFIED_LOCAL                                         |
| CF-F09 | Organization settings          | S1 `settings`     | absent (account settings only)                   | —                                        | `organizations_update_admin`          | admin          | —   | —   | —                                                   | PARTIAL                                                |
| CF-F10 | Members / invitations          | S2                | absent                                           | —                                        | policies exist, no insert path        | admin          | —   | —   | RLS C                                               | NOT_FOUND (phase 4)                                    |
| CF-F11 | Recruiter mode                 | S1 + S2           | absent                                           | —                                        | —                                     | —              | —   | —   | —                                                   | SOURCE_ONLY                                            |

## G · Matching, capacity, urgency

| ID     | Functionality                             | HTML ref         | Next UI            | EF                  | PG       | RLS  | ES  | EN  | Tests                                          | Status                                 |
| ------ | ----------------------------------------- | ---------------- | ------------------ | ------------------- | -------- | ---- | --- | --- | ---------------------------------------------- | -------------------------------------- |
| CF-G01 | Deterministic hard filters + explanations | S1 `je()`        | `MatchCard`        | `matching-evaluate` | RPC pool | role | ✓   | ✓   | 17 domain tests, `explain.test`, smoke 11b/11e | VERIFIED_LOCAL (same results in ES/EN) |
| CF-G02 | Soft score                                | S1               | shown for eligible | same                | —        | —    | ✓   | ✓   | domain tests                                   | PARTIAL (inputs → OD C-10)             |
| CF-G03 | Capacity board                            | brief            | `CapacityOverview` | `capacity-evaluate` | —        | role | ✓   | ✓   | E2E 7, smoke 10, `capacity.test`               | VERIFIED_LOCAL                         |
| CF-G04 | Urgency on needs                          | S1 + S2          | chips / form       | `work-requirements` | enum     | —    | ✓   | ✓   | smoke 9/12                                     | VERIFIED_LOCAL                         |
| CF-G05 | AOG distribution                          | S1 `dispatchAog` | absent             | —                   | —        | —    | —   | —   | —                                              | NOT_FOUND (phase 7)                    |
| CF-G06 | AOG / WhatsApp opt-in, quiet hours        | S1 `privacy`     | absent             | —                   | —        | —    | —   | —   | —                                              | SOURCE_ONLY (phase 7)                  |

## H · Privacy

| ID     | Functionality                 | HTML ref     | Next UI                     | EF                     | PG                             | RLS     | ES  | EN  | Tests                            | Status                                          |
| ------ | ----------------------------- | ------------ | --------------------------- | ---------------------- | ------------------------------ | ------- | --- | --- | -------------------------------- | ----------------------------------------------- |
| CF-H01 | Visibility modes              | S1 `privacy` | passport §03 (3 cards)      | `professional-profile` | technician_profiles.visibility | own     | ✓   | ✓   | E2E 11, RLS F, smoke 10-passport | VERIFIED_LOCAL ("verified orgs" level → OD C-7) |
| CF-H02 | Block current employer        | S1           | absent                      | —                      | —                              | —       | —   | —   | —                                | SOURCE_ONLY                                     |
| CF-H03 | Anonymised candidate view     | S1 `ir()`    | matches (pseudonymous refs) | `matching-evaluate`    | RPC pool                       | definer | ✓   | ✓   | RLS "enumeration", smoke 11      | VERIFIED_LOCAL                                  |
| CF-H04 | Contact released with consent | S1           | absent                      | —                      | —                              | —       | —   | —   | —                                | NOT_FOUND (phase 6)                             |

## I · Logbook & tools

| ID     | Functionality | HTML ref     | Next UI | EF  | PG  | RLS | ES  | EN  | Tests | Status      |
| ------ | ------------- | ------------ | ------- | --- | --- | --- | --- | --- | ----- | ----------- |
| CF-I01 | Logbook       | S1 `logbook` | absent  | —   | —   | —   | —   | —   | —     | NOT_FOUND   |
| CF-I02 | Tools hub     | S1 `tools`   | absent  | —   | —   | —   | —   | —   | —     | SOURCE_ONLY |

## J–M · Candidates recovered from S4–S8 (32 rows)

Unchanged from the Phase 0.6 classification except where phase 1/1.5 code now covers them:

| ID                                                                                                                                       | Functionality                                                                 | Status (this review)                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| CF-L02                                                                                                                                   | Private by default                                                            | VERIFIED_LOCAL (seed/sign-up default; smoke "no private Hotel") |
| CF-L03                                                                                                                                   | Completeness hint                                                             | VERIFIED_LOCAL (BR-11, overview metric + next step)             |
| CF-K16                                                                                                                                   | Publish-time compatible/available counts                                      | PARTIAL (capacity after create)                                 |
| CF-K17                                                                                                                                   | Blocking document shown to technician                                         | PARTIAL (org side only)                                         |
| CF-L11                                                                                                                                   | Ineligible listed with reason                                                 | PARTIAL (org side only)                                         |
| CF-J01, J03, J04, J10, J11, J12, J13, J15, M02, M04, M07, M09, K01, K06, K07, K08, K09, K12, K15, K19, L01, L04, L05, L07, L09, L10, L13 | SOURCE_ONLY (open decisions C-7/C-9/C-10/C-12/C-13/C-14/OD-7 or later phases) |

## Totals (88 rows: 87 + CF-A08 added by this review)

| Status                 | Count | Rows                                                                                              |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| VERIFIED_LOCAL         | 22    | A02, A08, B02, B03, B06, C01–C04, C08, F01, F02, F04, F06, F08, G01, G03, G04, H01, H03, L02, L03 |
| IMPLEMENTED_UNVERIFIED | 1     | A01 (sign-up end to end needs a confirmed e-mail flow)                                            |
| PARTIAL                | 10    | A05, B01, B04, B05, F03, F05, F09, G02, K16, K17, L11 (11 incl. K/L rows)                         |
| UI_ONLY                | 0     | —                                                                                                 |
| MOCKED                 | 0     | no mocks in the Next.js app                                                                       |
| SOURCE_ONLY            | 34    | C06, F11, G06, H02, I02 + 29 recovered rows                                                       |
| NOT_FOUND              | 15    | A04, C07, D01–D05, E01–E06, F07, F10, G05, H04, I01                                               |
| BLOCKED                | 1     | C05 (OD C-8)                                                                                      |
| DEFERRED               | 3     | A03, A06, A07 (demo artefacts)                                                                    |

Counting note: row groups (C01–C04, D01–D05, E01–E06) are counted per ID. PARTIAL = 11 when K16/K17/L11
are included (the "10" above lists the original-source rows plus them: 8 original + 3 recovered).

## Remaining P0 problems

1. None of the phase 1/1.5 functions (`professional-profile`, `professional-qualifications`,
   `user-preferences`) nor migration `20261011120000` are deployed: the deployed product still shows
   the read-only professional pages and no Settings. Requires explicit authorization.
2. Sign-up (CF-A01) is not exercised end to end locally because the local Auth config also requires
   e-mail confirmation (Mailpit available at 127.0.0.1:56324; a future smoke can read the link there).
