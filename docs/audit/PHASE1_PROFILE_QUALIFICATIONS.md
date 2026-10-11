# Phase 1 — Professional passport and real qualifications (2026-10-11, local only)

Scope: the professional edits their passport and manages their declared qualifications end to end,
persisted in the LOCAL Supabase Docker database through Edge Functions. Remote project
`sbjkzrkmcekokkqiuvvh`, Vercel and remote secrets untouched; nothing deployed, nothing pushed.

## 1. Local incidents closed first

| Item                            | Outcome                                                                                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 19/20 browser smoke             | The failing check was the console gate picking up the **expected** 404 of the cross-organization page. The smoke now records the page of every console error and excludes 404s on URLs registered as "expected" (only the cross-org requirement page). Unexpected errors still fail. |
| E2E data accumulation           | 6 leftover requirements (`E2E …`, `Local UI check …`) removed with the new `scripts/local/cleanup-test-rows.sh` (local-guarded through `sb-local.sh`, title pattern only, seed untouched). Phase 1 tests restore the values they change.                                             |
| `.env.remote.backup` protection | Git-ignored (`.env.*`), not a name Next.js loads, read by no script/config/source; now asserted by `tests/security/repo-hygiene.test.ts`.                                                                                                                                            |
| Pending local changes           | Tree was clean (`main` = `origin/main` at `4f98e67`).                                                                                                                                                                                                                                |
| Initial quality gate            | `pnpm check`, `pnpm build`, `git diff --check` green before any change (morning run).                                                                                                                                                                                                |
| Seed / database                 | No `db reset`; the 22 synthetic accounts and their scenarios reused as they are.                                                                                                                                                                                                     |

## 2. Audit — prototype `CrewFlex_v1.1.html` ("Mi pasaporte", "Privacidad") vs the app

Source: `/mnt/c/Users/perfo/Downloads/CrewFlex_v1.1.html` (S1), state `tech-me` and the passport wizard
`kh()` (5 steps: Identidad · Cualificaciones · Experiencia y cursos · Disponibilidad y tarifa · Resumen),
privacy screen `wh()`, completeness `ga()`.

| Prototype attribute                                                                                            | Data model (`DATA_MODEL.md`)                                | Before phase 1 | After phase 1                                                    |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------- | ---------------------------------------------------------------- |
| Nombre profesional                                                                                             | `profiles.display_name`                                     | read-only      | **editable** (`professional-profile`)                            |
| Base habitual (airport list)                                                                                   | `technician_profiles.base_location` (free text ≤ 80)        | read-only      | **editable** (free text; airport catalog not modelled)           |
| Años de experiencia                                                                                            | `technician_profiles.years_experience` 0–60                 | read-only      | **editable**                                                     |
| Movilidad (boolean in S1)                                                                                      | `technician_profiles.mobility` local/national/intl          | read-only      | **editable** (3-level enum, richer than S1)                      |
| Situación actual (not in S1 wizard; in brief)                                                                  | `technician_profiles.current_status`                        | read-only      | **editable**                                                     |
| Visibilidad (privado / anónimo / empresas verif. / abierto)                                                    | `technician_profiles.visibility` private/anonymous/open     | read-only      | **editable** (3 modes; "verified organizations" = OD C-7/OD-5)   |
| Categorías (B1.1, B2, Cat A…) · Habilitaciones por aeronave                                                    | `technician_qualifications` × catalog LICENSE / TYPE_RATING | read-only      | **declare / edit dates / withdraw / remove**                     |
| Cursos con vigencia (HF, EWIS, FTS, SMS)                                                                       | catalog TRAINING with `requires_expiry`                     | read-only      | **declare with expiry** (BR-2.7 enforced)                        |
| Estado de verificación (Autodeclarado / Verificado)                                                            | `verification_status` pending/verified/rejected/expired     | shown          | shown, **never editable by the owner**; dates change → pending   |
| % completo (`ga()`)                                                                                            | derived                                                     | absent         | **`profileCompleteness()`** 7 items + concrete next step (BR-11) |
| Evidencias (wallet)                                                                                            | Storage PLANNED                                             | absent         | not in this phase (no model) — next phase                        |
| E-mail / teléfono / empresa actual / bloqueo de empresa                                                        | not modelled (CF-H02 SOURCE_ONLY)                           | absent         | not built (unjustified by the model; e-mail lives in Auth)       |
| Inglés, motores, skills, tarifa, países, herramientas, patrón de turno, WhatsApp/AOG opt-in, horas de silencio | not modelled (OD C-9/C-10, CF-G06, CF-B04/B05)              | absent         | not built — open decisions, no invented columns                  |

Conclusion: everything the current model justifies is now real and persisted; the remaining prototype
fields are open product decisions, listed in §10, not silently invented.

## 3. What was implemented

### Edge Functions (local, `supabase/functions/`)

| Function                      | Methods                  | Rules                                                                                                                                                                                                                                                                        |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `professional-profile`        | GET, PATCH               | Owner = JWT `sub` (never from the body). Full replacement of `displayName, baseLocation, mobility, yearsExperience, currentStatus, visibility` (strict Zod; `profileId`, `platformRole`, `accountType`, `verificationStatus` → 400). Professionals only (403 otherwise).     |
| `professional-qualifications` | GET, POST, PATCH, DELETE | POST declares (`verification_status` default `pending`, never in the payload); BR-2.7 checked against the **catalog row** (`requires_expiry`); duplicate type → 409. PATCH edits dates / `active`↔`withdrawn` (type immutable). DELETE removes. Not owned → 404 (no oracle). |

`supabase/config.toml` carries both blocks (`verify_jwt = false`, JWT verified in code with `getClaims`).

### Next.js

- `/app/professional/profile`: `ProfileForm` (client) — 01 Identity · 02 Experience and mobility ·
  03 Visibility (radiogroup cards, prototype `visibility-grid`). Client Zod → server action Zod →
  Edge Function. Success/error notice with request id; reload shows the persisted state.
- `/app/professional/qualifications`: `QualificationsManager` — declare from the catalog (types already
  held are hidden), issue/expiry dates, BR-2.7 hint, edit dates / withdraw, remove; grouped by category
  with "Held/Withdrawn" and the review state chip. Changing dates of a reviewed item warns that it goes
  back to pending.
- `/app/professional` overview: **Passport %** metric with the next step (BR-11) + "Edit passport".
- Shared: `src/domain/professional.ts` (enums, `profileCompleteness`), `src/lib/validation/professional.ts`
  (Zod, `expiryIssueFor`), `src/types/api.ts` contracts, `components/ui/Notice.tsx` (also used by the
  availability manager; duplicated markup removed).

### Migrations

**None.** The V0 schema already had every column, the column grants (`display_name`; technician
profile fields; qualification `type/status/issued_at/expires_at` — never `verification_status`), the
RLS policies (own rows; insert forces `pending`) and the trigger that resets verification on date
changes. Phase 1 adds no table, column, policy or trigger, so local and remote schemas stay identical.

### RLS / permissions (unchanged, now covered by tests F)

| Actor                      | Passport                                              | Qualifications                                                                                  |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Owner                      | read/update own (not `platform_role`, `account_type`) | insert (pending) / update dates+status / delete own; **never** `verification_status`            |
| Another professional       | 0 rows (no error oracle)                              | 0 rows; insert for someone else → RLS violation                                                 |
| Org admin/manager of owner | read                                                  | read only                                                                                       |
| Verifier                   | —                                                     | only a future privileged, audited function (no API path today) → `qualification.verified` audit |

## 4. Data scenarios used (seed, unchanged)

Delta (eligible external, anonymous) edits the passport and declares/removes B2 · TR-A350; Delta
withdraws FTS → MAD matching eligible **3 → 2**, re-activates → **3** and FTS stays `verified` (only
date changes reset review). Echo (professional B) cannot read, edit, withdraw or delete Delta's rows.
Admin MRO reads Alpha's qualifications but cannot edit them. Existing matching cases remain: Golf
(B1.1 pending → not verified), Oscar (rejected), Papa (withdrawn → missing), Juliett (TR-B737 instead
of TR-A320 → missing hard), Mike (B2 expires during the LIS need), Bravo (FTS expired).

## 5. Tests executed (all local)

| Suite                                              | Result                                                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm check`                                       | lint, typecheck, Vitest **134 passed** (12 skipped = the E2E suite without `.env.e2e`, run separately below), Prettier, deno lint/check, **32 Deno tests**                                                                           |
| `pnpm build`, `git diff --check`                   | green                                                                                                                                                                                                                                |
| Local E2E (`node --env-file=.env.e2e … tests/e2e`) | **17/17**: previous 13 + passport edit/persist/isolation/strict, pending-only declaration + BR-2.7 + 409 + owner cannot verify (42501), B cannot touch A's declaration, withdrawn FTS changes matching 3→2 and restores              |
| Browser smoke (`scripts/local/ui-smoke.mjs`)       | see `docs/qa/LOCAL_ENVIRONMENT.md` §7 (login/logout, passport edit + reload, client validation, declare B2 + reload + edit + remove, availability, organization flows, cross-org 404, 1440/768/390 without overflow, localhost only) |
| Regressions                                        | Availability, Work Requirements, Capacity and Matching checks of the E2E and smoke unchanged and green; `src/domain/matching.test.ts` untouched.                                                                                     |

## 6. Evidence

`docs/audit/evidence/local-10-passport-{1440,768,390}.jpg` (before edit), `local-11-passport-edited-after-reload.jpg`,
`local-12-qualifications-{1440,768,390}.jpg`, `local-13-qualification-declared.jpg`; previous
`local-01…09` refreshed. "Before" state = the read-only pages in `docs/audit/evidence/local-01-technician-overview.jpg`
(2026-10-10) and the prototype `proto-1440-technician-mi-pasaporte.jpg`.

## 7. Files

New: `src/domain/professional.ts` (+test), `src/lib/validation/professional.ts` (+test),
`src/features/professional/{actions,action-result}.ts`, `src/features/professional/components/ProfileForm.tsx`,
`src/features/qualifications/actions.ts`, `src/features/qualifications/components/QualificationsManager.tsx`,
`src/components/ui/Notice.tsx`, `supabase/functions/professional-profile/{index,index_test}.ts`,
`supabase/functions/professional-qualifications/{index,index_test}.ts`, `scripts/local/cleanup-test-rows.sh`,
this report. Modified: profile/qualifications/overview pages, `professional/api.ts`, `qualifications/api.ts`,
`ProfessionalSections.tsx`, `AvailabilityManager.tsx` (Notice), `lib/format.ts`, `types/api.ts`,
`server/edge-functions.ts`, `supabase/config.toml`, `tests/db/rls.test.ts`, `tests/e2e/remote-smoke.test.ts`,
`tests/security/repo-hygiene.test.ts`, `scripts/local/ui-smoke.mjs`, docs (`V1_SCOPE`, `BUSINESS_RULES`,
`EDGE_FUNCTIONS`, `USER_FLOWS`, `SECURITY_PRIVACY`, `PARITY_MATRIX`, `FEATURE_INVENTORY`, `QUALITY_GATES`,
`LOCAL_ENVIRONMENT`).

## 8. Git

Local commits on `main`, **not pushed** (push = production deploy of the Next.js app; the two new
functions are not deployed, so the pages would show the "service not available" state in production
until `supabase functions deploy professional-profile professional-qualifications` runs with explicit
authorization).

## 9. Definition of Done — status

Sign in → edit passport → save → reload keeps the data → another user cannot modify it: **verified**
(E2E 11, smoke 5b, RLS F). Manage allowed qualifications (declare, dates, withdraw, remove) with the
review state protected: **verified** (E2E 12–13, smoke 5d–5g, RLS F, Deno). Everything against the
Docker stack only: **verified** (smoke "only localhost", `.env.local` → 127.0.0.1:56321).

## 10. Pending (not in this phase, by decision)

- Document wallet / evidence upload (private bucket, signed URLs) — next phase, as instructed.
- Verifier flow (privileged function + UI) — V1_SCOPE NEXT; today nobody can set `verified` via the API.
- Prototype fields without a model: phone, current employer + block (CF-H02), English level, engines,
  skills, rates, work countries, own tools, shift pattern, WhatsApp/AOG opt-in, quiet hours (OD C-9/C-10,
  CF-G06, CF-B04/B05); airport catalog for the base; "verified organizations" visibility (OD C-7/OD-5).
- Deploying the two functions to production; Playwright journeys as a repo suite.
