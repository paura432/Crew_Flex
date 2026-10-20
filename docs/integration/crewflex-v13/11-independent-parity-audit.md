# 11 · Independent parity audit (second pass) — v1.8 → Next.js + Supabase

Audited 2026-10-20 on local `main` from `debad65` (baseline) to the batch commits listed in §10.
Production is unchanged: `origin/main` = `65df3b9` (release 1). Nothing was pushed or deployed.
**Migration target = CrewFlex v1.8** (owner, 2026-10-20). v1.1 and v1.3 are context only: they
explain where a v1.8 behaviour came from, they never add scope by themselves.

This document does not replace `10-master-matrix.md`; it audits it. Method: four independent read-only
audits of the v1.8 sources (connected server, demo/beta frontend, reverse Next.js → original, VERIFIED_LOCAL
re-verification), plus a v1.3 → v1.8 file diff, a v1.1 bundle extraction, a CSS/token diff and an
independent security review of each new commit. Every claim below cites `file:line`; `A:` =
`server/app.mjs`, `R:` = `server/rules.mjs`, `N:` = `server/connected.mjs` (v1.8).

## 1. Git baseline (verified 2026-10-20)

| Item               | Value                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Branch / HEAD      | `main`, clean tree at start, `debad65`                                                                          |
| `origin/main`      | `65df3b9` (production); local `main` **ahead by 15 commits**, behind by 0. No push in this audit                |
| Worktrees          | `../cf-r1` (`65df3b9`), `../cf-r1a` (`2216d38`), two prunable scratch worktrees of an earlier session           |
| Batches re-checked | `d86f577` (matrix), `ee9161f` (M01), `9604a80` (M06), `09da65f` (M02), `debad65` (M10/M04) — diffs read in full |

## 2. Source integrity — the zips, contrasted file by file

| Source                       | Location                                                         | Integrity                                                                                                                                                                        |
| ---------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v1.8** `CrewFlex_v1.8.zip` | `tmp/` and `C:\Users\perfo\Downloads` (same size)                | sha256 `53ee5b61…5af6`, 126 files. Fresh extraction **identical** (`diff -rq`) to `tmp/references/crewflex-v18`. `RELEASE_MANIFEST.json`: **125/125 hashes match**, 70 tests     |
| v1.3 `…v1.3_Unificada.zip`   | repo root (git-ignored) = Downloads copy (same sha256)           | sha256 `6bfa7f36…109c`, 88 files; extraction identical to `tmp/references/crewflex-v13`                                                                                          |
| v1.1 `CrewFlex_v1.1.html`    | `C:\Users\perfo\Downloads` (305 516 B, sha256 `63b18990…`)       | **Available.** `10-master-matrix.md` said «v1.1: NOT AVAILABLE» — wrong (`09-v18-delta.md:17` had located it). Compiled Vite bundle (React 18.3.1), audited by string extraction |
| Design prototypes            | `tmp/crew-flex-fuentes-faltantes.zip`, `crew-flex-fable-5.1.zip` | S3–S5 HTML + JobSlice PDF; covered by `docs/audit/sources/` — not migration targets                                                                                              |

**v1.8 file coverage.** All 126 files were read by at least one audit: `server/*` (4), `src/beta/*` (7),
`src/features/*` (15), `src/tools/*` (4), `components/v11/*` (11), `context/`, `data/`, `business.js`,
`storage.js`, `domain.js`, 9 CSS files, 12 test files, 13 docs. `dist/` and `CrewFlex_v1.8.html` are build
output of the same sources (manifest-verified), not audited separately. **There is no `v16.css`** in v1.8.
Unreachable legacy code confirmed DEAD: `components/screens/*`, `components/company/*`, `Header.jsx`,
`Navbar.jsx`, `features/AdminDemo.jsx` — **correction:** `features/AdminOverview.jsx` is live (imported under
the alias `AdminDemo`, `LegacyApp.jsx:17`).

**v1.3 → v1.8 diff** (`diff --strip-trailing-cr`; v1.8 uses CRLF, so a plain `diff -rq` overstates it):
64 files identical, 20 modified, 2 build bundles replaced, 0 sources deleted. v1.8-only: `server/connected.mjs`,
`src/beta/{ConnectedCalendar,ConnectedDirectory,ConnectedHome,ConnectedShell,Operations}.jsx`,
`connectedModel.js`, `src/features/*` (15), `demoWorld.js`, `v14/v15/v17/v18.css`, 5 tests, docs V1.4–V1.8.
Behaviour changes v1.3 → v1.8 that matter for the target:

| #   | v1.3                                             | v1.8 (the target)                                                                                     |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| R1  | 6 rotations; 5x2/Noche/Partido follow weekdays   | 14 rotations anchored on a chosen day + custom ≤31 (`features/planning.js:1-15`) — ported (release 1) |
| R2  | Candidate detail shows engines, skills, training | No engines in the directory (`features/CandidateDirectory.jsx`)                                       |
| R3  | Dashboard «renew» list of expiring documents     | Gone from `TechnicianHome`; the 60-day list lives in the passport (`Badges.jsx:8-10`)                 |
| R4  | Connected profile edits UTC intervals            | Day calendar `ConnectedCalendar` + `availability.save` with version (A:77-81)                         |
| R5  | `profile.save` 100 intervals, no version         | 400 intervals, 409 on stale version, refuses to drop confirmed coverage (A:64-68)                     |
| R6  | `eligible`: one category, plain coverage         | `categories[]`, `aogOnly` only for AOG + opt-in, licence/rating checks (R:27)                         |
| R7  | Confirm without licence gate                     | Confirm needs a reviewed, clean licence document in the pack when required (A:125)                    |
| R8  | Accept needs only `acceptTerms`                  | Requires a proposal; stores `acceptedTerms` + `jobSnapshot` server-side (A:118-119)                   |
| R9  | Directory visible to admins too                  | Company and recruiter only, per-job `candidateFit` (A:56, N:33,39)                                    |
| R10 | No commissions/notifications                     | Commission recognised/draft/void; notification on every transition; read state (A:130-138,200)        |

`Cambios.md` (v1.3) checked: every code claim TRUE; «Finalizar» explanation is only a `title` tooltip.

**v1.1** (context): 9-item technician nav; 6 patterns; no learning/badges; 75/25 affinity score; 45-day expiry;
manual urgency «Modo operativo»; commission only a «3–4 % hypothesis». Lost by v1.8: the PCP glossary entry and
the hand-picked urgency (which the owner re-adopted: C-8/D-05, AOG is declared). Errors about S1 in
`docs/audit/HTML_COMPARISON.md`: categories list incomplete (12, not 8), English A1–C2 (not A2), `5x2` missing,
logistics fields `flights/hotel/car/meals`, application `source` values `direct/recruiter-demo/company-demo`.

## 3. What v1.8 actually is (two products)

1. **Connected app** (`server/app.mjs`, 203 lines + `connected.mjs`, `rules.mjs`, `scanner.mjs`): Node +
   SQLite, invite-only accounts, every write in `BEGIN IMMEDIATE`, optimistic versions only on
   `profile.save`/`availability.save`, CSRF + Origin + JSON-only + body caps, audit on every action.
   This is the **functional reference** for persistence, authorization and state machines.
2. **Demo** (IndexedDB `crewflex-v12`, 108 fictional technicians, role switcher, `admin/admin`): the reference
   for screens, UX, tools and visuals — never for security.

Connected contract reconstructed (full table in the audit notes; key facts):

| Operation (cite)                           | Rule                                                                                                                                                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `job.create` (A:85-87, R:11-22)            | Published directly (no draft, no edit); shifts ≤366, ≤24 h each, one per local date, future; headcount 1–100; fee frozen at publication; recruiter must name a `client`                                  |
| `job.status` (A:88)                        | paused ↔ published; **closed is terminal**; close blocked by accepted/confirmed applications                                                                                                             |
| `application.*` (A:107-137)                | received → shortlisted → proposed → accepted → confirmed → finished; reject/withdraw/cancel; technician only accepts/withdraws; reasons only for reject/cancel; confirm re-checks everything (A:120-131) |
| Notifications (A:135), messages (A:139)    | Notice to the counterparty on every transition; none on apply or message; messages in any status, 60/15 min                                                                                              |
| Outreach (A:89-105, R:7,24)                | AOG/Urgente tiers from lead time, opt-ins, quiet hours, mobilisation, dedup per (technician, job)                                                                                                        |
| Directory (A:56, N:33)                     | Code `T-xxxxxxxx`, never the name; **also leaks the owner user id** (DO-NOT-COPY)                                                                                                                        |
| Account (A:142-144,176), reset (A:164-165) | Close with «CERRAR» (bypasses the state machine to withdraw everything); export; reset revokes **all** sessions                                                                                          |
| Admin (A:183-189)                          | Summary metrics, scan (ClamAV), invite (roles from invite), review profile/org/doc — **no `rejected` state**                                                                                             |

## 4. Validation of the master matrix (≈ 270 rows)

Every row of `10-master-matrix.md` §3 was re-read against the sources above. Result: the inventory is
**incomplete and partly wrong**, not fabricated.

### 4.1 Wrong rows (corrected in `10-master-matrix.md`)

| Row                         | Error                                                                                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| header «v1.1 NOT AVAILABLE» | File exists (§2)                                                                                                                                     |
| CX-41                       | Connected has **no** document edit action (switch A:61-145)                                                                                          |
| CO-21/CX-22/CO-23           | Connected has no job edit/archive; edit/archive/duplicate are demo-only (Company2.jsx:141-167)                                                       |
| TD-37/CX-16                 | Connected rate is `hourlyRate` €/h only (A:68)                                                                                                       |
| CO-31/32/CX-28 tagged `C`   | Search/filters are demo + V1.8 directory, not the connected API (A:56 returns an unfiltered list)                                                    |
| CX-21                       | No engines/arrival/mobilisation in `validateJob` (R:21); mobilisation is a profile field                                                             |
| CX-47                       | Register consent is checked but never stored (A:160); terms stamp only on technician profile, re-stamped each save (A:73)                            |
| TD-56/64/CX-18              | v1.8 confirm never removes availability → nothing to restore; protection covers `confirmed` only (A:67,79). Demo restores via `previousAvailability` |
| CX-17 / CX-20 / CX-13       | Course names free text (A:71); no ops email (A:83); review labels pending/reviewed only (A:189)                                                      |
| CX-07                       | v1.8 revokes **all** sessions; target keeps the current one (deliberate, §6)                                                                         |
| TD-62                       | Undo-after-save is demo-only; the connected calendar only discards — the target matches connected                                                    |
| TD-53                       | 4 visibility modes are demo-only; connected has one «anonymous» checkbox (Account.jsx:62)                                                            |
| TD-15/16                    | Aircraft medals = rating badges (double count); «specialty» kind and learning medals omitted                                                         |
| TD-78 / §6                  | v1.8 **does** ship a service worker (`main.jsx:6`, `dist/sw.js`); §6 claimed a row that does not exist                                               |
| TD-82/83, TD-85             | Fuel sheet is one of 4 tabs in FuelTools; «translator» is 32 offline phrases + a consent-gated external link                                         |
| M04/M15 «VERIFIED (prod)»   | Production has no authenticated E2E (`01-current-state.md`): **DEPLOYED, not verified**                                                              |

### 4.2 Missing rows (added with stable IDs)

CX-08 (CSRF/Origin/415/body caps), CX-11 (cookie flags, 12 h, hashed sessions), CX-48 (connected anonymous
checkbox), CX-49 (admin invite operation), CX-53 (reset invalidates other reset tokens), CX-54 (review back to
pending on qualification change / org save / re-scan), CX-55 (org reviewed before confirm), CX-56 (fee frozen at
publication, kept on reopen), CX-57 (one active application per job), CX-58 (notification on every transition),
CX-59 (shift engine `selectShifts`: partial/min/consecutive), CX-60 (directory leaks owner id — DO-NOT-COPY);
NEW-01 service worker; TD-54b urgent opt-in, TD-54d AOG during quiet hours; TD-90 day filter on the home
calendar; TD-91 «possible on rest day»; TD-92 evidence document per rating; TD-94 opportunity filters; TD-95
separate pack/contact consents; CO-90 budget-as-hard toggle; CO-92 draft «Completar y publicar»; CO-96 offer
«Vencida» state; AD-90 invitation UI; tools sub-rows TD-78a–d, TD-79a–i, TD-82a–d, TD-83a–c, TD-84a–d,
TD-85a–c; learning TD-86a–g, TD-87a–b. Demo-only additions recorded but not scoped: NEW-02..04, CO-93..95, AD-91.

### 4.3 Coarse rows split

TD-10 (toast / saving / failure alert / audit), TD-25/26/27 (wizard / autosave / start empty), TD-30/31
(aircraft vs rating with restriction → ineligible, `tests/v13-regression.test.mjs:5`), CO-21/CX-22/CO-23
(edit, pause/reopen, archive, close, duplicate), TD-66/CX-24 (audience, deadline, replies, notices),
TD-88/89 (export, import, reset), M07/M08/M09 prose → tables.

**Count:** the previous matrix had ≈ 270 behaviours; this pass adds 58 rows and splits 9, consolidates 0
duplicates (TD-15/16 double count noted, kept as one row). No row was deleted.

## 5. VERIFIED_LOCAL re-verification (false positives)

| Batch     | Claim          | Finding                                                                                                                                                                                                                                   | New status                                      |
| --------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1 M01     | VERIFIED_LOCAL | **MED security:** any signed-in session could open `/reset-password` and set a new password without the current one. **Fixed** (batch 5). Residual: Supabase Auth API still allows it while `secure_password_change = false` (owner, T22) | VERIFIED_PARITY_LOCAL (app gate); T22 PARTIAL   |
| 2 M06     | VERIFIED_LOCAL | **MED:** compare selection lost across pages/filters; no cap in the UI; identical accessible names; stale ids triggered the truncation notice; ticked boxes survived «Clear comparison» (found by the new smoke). **Fixed** (batch 5)     | VERIFIED_PARITY_LOCAL (for fields the pool has) |
| 3 M02     | VERIFIED_LOCAL | Title not BR-11's «Profile completeness» — fixed. «Today» is UTC vs v1.8 Europe/Madrid: **deliberate** (BR-10 UTC). Missing feeds/dots/assigned: M07/D-06                                                                                 | VERIFIED_PARITY_LOCAL (scoped)                  |
| 4 M10/M04 | VERIFIED_LOCAL | 45-day rule added to `src/domain` without BUSINESS_RULES — now BR-12. Boundaries correct and unit-tested                                                                                                                                  | VERIFIED_PARITY_LOCAL                           |

Test-quality notes: no test returned early, swallowed errors or asserted only HTTP 200. Weaknesses: smoke
checks depend on seed counts; pagination > 20 never exercised end to end; `password-reset-check` is manual
(not in `pnpm check`). The reset server action itself is only gated by the shared helper (unit-tested), not
posted directly from a password session (review M-2, open).

## 6. Regressions and deliberate differences

| Item                                                                                                                                                                                                            | Verdict                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Requirement statuses `covered/cancelled/closed/draft` existed in the enum with an `update(status)` grant but **no transition guard and no audit** — a manager could reopen anything by a direct PostgREST write | Gap closed for `closed` (batch 6: terminal + audited in the DB)          |
| Reset keeps the current session (v1.8 revokes all)                                                                                                                                                              | Deliberate: the session just proved e-mail ownership; others are revoked |
| Today = UTC (v1.8 Madrid)                                                                                                                                                                                       | Deliberate (BR-10)                                                       |
| Urgency declared, not derived from lead time                                                                                                                                                                    | Deliberate (C-8/D-05); v1.8 derivation DO-NOT-COPY                       |
| AOG day shown red (danger); v1.8 orange `#fff3e6/#bd752b`                                                                                                                                                       | **Undocumented visual regression** (P0 visual, batch 7 candidate)        |
| Directory owner-id leak (N:33), `admin/admin`, raw tokens in outbox                                                                                                                                             | DO-NOT-COPY, not ported                                                  |

No functional regression of release 1 was found: `ui-smoke` 88/88+, local E2E 42/42 on the current tree.

## 7. Security findings of this audit

| ID  | Sev | Finding                                                                                          | State                                                                    |
| --- | --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| S-1 | MED | Password change from a non-recovery session (app)                                                | Fixed `5007fde`, test `password-reset-check` 4b                          |
| S-2 | MED | Same via Supabase Auth `PUT /auth/v1/user` (`secure_password_change = false`, `config.toml:230`) | OPEN — owner Auth setting (T22)                                          |
| S-3 | MED | Requirement status changes unaudited, reopen possible by direct write                            | Fixed batch 6 (`20261020120000`), RLS suite M                            |
| S-4 | LOW | `redirectTo` built from the `Origin` header; safety relies on the Supabase redirect allowlist    | OPEN — use the configured site URL (small, next batch)                   |
| S-5 | LOW | Compare ids unbounded in the URL                                                                 | Mitigated: hidden inputs only for ids in the pool; parser cap still open |

Privacy re-check of M06 search: only values the organization already sees are searchable (per-requirement
pseudonym, display name blanked unless internal/open, base). No cross-requirement linkage (sha256 of
requirement + profile). Soft score shown only when eligible — it never compensates a hard requirement.

## 8. Visual audit (M17, static CSS/token diff)

Tokens match v1.8 (navy, accent, blue, ok/warn/danger, tool palette, Inter). Differences by impact:

| #    | Gap                                                                                                                                                         | Prio | Route                               | Status                                        |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------- | --------------------------------------------- |
| 1    | AOG day red instead of v1.8 orange                                                                                                                          | P0   | availability, professional overview | undocumented → batch 7                        |
| 2    | Hatched partial day (v18.css:1) → flat warn fill                                                                                                            | P1   | same                                | undocumented                                  |
| 3    | No mobile drawer / 5-item dock (v17.css:7)                                                                                                                  | P1   | all `/app/*` < 1024 px              | dock C-12 (rejected L14) — CONFLICT with v1.8 |
| 4    | Buttons/inputs 40 px vs 44 px touch target (v12.css:2)                                                                                                      | P1   | all forms                           | undocumented                                  |
| 5    | Assigned/working day states                                                                                                                                 | P1   | availability                        | D-06                                          |
| 6    | No modal / toast / saving indicator                                                                                                                         | P1   | requirements, profile               | undocumented                                  |
| 7    | No passport hero, avatar, medals                                                                                                                            | P1   | `/app/professional`                 | D-07/D-10, OD-3                               |
| 8–15 | Sidebar icons, topbar, uppercase chips, table header bg, danger button, today ring colour, shadows, focus ring (v1.8 effective teal vs orange — documented) | P2   | various                             | mostly undocumented                           |

`docs/audit/VISUAL_PARITY.md` is stale (treats v1.1 as reference; Outfit; «Wallet/Herramientas absent»;
nav «horizontal scroll»). Screenshot comparison at 1440/1024/768/390/360 was **NOT RUN** in this pass for the
v1.8 reference (the reference app needs its own server; the standalone HTML runs untrusted JS — owner to
decide whether to run it in an isolated browser profile). Current-app captures: `ui-smoke` responsive shots.

## 9. End-to-end journeys (what exists vs what ends in a button)

| Journey    | Exists end to end                                                                                         | Stops at                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Technician | sign up → passport → qualifications (pending) → availability/cycles/AOG → wallet (local) → overview       | **opportunities, application, proposal, acceptance, assignment, finish: absent** (D-06/D-07). Verification off in prod (OD-3) |
| Company    | account+org → need (create) → capacity → explained matching (search/filter/compare) → **close** (batch 6) | edit/pause/duplicate (D-06/R-D4), candidates/proposal/confirm (D-06), coverage by assignments                                 |
| Recruiter  | `staffing_agency` org type at sign-up                                                                     | client representation, publish for client, pipeline (D-12, LATER)                                                             |
| Admin      | qualification review (local, flag-gated)                                                                  | org/profile/document review, invitations, metrics, audit view (OD-3/OD-5/OD-8, SCOPE OUT)                                     |

## 10. Decision check — «no executable work remains without new decisions»

**False.** Decision-free work found and partly executed:

| Group                | Item                                                                                                                                | State                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| A (safe, authorised) | Reset gate, compare persistence, BR-11/BR-12 docs                                                                                   | done `5007fde`                          |
| A                    | Close requirement (V1.8 `job.status` closed, terminal, audited)                                                                     | done batch 6                            |
| A                    | AOG colour orange; hatched partial day                                                                                              | batch 7 (next)                          |
| A                    | `redirectTo` from site URL (S-4); compare id cap                                                                                    | small, next                             |
| A                    | Offer «Vencida» derived state (CO-96: all days past) — display only                                                                 | candidate                               |
| B (design, no rule)  | Application state machine schema/contract tests from `APPLICATIONS_STATE_MACHINE.md`                                                | possible without activating transitions |
| C (tests/docs)       | Matrix corrections, roadmap, VISUAL_PARITY refresh                                                                                  | done / in this commit                   |
| D (blocked)          | Pause/reopen (needs D-06 semantics), edit with applications, opportunities, applications, pack, recruiter, notifications, admin ops | §11                                     |

## 11. Decision pack for the owner

Decision texts are in the linked canonical docs; this table does not reinterpret them.

| ID                    | Module      | Problem                                                                  | v1.8 behaviour                              | Current                   | Recommendation                                         | Unblocks                               | Local work possible meanwhile |
| --------------------- | ----------- | ------------------------------------------------------------------------ | ------------------------------------------- | ------------------------- | ------------------------------------------------------ | -------------------------------------- | ----------------------------- |
| D-06 Q2–Q6            | M08         | Ratify the owner proposals in `APPLICATIONS_STATE_MACHINE.md` §4         | A:115-137                                   | none                      | Ratify as proposed                                     | M07, M08, assigned days, notifications | schema design, contract tests |
| D-07 P1–P4            | M09         | Consent, snapshot, unlock, retention of the pack (`CANDIDATE_PACK.md`)   | A:107-110,172-175                           | none                      | Ratify; P3 needs legal period                          | M09, third-party downloads             | wallet hardening              |
| D-12 / visibility     | M07         | Marketplace: published needs visible to all technicians?                 | all authenticated see published jobs (A:53) | org-only RLS              | Visible to professionals, eligibility shown separately | M07                                    | —                             |
| Requirement lifecycle | M05         | Pause/reopen semantics, edit with applications, drafts (R-D4), duplicate | paused ↔ published; no edit; demo drafts    | create + close            | Add `paused` with D-06                                 | M05                                    | close done                    |
| C-10/D-02/D-03        | M03/M06     | Restrictions, engines, English, min years as matching inputs             | R:27, Professional2.jsx                     | catalog quals only        | Restrictions → ineligible (v1.8 test)                  | safer certifying matching              | —                             |
| OD-6/D-04             | M03         | Work-permit countries                                                    | EU27 ≤27 (A:68)                             | none                      | EU27 declared, hard check                              | cross-border needs                     | —                             |
| OD-7                  | M03/M05     | Rates, fees                                                              | hourlyRate, fee tiers 2.3/4/10 %            | none                      | keep LATER                                             | rate filter/sort                       | —                             |
| Account retention     | M01         | Close account, export                                                    | A:142-144,176                               | none                      | define retention (M-3)                                 | CX-43/44                               | —                             |
| Document retention    | M10         | 30 d/24 h, legal hold, maintenance                                       | delete blocked when shared                  | local wallet              | approve release 2                                      | wallet to prod                         | —                             |
| AOG opt-in            | M04/M12     | `aogOptIn`, quiet hours, mobilisation                                    | A:75, R:24                                  | `aog_only` without opt-in | V1_SCOPE says NEXT **and** LATER — CONFLICT to resolve | TD-65, outreach                        | —                             |
| Audit privacy         | M05/M13     | Org activity view (last 15 audit rows)                                   | demo only                                   | admin-only RLS, no UI     | read-only view for org admins                          | CO-05                                  | —                             |
| Scope LATER           | M14/M16/M15 | Logbook, Daily Learning, Fuel sheet (D-11), glossary                     | present in v1.8                             | absent                    | owner to schedule                                      | —                                      | —                             |
| C-12 / dock           | M17         | v1.8 ships a mobile dock; L14 rejected it                                | v17.css:7                                   | wrapped nav               | decide                                                 | mobile nav                             | —                             |
| T22                   | M01         | `secure_password_change` in production Auth                              | —                                           | local false, prod unknown | enable + reauthentication                              | S-2                                    | —                             |

## 12. Modules: complete vs incomplete

**Complete for their v1.8 scope (VERIFIED_PARITY_LOCAL or DEPLOYED):** M04 availability (except assigned days,
AOG opt-in), M15 tools subset (units, torque, durations — D-11), M01 password recovery.
**Technically incomplete:** M00 (dock, toasts, modal), M02 (feeds, dots, medals), M03 (≈ 9 fields), M05
(lifecycle beyond close, builder fields), M06 (filters needing C-10/OD-7, profile modal), M10 (release 2),
M13 (review beyond qualifications), M17. **Not started (blocked):** M07, M08, M09, M11, M12, M14, M16.

Next: `12-completion-roadmap.md`.
