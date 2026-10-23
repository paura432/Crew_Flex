# Business Rules

> **Local vs production (2026-10-15).** Production has only migrations `20261009120000` and `20261009120100`.
> Every object, rule enforcement or control below that cites a migration dated `20261011…` or `20261015…`
> exists **only in the local database** until the authorized rollout (`docs/audit/CREWFLEX_DIFF_CURRENT.md` §5;
> state in `memory-bank/01-current-state.md`).

These rules are implemented in pure TypeScript under `src/domain/` and covered by
`src/domain/*.test.ts`. If code and this document disagree, it is a bug: fix one of them in the
same change.

## BR-1 Work Requirement

| Rule    | Statement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Status                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| BR-1.1  | `title` (3–120 chars) and `location` (2–80 chars) are required.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | IMPLEMENTED                |
| BR-1.2  | `headcount` is an integer, 1–50. `headcount = 0` is an **invalid requirement**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | IMPLEMENTED                |
| BR-1.3  | `endsAt` must be strictly after `startsAt`; max duration 366 days. A new requirement cannot start in the past (15 min grace for filling the form and clock skew; V1.8 refused it too) — `v.start.future`, checked by the browser, the server action and `work-requirements`; closing an existing one is unaffected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | IMPLEMENTED                |
| BR-1.4  | 1–20 qualifications, no duplicates, **at least one `hard`**. Enforced by the form, the Edge Function, `create_work_requirement` and, since `20261015130000`, by the database at commit for every `open`/`covered` requirement (deferred constraint trigger; direct PostgREST writes included; drafts may be incomplete, cancelling/closing is always possible, reopening is checked). The engine refuses to evaluate a requirement without a hard qualification (`assertEvaluableRequirement`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | IMPLEMENTED                |
| BR-1.5  | `shift`: `day` · `night` · `split` · `flexible`. Informational in V0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | IMPLEMENTED                |
| BR-1.6  | `urgency`: `planned` · `urgent` · `aog`. Informational in V0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | IMPLEMENTED                |
| BR-1.7  | `status`: `draft` · `open` · `paused` · `covered` · `cancelled` · `closed`. Created as `open`, or as `draft` (BR-1.13); `archived` is a flag on a closed one (BR-1.14). `cancelled` is legacy: no transition reaches it (M05, T-14). **Expired** (V1.8 «Vencida», `isExpired`): an `open` requirement whose `endsAt` has passed is shown as expired — derived at read time, never stored, no transition; closing stays explicit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | IMPLEMENTED                |
| BR-1.8  | Only organization `admin` / `manager` can create requirements.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | IMPLEMENTED                |
| BR-1.9  | Requirements are never hard-deleted. An admin/manager **closes** one (V1.8 `job.status`, `server/app.mjs:88`): `closed` is terminal — the database refuses any later status change (`guard_requirement_status`, `20261020120000`) — and every status change is audited `requirement.status_changed {from,to}`. A closed requirement is **frozen** (no field or qualification change, `20261020120100`) and is no longer evaluated: capacity and matching answer 409, as V1.8 only evaluates published jobs. Closing is refused while any application is `accepted` or `confirmed` (T-12, V1.8 «Resuelve antes las asignaciones activas», 409 `ACTIVE_COMMITMENTS`; LOCAL `20261022130300`); other open applications are not moved. **Lifecycle (M05, owner 2026-10-22, LOCAL `20261022130000/130100`):** open ↔ paused (V1.8 «Pausar» / «Reanudar»), a draft is opened, anything not closed may be closed, nothing else — one table, `canChangeRequirementStatus` (`src/domain/work-requirement.ts`), mirrored by `guard_requirement_status` (rls suite S compares every pair). A paused requirement is not published and not evaluated (capacity/matching 409, `isEvaluable`); «Pausar» is hidden on an expired need. **Edit (M05, LOCAL `20261022130300`):** only while the requirement never received an application (withdrawn included; 409 `HAS_APPLICATIONS` otherwise, direct writes too), with the creation validations, an optimistic version (409 when stale) and audit `requirement.updated` (field names). `covered` comes and goes with the confirmed seats only (BR-13). | IMPLEMENTED (close, local) |
| BR-1.10 | **Shifts** (v2-09, v1.8 connected ShiftEditor; T-60): optional, 1–366 shifts `{startsAt, endsAt, baseHours}`; each lasts more than 0 and at most 24 h («Divide los trabajos de varios días en jornadas de hasta 24 horas.») and pays 0.25–24 base hours, never more than it lasts («Las horas base superan la duración del intervalo.»); sorted by start they do not overlap («Las jornadas no pueden solaparse.», touching is fine) and start on different local dates of the requirement's zone («Solo se admite una jornada por fecha local de inicio.», UTC without a zone). The requirement's `startsAt`/`endsAt` is exactly their envelope. `shiftIssues`/`shiftEnvelope` (`src/domain/work-requirement.ts`) = trigger `work_requirements_shifts_valid` (PGlite parity suite `requirement-builder`). Without shifts the requirement is one continuous period, as before. **D-06 Q6 holds**: an application covers every shift, and eligibility, availability coverage, apply and the confirm re-check use the envelope (availability is also needed in the gaps between shifts until per-shift coverage, matching-v18 / v2-30). Shown as «{Σ} horas base en {n} jornadas» and, for the organization, «Cobertura por jornada · {fecha} · x/n plazas confirmadas» (seats = confirmed + finished).                                                                                                                                                                                                                                                                                   | IMPLEMENTED (local)        |
| BR-1.11 | **Country and zone** (v2-10, OD-6/D-04 default; T-61): `country` is one of the 27 EU members (v1.8 `server/rules.mjs:1`, «Selecciona un país de la Unión Europea.»); `timeZone` one of the EU IANA zones or UTC («Zona horaria no válida.»), used only to tell local dates apart — every instant is still entered and shown in UTC (BR-10). Both optional in the API (null = not stated: every requirement created before them); the form proposes ES and Europe/Madrid. Shown as «{base} · {país}». The base stays free text and is not cross-checked with the country.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | IMPLEMENTED (local)        |
| BR-1.12 | **Terms without money** (v2-12, OD-7; T-62): EUR per hour (0–2000, not 0), per overtime hour and per diem per day (0–2000), hours per shift (0.25–24), contract (Contractor · Temporal · Permanente · Por proyecto), «Tratar presupuesto como requisito obligatorio» (declared, **not evaluated**: the professional's minimum rate is owner-only, T-33, T-86), maximum mobilisation (1–168 h; the form proposes 48 h, 12 h for AOG), incorporation (≤ 160) and logistics (flights, accommodation, local transport, meals, own tools), plus a description ≤ 4000. Two decimals at most; unknown keys (commissions included) are refused by the schema and the CHECK. Informative only: no fee, commission, invoice or payment exists (SCOPE OUT). Frozen like the other business fields once closed or after the first application (CFA12), and copied into every proposal version (T-11 widened, R-08). Day rate = €/h × hours per shift; a proposal with shifts shows «{h} h × {tarifa}/h = {importe} para el técnico» (no commission).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | IMPLEMENTED (local)        |
| BR-1.13 | **Drafts** (v2-14, R-D4 default; T-63): «Guardar borrador» creates or saves a `draft`: title, base and period are required (every row has them), qualifications (0–20, no hard one needed), shifts and terms may be incomplete. A draft is never published nor evaluated (`isEvaluable` false: no opportunity, capacity or matching). Publishing — «Publicar necesidad», «Guardar y publicar» or «Publicar» (draft → open) — applies every creation rule (BR-1.1…1.4, start in the future, shifts, terms) in the schema and again at commit (BR-1.4). The form autosaves in the browser every 350 ms per organization and requirement (v1.8 `useDraft`) and offers «Recuperar» / «Descartar» on return.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | IMPLEMENTED (local)        |
| BR-1.14 | **Archive and duplicate** (v2-14; T-64, T-65): «Archivar» is one way and only for a closed requirement — archiving a draft closes it in the same step; an open, paused or covered one is closed first (T-12 applies) — then it leaves the list and appears under «Ver archivadas» (`archived_at`, audited `requirement.archived`; never `cancelled`, T-14). «Duplicar» opens the builder prefilled with «Copia · {título}», the start moved to the same UTC time 45 days from today, the same duration and shift pattern and every term; nothing frozen comes with it and nothing is saved until the organization saves it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | IMPLEMENTED (local)        |
| BR-1.15 | **Live count** (v2-13; T-66): «{n} candidatos con requisitos y bloques viables» counts the internal members and the external pool's candidates (`anonymous`/`open`, `verified_orgs` once the organization is reviewed; never `private` nor one who blocked it — the same predicate as `ranked_external_pool`) who pass the hard filters (BR-2/BR-3/BR-4.8, the same SQL as apply and confirm, `app_private.hard_eligibility_for`) for the form's period (not started), urgency and hard qualifications, saved or not; admin/manager only, a number only. No urgency bands by date (C-8).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | IMPLEMENTED (local)        |

## BR-2 Qualification validity (per requirement)

A held qualification is evaluated **against the requirement period**, not against "today".

| Rule   | Statement                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-2.1 | `status = withdrawn` is treated as **not held**.                                                                                                                                                                                                                                                                                                                                                                                                        |
| BR-2.2 | `expiresAt` is a date. It is valid through the whole UTC day.                                                                                                                                                                                                                                                                                                                                                                                           |
| BR-2.3 | `expiresAt < date(startsAt)` → **expired**.                                                                                                                                                                                                                                                                                                                                                                                                             |
| BR-2.4 | `date(startsAt) ≤ expiresAt < lastDay` → **expires during requirement** (not valid for the full period). `lastDay` is the UTC date of the period's last instant, `date(endsAt − 1 ms)` (`validityForPeriod`); a period ending exactly at 00:00Z ends on the previous day. Corrected 2026-10-15: this row said `date(endsAt)`, the code has always used `endsAt − 1 ms`.                                                                                 |
| BR-2.5 | `expiresAt = null` → no expiry.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BR-2.6 | Self-declared qualifications start as `verification_status = pending`. A professional can never set `verified`. Only a **platform admin** moves an **active, pending** qualification to `verified` or `rejected` (reason required), never their own, for the version they looked at, through `review_qualification` (audited `qualification.reviewed`; reasons visible to the owner only). LOCAL ONLY until OD-3 / D-01 is approved (`20261015130400`). |
| BR-2.7 | Catalog types flagged `requires_expiry` cannot be declared or kept active without `expiresAt` (`expiryIssueFor`, enforced by the `professional-qualifications` function and the form; database backstop: trigger `enforce_qualification_expiry`, migration `20261015120000`).                                                                                                                                                                           |
| BR-2.8 | A professional may edit the dates, set `status` to `withdrawn` / back to `active`, or remove a declaration. Changing dates of a reviewed qualification resets it to `pending` (trigger); withdrawing/re-activating does not. The type is immutable: remove and declare again (no UPDATE grant on the type since `20261015120000`).                                                                                                                      |

## BR-3 Eligibility (hard filters) — `evaluateMatch()`

A candidate is **eligible** only if **every** check passes. Each failure produces a blocker.
No score can compensate a blocker.

| Check                         | Blocker code                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| Hard qualification not held   | `MISSING_HARD_QUALIFICATION`                                        |
| Held but not `verified`       | `HARD_QUALIFICATION_NOT_VERIFIED` (pending/rejected/expired status) |
| Expired before start          | `HARD_QUALIFICATION_EXPIRED`                                        |
| Expires inside the period     | `HARD_QUALIFICATION_EXPIRES_DURING_REQUIREMENT`                     |
| Profile requirement not met   | one per rule, BR-3.7–3.13 below                                     |
| No availability at all        | `NOT_AVAILABLE`                                                     |
| Availability covers only part | `PARTIAL_AVAILABILITY` (with `coveredPercent`)                      |

**Hard requirements require `verified` status.** Self-declaration alone is not eligibility
(see `OPEN_DECISIONS.md` OD-3).

**v1.8 profile requirements (package matching-v18, owner rule DEFAULTS of 2026-10-22: C-10/D-02/D-03/OD-6 as
documented technical defaults T-80…T-86).** A requirement may state the v1.8 rules below (`work_requirements`
columns, `country` from the builder; `RequirementProfileRules`). Each one is **checked only when stated** — null or an
empty list means «not required» — so a requirement that states none keeps exactly its qualification + availability
verdict. They are checked against the professional's **own passport declarations** (BR-18), as v1.8 does
(`server/rules.mjs:27` `eligible`, `src/business.js:140-150` `matching`); the verified catalog qualifications above
stay a separate, additional rule. Blockers come in this order: qualifications, profile rules (in the order of the
table), availability. One SQL expression mirrors them (`app_private.profile_rules_ok`, `20261023900100`) inside
`hard_eligibility_for` / `hard_eligibility` (apply, confirm, live count) and `ranked_external_pool` (the pool's
eligible-first order and counts); `tests/db/matching-v18.test.ts` proves SQL = `evaluateMatch` on randomized profiles
for six rule sets (own data and the organization's pool rows) and the 50/100/101/500 cap sizes.

| Rule    | Requirement states                                                    | The professional must declare                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Blocker                                                                                |
| ------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| BR-3.7  | `country` (one of the 27 EU members, the builder's field, default ES) | a work permit for that country (v1.8 «Falta declarar permiso de trabajo para el país.»)                                                                                                                                                                                                                                                                                                                                                                                               | `MISSING_WORK_PERMIT` {country}                                                        |
| BR-3.8  | `category` (one of the 12 v1.8 categories)                            | that category among the declared ones, not only the main one (v1.8 «La categoría no coincide.»)                                                                                                                                                                                                                                                                                                                                                                                       | `CATEGORY_MISMATCH` {category}                                                         |
| BR-3.9  | `aircraft` («Aeronaves aceptadas», ≤ 12)                              | **at least one** of them (v1.8 demo `aircraft.some`; «La aeronave no está declarada en el perfil.»)                                                                                                                                                                                                                                                                                                                                                                                   | `AIRCRAFT_NOT_DECLARED` {aircraft}                                                     |
| BR-3.10 | `requires_type_rating` («Exigir habilitación de tipo»)                | a type rating of the required category on **one** of the accepted aircraft, valid for the whole period (BR-2: through `date(endsAt − 1 ms)`, no validity = valid) and **without restrictions** (v1.8 «Falta habilitación de tipo declarada y vigente, sin restricciones.»). The closest miss is reported: a valid one that declares restrictions, else one not valid for the period (latest expiry), else none. Only a licence category and ≥ 1 aircraft can ask for it (CHECK, T-83) | `TYPE_RATING_RESTRICTED` · `TYPE_RATING_NOT_VALID` {expiresAt} · `TYPE_RATING_MISSING` |
| BR-3.11 | `engines` («Motores», ≤ 7)                                            | at least one of them (v1.8 demo `engines.some`)                                                                                                                                                                                                                                                                                                                                                                                                                                       | `ENGINE_NOT_DECLARED` {engines}                                                        |
| BR-3.12 | `min_years` (0–60)                                                    | at least that many years of experience; none declared counts as 0 (v1.8 `profile.years \|\| 0`, «No alcanza la experiencia mínima.»)                                                                                                                                                                                                                                                                                                                                                  | `INSUFFICIENT_EXPERIENCE` {minYears, years}                                            |
| BR-3.13 | `required_skills` («Capacidades obligatorias», of the 9 v1.8)         | **every** one (v1.8 «Capacidad requerida: {s}.»)                                                                                                                                                                                                                                                                                                                                                                                                                                      | `MISSING_SKILL` {skill}, one per missing capability                                    |

Not ported (documented, T-86): «Completa tu perfil.» (a display name is mandatory at sign-up), «Curso pendiente o
caducado» (courses are verified TRAINING qualifications, BR-2/BR-3), «Movilización máxima», «Herramientas propias» and
«Tarifa mínima dentro del presupuesto» (the professional's mobilisation hours are not modelled; own tools and budget are
builder terms not evaluated yet; the minimum rate is owner-only, T-33). Every requirement's rules are frozen with the
rest of it once closed or after the first application (CFA12). Writing them through the builder form and its RPCs is a
follow-up: today only the seed and the owner set them (no grant), and the builder sends only the country. IMPLEMENTED
(local).

## BR-4 Availability

| Rule   | Statement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-4.1 | Availability is a set of time windows (`available` / `unavailable` / `aog_only`), never a single boolean.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| BR-4.2 | `unavailable` windows override `available` windows where they overlap.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| BR-4.3 | A candidate is available only if the union of `available` minus `unavailable` covers **100 %** of `[startsAt, endsAt)`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| BR-4.4 | **Partial overlap is NOT eligible in V0.** It is reported as `PARTIAL_AVAILABILITY` with the covered percentage so the UI can explain it. Partial coverage across several technicians is LATER (blueprint §06).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| BR-4.5 | Adjacent/overlapping available windows merge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BR-4.6 | A professional edits only their own windows (JWT subject + RLS). A window spans at most 366 days (DB check since `20261015120000`). A calendar day is a whole UTC day window. Past UTC days are read-only in the calendar, with or without a draft (V1.8 parity; `isDayEditable` in `src/features/availability/calendar.ts`); the batch `PUT` also refuses them in SQL. A new window, or one whose start moves, may not start on a past UTC day: the form refuses it (X-19) and, since N-26, so does the server (400 for `startsAt`; T-104, LOCAL `20261024200100`; details and compatibility below the table). Editing the window in progress keeps its past start; an older `professional-availability` function answers the same refusal with a plain 400 instead. Editing a day that a longer or partial-hour window covers never happens on one click: the day goes to the unsaved draft with a warning naming how many days will be cut; on save that day is cut out of the window (the rest is kept), in one transaction (`replace_availability_days`, since `20261019120000`). All writes to one technician's windows are serialised (`20261019130000`). A calendar save made from a stale page is refused (409, V1.8 `version`; `availability_version()` checked by `replace_availability_days`, `20261021120000`, local): nothing is written and the draft stays until the technician reloads. Single-window writes are not checked but change the version. |
| BR-4.7 | Work/rest cycle generator (V1.8): the cycle (7–3, 7–4, 7–3/7–4, custom 1–31 days …) is computed in whole UTC days from a chosen day 1; working days become `unavailable`, rest days stay empty unless published as `available`; past days and the days of a confirmed assignment (BR-4.9) are never generated and days with windows are kept unless the professional chooses to replace them. Preview only until saved; saved all-or-nothing. Pure helper `src/features/availability/rotation.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| BR-4.8 | `aog_only` (owner decision C-8 / D-05, 2026-10-19): available **exclusively** for requirements whose declared `urgency = aog` (AOG is never inferred from lead time). For any other urgency it counts as not available. Precedence when windows overlap: `unavailable` > `aog_only` > `available` — i.e. AOG need: (available ∪ aog_only) − unavailable; other needs: available − (unavailable ∪ aog_only). One rule in `effectiveStatus()` (`src/domain/availability.ts`) mirrored by `app_private.ranked_external_pool` (`20261019150100`); rls suite P asserts both agree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BR-4.9 | **The days of a confirmed assignment are protected** (N-04; T-15, which supersedes T-13; v1.8 connected `server/connected.mjs:22`, `server/app.mjs:67`). Only `confirmed` applications count (T-16). The calendar disables those days and the cycle generator skips them, also with «Reemplazar…»; the server answers 409 `reason: ASSIGNMENT_PROTECTED` (SQLSTATE `CFV01`) to a calendar save that lists one of them and to any other write that leaves a confirmed assignment it reduces below 100 % (BR-4.3/BR-4.8). Details below the table. LOCAL (`20261023300000`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**BR-4.9 in detail** (owner rule DEFAULTS of 2026-10-22). Not `accepted`, `finished` or `cancelled`: v1.8 connected
marks and protects `confirmed` only (`calendarState`, `availability.save`; the demo also keeps finished ones marked).
In the calendar the days are disabled with «Una asignación confirmada está protegida.» (`canEditDay`), `planCycle`
skips them, and «Mi espacio» shows them as «Asignado». The server rules (`AVAILABILITY_CONFLICTS`, a family apart from
the applications' `CFA..`): (1) `replace_availability_days` refuses a save that lists any UTC day overlapping a
confirmed assignment of the caller, whatever the new status — «No puedes modificar una fecha con asignación
confirmada.»; (2) the trigger `availability_windows_protect_assignments` refuses any other write — `POST`, `PATCH`,
`DELETE` or a direct PostgREST write with the user's JWT — that reduces the availability of a confirmed assignment it
touches when that assignment is then not covered 100 % (the expression the confirmation re-checks,
`app_private.hard_eligibility`) — «Conserva la disponibilidad de tus asignaciones confirmadas.». A write that only adds
availability is never refused, so an assignment left uncovered earlier can be repaired; deleting the account still
cascades. Lock order unchanged: requirement → application → technician advisory lock (availability writes only read
applications and requirements).

**BR-4.6 server floor in detail** (N-26, the rest of B-12; T-104; LOCAL `20261024200100`). The rule is the form's
(`refusesPastStart`): a single window that is **created**, or whose start **moves** (compared to the minute, the
form's precision), may not start before today 00:00 UTC. The trigger `availability_windows_refuse_past_start` holds it
for every Data API write with a user JWT — `POST` (`create_availability_window`), `PATCH` and direct PostgREST writes —
with `22023` and the hint `past_start`; `professional-availability` answers 400 `VALIDATION_ERROR` with
`startsAt: v.start.future` («El inicio no puede estar en el pasado»). Unchanged: editing the window in progress keeps
its past start, `DELETE`, the end and the status; the calendar save (`PUT`, which already refuses past days and never
moves a start into the past); a replayed create (the idempotency claim answers before any insert, also after midnight);
seeds, migrations and operators in SQL; existing past windows. **Compatibility:** a function deployed before the
migration maps the same `22023` to a plain 400, so the migration can be applied first; the current web form never
sends such a write except across midnight UTC, where it now gets the field error instead of a silent past window;
direct API clients that created past windows get 400 (v1.8 connected accepts them in its interval editor —
`server/rules.mjs:10` — so this is a deliberate backend change, documented as the owner asked).

## BR-5 Soft score

| Rule   | Statement                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-5.1 | Score is computed **only for eligible candidates**; ineligible → `softScore = 0`.                                                                                                                                                                                                                                                                                                                                          |
| BR-5.2 | A soft qualification is _met_ when held, not withdrawn, not rejected, and valid for the full period (BR-2). Pending verification counts as met but is flagged in the reason.                                                                                                                                                                                                                                               |
| BR-5.3 | `softScore = round(100 × met / total)` over the soft qualifications **plus the two affinity items of BR-5.6** (so `total ≥ 2`). Changed 2026-10-22 (matching-v18, T-84): it was the soft qualifications only, 100 without any.                                                                                                                                                                                             |
| BR-5.4 | The shift is **informational** (displayed, not scored). Experience is a hard rule only when the requirement states a minimum (BR-3.12); base and English count as affinity (BR-5.6).                                                                                                                                                                                                                                       |
| BR-5.5 | Results are ordered: eligible first, then `softScore` desc, then candidate id (stable).                                                                                                                                                                                                                                                                                                                                    |
| BR-5.6 | v1.8 affinity (`src/business.js:155-160`, T-84), always evaluated, **never a blocker**: «Inglés técnico» is met with a declared English level B2, C1 or C2; «Base habitual o movilidad aceptada» with the same base as the requirement (compared without case or extra spaces) or a mobility other than `local`. v1.8's third item, «Tarifa dentro del presupuesto», is not ported: the minimum rate is owner-only (T-33). |

## BR-6 Capacity — `evaluateCapacity()`

```
required            = requirement.headcount            (must be ≥ 1, else InvalidRequirementError)
internallyEligible  = count(evaluateMatch(requirement, c).eligible for c in internal workforce)
gap                 = max(0, required − internallyEligible)
coveragePercent     = min(100, internallyEligible / required × 100), rounded to 2 decimals
```

- Capacity uses the **same** `evaluateMatch()` as matching. No second algorithm.
- Surplus is not negative gap: `required 2, eligible 3 → gap 0, coverage 100`.

## BR-7 Pools

| Pool     | Definition (V0)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Internal | Technicians who are members (any role) of the requirement's organization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| External | Technicians with `visibility ∈ {anonymous, open}`, not members of the organization, holding at least one of the requirement's qualification types. Max 100 evaluated per call. Selection order before the cap (`20261015130300`): **candidates who pass every hard filter of BR-3 first** (same date and availability rules as `evaluateMatch`, asserted by a parity test), then most hard types active + verified, then active, then id. So when ≤ 100 candidates are eligible, all of them are evaluated. `get_requirement_external_pool_summary` returns counts (prefiltered, hard-eligible, cap) and the UI says whether the result is complete, trimmed near misses only, or **partial** (more eligible candidates than the cap). |

The «pass every hard filter of BR-3 first» order includes the profile requirements (BR-3.7–3.13, `20261023900100`),
so an eligible candidate is never cut by the cap for them either. For an organization, each candidate row carries
only the declarations its requirement's verdict can use beyond the passport card (BR-18): the engines and capabilities
the requirement asks for, the type ratings of its category on its aircraft (validity and whether restricted, never the
text) and the mobility (BR-5.6).

Internal candidates are named. External candidates are shown with a per-requirement pseudonymous
reference unless the professional chose `open` visibility. A professional who **blocked** the requirement's
organization is not one of its external candidates (`20261023100300`, T-35, BR-18); the internal pool is
membership and is not affected.

## BR-8 Visibility

| Value           | Meaning                                                                                                                                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private`       | Default. Never appears in external matching.                                                                                                                                                                                                                                                               |
| `anonymous`     | Matchable. Qualifications shown, identity hidden (pseudonymous ref).                                                                                                                                                                                                                                       |
| `verified_orgs` | «Empresas verificadas» (OD-5 default = v1.8 «Perfil anónimo para organizaciones verificadas.», T-50; LOCAL `20261023500000`/`500200`). Matchable **only** by an organization whose review is registered (BR-20), always pseudonymous like `anonymous`; for any other organization it behaves as `private`. |
| `open`          | Matchable. Display name visible. Contact still requires consent (LATER).                                                                                                                                                                                                                                   |

Implemented in SQL by `app_private.ranked_external_pool` (the candidate filter of the external pool and its
summary) and in `src/domain/organization.ts` `isExternallyMatchable(visibility, organizationReviewStatus)`; the
parity for every visibility × review state is asserted in `tests/db/admin-org.test.ts`. Members of the
requirement's organization are in the internal pool whatever their visibility. Applying is the professional's own
act (S-7 exception): an applicant is visible to that organization whatever their visibility. IMPLEMENTED (local).

**«Red visible» (v1.8 `Dashboard.jsx:24`, T-146; LOCAL `20261024600000`).** The organization home counts the
professionals this organization can find in the network: `count_visible_network(org)` = the same candidate filter
(this visibility table, a registered review for `verified_orgs`, not a member of the organization, not blocked by the
professional — BR-18/T-35) without the requirement's qualification filter. A number only, for admin/manager of that
organization (42501 otherwise); `tests/db/shell-visual.test.ts` proves it against `isExternallyMatchable`.
IMPLEMENTED (local).

## BR-9 Roles

Platform role (`profiles.platform_role`: `user` · `platform_admin`) is distinct from organization
role (`organization_members.role`: `member` · `manager` · `admin`). See `AUTHORIZATION.md`.

## BR-10 Time

All operational timestamps are stored as `timestamptz` and **displayed and entered in UTC** (aviation
convention; deterministic between server and browser). IMPLEMENTED.

## BR-11 Passport completeness — `profileCompleteness()`

**Since package passport (T-36, local 2026-10-22): the ten items of v1.8 connected** (`connectedModel.js:4`),
equally weighted, rounded percent, plus the ordered list of missing items so the UI shows one concrete next
step (CF-L03): professional name · base · main category · at least one declared aircraft · years of
experience > 0 · minimum rate > 0 · at least one work permit · **future** availability (an `available` or
`aog_only` window with `ends_at > now`; BR-4.8: «AOG only» is published availability) · a held course (an
active TRAINING qualification) · an own wallet document. The document item is **left out while the wallet is
off** (nine items; also when its count cannot be read). A verified qualification and the visibility are no
longer items (v1.8 counts neither; the 86 % cap in production disappears, verification still gates matching,
OD-3). Deterministic: the caller passes its `now` through `futureAvailabilityCount`. IMPLEMENTED (local).
Shown as **"Profile completeness"**, next to "Verified N of M" and the count awaiting review: 100 % means
the profile items are done, **not** that the professional or any qualification is verified (remediation
2026-10-15, UX 8.2). The passport page shows the same percentage as v1.8's badge «{%} completado · {n}
evidencias» (n = own wallet documents; only the percentage without the wallet, T-37).

## BR-12 Document expiry state — `documentExpiryState()`

Wallet documents (owner only, D-10) show one state per document, by UTC date (BR-10): no expiry date →
**no expiry** · `expiresAt < today` → **expired** · `today ≤ expiresAt ≤ today + 45 days` → **expires
soon** (expiring today counts as soon) · later → **valid**. Same thresholds as v1.8 `documentStatus`
(45 days). Display only: it never changes eligibility (qualifications decide that, BR-2/BR-3).
IMPLEMENTED (local, batch 4; documented by the second audit 2026-10-20). The same chip is shown on the
qualifications list (batch 14). **Review list** — `isDueForReview()`: the professional's overview lists every
active qualification and (wallet on) every own document whose declared expiry is `≤ today + 60 days`,
**expired included** («Fecha superada» / «Próximos 60 días»), with a link to the list it belongs to.
Two windows on purpose, as in v1.8 (`documentStatus` 45 d vs `Badges` 60 d). Declared dates are never
treated as verification; no external reminder is sent (TD-44, batch 14).

## BR-13 Application transitions — `src/domain/applications.ts`

The D-06 state table of `APPLICATIONS_STATE_MACHINE.md` (ratified 2026-10-22: Q2–Q6, **Q7 no `accepted → rejected`**,
R-08): 9 states, 4 terminal; the technician applies, accepts, withdraws before confirmation and may cancel a confirmed
assignment (Q3); everything else is the organization's (admin/manager); a 1–1000 character reason exactly for
`rejected` and `cancelled`; `accepted → proposed` is a new immutable proposal version that needs a new acceptance of
**that** version (R-08). Server rules (LOCAL `20261022130300`, rls suite V; reasons = `APPLICATION_CONFLICTS`):
shortlist and propose need an `open` requirement (`REQUIREMENT_NOT_OPEN`), propose a period not started
(`REQUIREMENT_STARTED`); accept names the current proposal (`PROPOSAL_STALE`) of a requirement that is not closed;
**confirm re-checks everything at commit**: requirement open and not started, hard qualifications (BR-2/BR-3,
`QUALIFICATION_INVALID`), availability 100 % with BR-4.8 (`AVAILABILITY_INCOMPLETE`), no overlapping confirmed
assignment of the technician (`OVERLAPPING_ASSIGNMENT`), seats (confirmed + finished) below headcount
(`HEADCOUNT_REACHED`; the last seat sets the requirement `covered`, cancelling a confirmed seat of a covered one sets
it back to `open`); finish only once the period ended (Q4, `PERIOD_NOT_ENDED`); reject, withdraw and cancel are always
possible from their rows, also on paused or closed requirements. Every success writes one event and one audit row
`application.<to>` in the same transaction. IMPLEMENTED (local).

**v1.8 profile requirements and restrictions (matching-v18, `20261023900200`, trigger `applications_profile_rules`).**
Applying and confirming also re-check the requirement's profile rules (BR-3.7–3.13, `PROFILE_REQUIREMENTS_UNMET`,
CFA14), after the RPC's own checks. **Confirming** is refused while the professional declares **general restrictions**
(BR-18; `RESTRICTIONS_DECLARED`, CFA15; T-87 = v1.8 connected «Perfil o restricciones pendientes de revisión.»,
`server/app.mjs:122`); applying is not. Other transitions are not re-checked. v1.8's «La organización requiere revisión
administrativa.» at confirmation is still not ported (T-52). IMPLEMENTED (local).

## BR-14 Opportunities (D-12, owner 2026-10-22) — `list_opportunities`

Every professional account — whatever its visibility, `private` included — lists the **published, current**
requirements of every organization: `open` and `endsAt` in the future (draft, paused, covered, closed, legacy
cancelled and ended ones are not listed; a started one still is, but cannot be applied to). They see one fixed
projection: title, base, period, shift, headcount, urgency, required qualifications and the organization's **name**
— never who created it, the organization id, other applicants or counts. Order: soonest start first, then id.
Filters: urgency, «Compatibles» (eligible now) and a literal text search on title, base, organization name or a
required qualification's code or name (T-91, LOCAL `20261024100000`). Eligibility is shown separately and computed
with `evaluateMatch` on the professional's **own** data, every failed rule explained; publication never makes anyone
eligible. The function considers at most 200 requirements per call and says so (`considered`, `cap`). **Never the
caller's own organizations' requirements** (v2-27, T-90): a member — whatever their role — does not see them as
opportunities. **«Ofertas en la red»** (v2-20, T-95): a member of any organization lists the same projection without
any eligibility (no «Compatibles»), its own organization's requirements excluded; never a commission (`✗`).
IMPLEMENTED (local).

**BR-14.1 «Posible en descanso»** (N-17, v1.8 demo `homeModel.js:6-15`, T-17): an opportunity the professional could
apply to but for availability — `applyBlocker` is `NOT_ELIGIBLE` and every blocker is `NOT_AVAILABLE` or
`PARTIAL_AVAILABILITY` — and whose period holds no blocked time for its urgency (`unavailable`, or `aog_only` when the
need is not AOG; BR-4.2/BR-4.8): publishing the rest days (no window at all) as available would cover it.
`possibleOnRest()` (pure, `src/domain/availability.ts`) is returned by `opportunities` as `possibleOnRest`, with the
filter `rest=1` (with `eligible=1` too: either). A hint for the professional only; it never makes anyone eligible
(BR-3). «Mi espacio» lists them when there is no compatible one, marks only their rest days with the red dot and offers
«Revisar fechas» (the calendar on that month). IMPLEMENTED (local).

## BR-15 Applying (D-06 Q5/Q6, T-08, T-09) — `applyBlocker` / `apply_to_requirement`

A professional may apply when the requirement is `open` and has not started, they have no application to it that is
not `withdrawn` (an active one → `ALREADY_APPLIED`; one that ended `rejected`, `cancelled` or `finished` →
`REAPPLY_NOT_ALLOWED`: re-applying is allowed only after `withdrawn`), and they are eligible **now** (hard
qualifications, the requirement's v1.8 profile requirements — BR-3.7–3.13, `PROFILE_REQUIREMENTS_UNMET` — and
availability, T-08). One application covers the requirement's single period (Q6). Applying needs
the explicit share consent of the form (required by the database too and recorded as a flag in the audit row); it reserves nothing in the calendar, and nothing is shared beyond the
candidate-pool view (pseudonym unless internal or `open`; D-07 consents are not implemented). Once **confirmed**, the
assignment's days are protected in the calendar and on the server (BR-4.9, T-15; T-13 superseded). A member (any role)
of the requirement's organization is refused last, after every other reason (`OWN_ORGANIZATION`, `CFA13`; v2-27,
T-90, LOCAL `20261024100000`). IMPLEMENTED (local).

## BR-16 Daily learning challenge (SCOPE-2, v1.8 default) — `src/domain/learning.ts`

Tools only: a learning streak or medal is never a qualification, never shown to an organization and never read by
matching (BR-3). The challenge of a day is **5** (default) **or 10** questions from a fixed editorial bank of 158
(`src/features/tools/learning/questions.ts`, catalogue 2026-10-13.1, pending formal review), chosen as v1.8
`progress.js` does: each group (Fundamentos, ATA, Inglés, Siglas) shuffled by a 32-bit FNV-1a hash of `date + id`
and interleaved in that order, so the first 5 of the 10 are the 5; each question shows its answer and 3 distinct
distractors of its group, ordered by hash (parity test on three dates). The **day** is the calendar day in
`Europe/Madrid` (v1.8 default, TOOL-07 #3) — an exception to BR-10, which governs operational times only. A day
counts once every question is answered, right or wrong; a completed day cannot be repeated, and a challenge left
open when the day changes is closed (the page says so) and does not count. Streaks: **current** = consecutive
completed days up to today (today not yet done does not break it until tomorrow), **best** = longest run,
**total** = completed days up to today; medals at best ≥ 1, 7 and 30 days. Progress stays in the browser
(`localStorage` key `crewflex-learning-<user id>`, the authenticated user only), with question ids and chosen
answers only. IMPLEMENTED (local).

## BR-17 Personal logbook (M14, N-12; SCOPE-2) — `src/domain/logbook.ts`

A professional keeps a private, **self-declared** record of work done (v1.8 «Logbook personal»; FD-25: it is not an
official record, a certification of experience or a release to service, and nobody validates it).

1. **Fields** (union of v1.8 connected and demo, T-20): task date; aircraft, free text 1–100 (the 12 v1.8 models are
   suggestions); ATA chapter, optional, ≤ 10; hours 0–24 in steps of 0.1; task category (6 v1.8 values, default
   «Defect Rectification»); environment (5 v1.8 values, default «Line Maintenance»); private technical description
   1–3000; «Seleccionable para expediente» (default off). Text is trimmed; blank is empty.
2. **No future dates:** the date may not be after **today in Europe/Madrid** (v1.8 `localDay('Europe/Madrid')`,
   T-19) — «El logbook registra actividad realizada, no futura.» Checked by the shared schema, the Edge Function and
   a database trigger (also when an entry is re-dated).
3. **Lifecycle:** create (idempotent), edit any field, archive and restore (v1.8 «Archivar» / «Restaurar»); the list
   shows the active or the archived entries, newest first (date, then creation), at most 500 per view with the total.
   An archived entry can be deleted permanently by its owner (T-22; v1.8 had no delete).
4. **Privacy:** owner only — no organization (not even the technician's own), manager or platform admin reads an
   entry; the audit trail keeps ids and changed field names only, never a value. **The one exception is the
   professional's own act:** when they apply, the entries marked «Seleccionable para expediente» and not archived
   (the newest 20) are copied into that application's Candidate Pack copy, listed under «Experiencia que compartes»
   before the consent (BR-25, T-112; it supersedes T-21). Later edits do not change a copy already sent. The flag
   never reaches the audit trail.

IMPLEMENTED (local, 2026-10-22; migration `20261023200000`, `professional-logbook`, `/app/professional/logbook`).
candidate-pool view (pseudonym unless internal or `open`; D-07 consents are not implemented). Availability edits after
a confirmation are not blocked (T-13). IMPLEMENTED (local).

## BR-20 Organization review (OD-5 default = v1.8 connected, T-50…T-52) — `reviewBlocker` / `review_organization`

An organization is `pending` until a platform admin registers its review («Revisión registrada»). Its admin keeps
the data on «Organización»: name («Razón social»), type, tax ID («Identificación fiscal», ≤ 80), registered address
(«Domicilio fiscal», ≤ 400) and country (one of the 27 EU countries, T-51); every field is required on save. Any
change of those fields returns a reviewed organization to `pending` (a save that changes nothing keeps the review).
A platform admin may register the review only of a `pending` organization whose fiscal data and country are complete,
for the version they looked at, with a mandatory evidence note (1–2000) — and never of an organization they belong to, belonged to (removals are audited) or acted for
(«La empresa no puede verificarse a sí misma»). There is no «reject»: an organization stays `pending` until reviewed
(v1.8 has only «Registrar revisión»). A registered review is what `verified_orgs` (BR-8) asks for; it gates nothing
else yet (v1.8 also refused to confirm an assignment for a pending organization — not ported, see T-52). IMPLEMENTED
(local).

## BR-18 Passport declarations (package passport, T-30…T-35) — `src/domain/passport.ts`

The v1.8 passport fields are the professional's **own declarations**, saved with the rest of the passport in one
transaction (`save_professional_passport`, version check I-3) and CHECK-constrained to the domain catalogs:

| Field                                 | Rule                                                                                                                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main category + categories            | Any of the 12 v1.8 categories (B1.1…B3, Cat A, Cat C, Mecánico, Sheet Metal, NDT, Helper); the main one is among them, required once any is declared, never `""` (T-30)                              |
| Aircraft                              | Any of the 12 v1.8 aircraft (T-30)                                                                                                                                                                   |
| Type ratings                          | Aircraft × licence category (the 8 licences, not the 4 trades), optional validity, restrictions ≤ 500; ≤ 40; each on a declared aircraft and category, once (T-31)                                   |
| General restrictions                  | Free text ≤ 2000; blank = none (T-31)                                                                                                                                                                |
| English, engines, capabilities, tools | A1–C2; the 7 v1.8 engines; the 9 v1.8 capabilities; «own tools» yes/no (T-32)                                                                                                                        |
| Base country, work permits            | The 27 EU member states; the base itself stays free text (T-34)                                                                                                                                      |
| Minimum rate                          | ≥ 0.01, ≤ 100 000, EUR per hour or per day; **owner-only**, no money moves (T-33) — except in the Candidate Pack copy of an application, previewed before the consent (BR-25, T-111)                 |
| Phone, current employer               | **Owner-only**; never shared (D-07; no sharing path exists) (T-35)                                                                                                                                   |
| Blocked organizations                 | **Owner-only**, ≤ 200. A blocked organization does not get the professional in its **external** pool or counts (BR-7); membership, the opportunities list and own applications are unaffected (T-35) |

**Used by matching since package matching-v18 (2026-10-22).** The declarations decide the v1.8 profile requirements
a requirement states (BR-3.7–3.13: work permits, categories, aircraft, type ratings with validity and restrictions,
engines, years, capabilities) and the affinity of the soft score (BR-5.6: English, mobility); declared general
restrictions block the **confirmation** (BR-13, T-87). The verified catalog qualifications (BR-2/BR-3) still decide on
their own as well. Organizations see — in the candidate card, with the
pool's pseudonym and visibility rules — the main category, categories, aircraft, English, work permits and whether
restrictions are declared (`get_requirement_candidate_passports`), never the restriction text, contact, employer,
rate or blocks. The professional's own act of applying is the one exception for the restriction texts and the
minimum rate: the dated copy that organization receives carries them, shown to the professional before the consent
(BR-25, T-111); contact, employer and blocks never. IMPLEMENTED (local).

## BR-22 In-app notices (v2-18, T-70…T-73) — `notifications` / `src/features/notices/view.ts`

Every application event tells **the other party** of whoever acted, in the same transaction: the organization acts
→ the applicant; the technician applies, accepts, withdraws or cancels → every admin/manager of the requirement's
organization except the applicant (a new application is «Nueva candidatura»; every other change «Actualización de
candidatura · {necesidad} · {estado}» with the translated status, never the raw code). Pausing, resuming and closing
a requirement tell each technician with an **active** application (received … confirmed); covered ↔ open is not told
(the confirmation or cancellation already was). The actor is never told of their own act; plain members never
receive notices. «Nuevo» until the notice is opened or «Marcar todas como leídas»; opening leads to the application
(technician: its card in «Mis candidaturas»; organization: the requirement's applications). While unread, a
notice takes the next event about the same technician and requirement (a new status, pause/resume/close, or
applying again after withdrawing) instead of a new one. Kept 180 days
and the newest 200 per reader (T-73). In-app
only (e-mail, SMS, push: OUT). «Distribución Urgente/AOG» (v2-17) writes a third kind of notice: BR-26. IMPLEMENTED (local).

## BR-19 Account data rights and sign-up by invitation (PKG account; T-40, T-42, T-43) — `close_my_account` / `handle_new_user`

- **Closing an account** (v1.8 `account.close`, without its partial delete): the person types the word of their UI
  language (`CERRAR` / `CLOSE`). Refused while they have an application `accepted` or `confirmed`, or are the last
  admin of an organization whose requirements have one (`ACTIVE_COMMITMENTS`). Applications `received`,
  `shortlisted` or `proposed` are withdrawn explicitly (an event and an audit row each), never silently; the others
  keep their status. An organization whose last admin closes the account closes its draft, open and paused
  requirements (T-12 still holds: their other applications do not move). Applications, requirements and audit rows
  stay without the profile; the Candidate Pack copies of the person's applications do not (BR-25, T-113). The same
  rules apply whoever deletes the account. IMPLEMENTED (local).
- **Export** (v1.8 «Exportar mis datos y archivos»): only the person's own records (the Candidate Pack copies of
  their applications included, BR-25), never another person's data nor the audit trail; wallet files embedded (base64) while their total is ≤ 3 MiB (`filesToEmbed`, oldest first, each
  file that still fits), the others listed. IMPLEMENTED (local).
- **Sign-up by invitation** (owner flag `invitation_signup`, off by default): a code is valid 7 days, for one sign-up,
  by the invited address only; the invitation decides the account type (professional or organization, never platform
  admin); a code of another address is refused and not consumed. Without the flag, open sign-up. IMPLEMENTED (local).

## BR-23 Confirmed coverage (v2-08, T-92, T-93) — `src/domain/coverage.ts` / `get_requirement_application_counts`

A seat is taken by a `confirmed` or `finished` application — the rule of the confirm step and of `covered` (BR-13).
**Confirmed coverage** of a requirement = `min(seats, headcount)` ÷ headcount, rounded to a whole percent (v1.8
`business.js:121-132`, `Math.round(filled / max(1, total) × 100)`): «{p}% cobertura confirmada» + bar on the list and
the detail (with «x / n plazas confirmadas»), «{p}% cubierto» on the dashboard rows. **«Jornadas cubiertas · Solo
asignaciones confirmadas»** (dashboard) = Σ over the organization's requirements of filled seats × days, where days =
its shifts (v2-09) or, without shifts, the started 24-hour blocks of its period (at least one); one application covers
every shift (Q6). Counted from `get_requirement_application_counts` (admin/manager only, counts per status per
requirement with headcount, period and shift count; a closed account's application still counts, T-42). Plain members
see the status chips only. IMPLEMENTED (local).

## BR-24 Document wallet trash and type filter (N-19, N-20; T-100…T-102) — `walletList` (`src/features/documents/map.ts`)

v1.8 demo «Archivar» / «Papelera» / «Restaurar» (`Professional2.jsx:210-219`), on the owner's own documents only:

| Rule    | Statement                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-24.1 | «Archivar» moves a document to the trash: `archived_at` is set by the database clock (a client value is ignored; archiving again keeps the first date); «Restaurar» clears it. Both audited, ids only.                   |
| BR-24.2 | A document in the trash counts for nothing else: not in the wallet list, the 60-day review list (BR-12), the evidence count and «Documento aportado» (BR-11, T-36/T-37) or a qualification's evidence (T-101).           |
| BR-24.3 | It stays restorable for `archive_retention` (default **30 days**, T-100, a database setting); from `archived_at + retention` the platform-admin maintenance may delete it and its file (`trash_expired`, audited).       |
| BR-24.4 | «Eliminar definitivamente» (in the trash) deletes the row and its file at once (`owner_delete`, as before); the API `DELETE` still accepts any own document (erasure).                                                   |
| BR-24.5 | The type filter (N-20, T-102) offers «Todos», «Licencias», «Cursos», «Otros» (`all` + the three kinds) in the wallet and the trash; the panel counter is the number of documents the list shows.                         |
| BR-24.6 | Data rights (account package, T-42/T-43): closing the account erases trashed documents with the rest (`owner_delete`, due at once; nothing left to restore or expire); the export includes them, marked by `archivedAt`. |

Display and storage only: no rule here changes eligibility (qualifications decide, BR-2/BR-3), and nothing is shared
(D-07/D-10). IMPLEMENTED (local, `20261024200000`).

## BR-25 Candidate Pack copy (v2-15 + v2-04; T-110…T-116) — `application_packs` / `src/domain/candidate-pack.ts`

v1.8 «Candidate Pack» (`Workflow.jsx:17-33`, connected `server/app.mjs:110`) without what D-07 keeps locked.

1. **Frozen when applying.** Every new application gets a copy of the professional's technical profile, in the
   same transaction (a database trigger, so every path that creates an application — applying again after
   `withdrawn` included — freezes its own). Later changes to the passport, the qualifications or the logbook never
   alter it: «Copia del perfil: {fecha}. Los cambios del pasaporte y del logbook no alteran esta versión.» (T-115).
2. **Content (T-110…T-112):** main category and categories, years, English, base and its country, aircraft,
   engines, declared type ratings (validity, restrictions), active catalog qualifications with verification and
   expiry («Cursos» = TRAINING, with the v1.8 state — Sin caducidad / Vigente / Caduca pronto / Caducado — read
   when the copy is viewed), capabilities, work permits, general restrictions, the declared minimum rate and the
   logbook entries marked «Seleccionable para expediente» and not archived (newest 20).
3. **Never in it:** real name (the card keeps the pool's naming rule, T-04), e-mail, phone, current employer,
   blocked organizations, documents, file names or their metadata. While `PACK_ACTIVATION` is off the copy says
   «Los originales, nombres de archivos y metadatos identificativos permanecen protegidos.» and nothing unlocks
   (D-07 P3 open).
4. **Consent sees the content (T-111):** the apply panel shows «Qué compartes con {organización}» — the copy as it
   would be frozen now, from the same builder, with «Experiencia que compartes» — above the consent; while that
   preview cannot be loaded nothing can be sent. Free text (restrictions, logbook aircraft and description) is copied
   as written: the restrictions field, the logbook flag and the preview warn against health data, registrations,
   operators and names (residual risks in `SECURITY_PRIVACY.md`).
5. **Who reads it (T-113):** the applicant and the admins/managers of the requirement's organization at reading
   time; nobody else (the same answer as a missing id). An application that ends without an engagement —
   withdrawn, rejected or cancelled — loses its copy; a finished one keeps it; closing the account deletes every copy
   of the person (BR-19). Only the professional's own application writes a copy.
   Applications sent before the copies existed have none. Reads are not audited (T-114). The professional's own
   copies are part of «Exportar mis datos» (BR-19).

IMPLEMENTED (local, migration `20261024300000`, `applications` GET `view=pack` / `view=pack-preview`, «Ver
expediente» on the requirement's applications, the organization's «Candidaturas» — the same card,
`OrgApplicationCard` — and «Mis candidaturas»).

## BR-26 Urgent/AOG outreach and notice preferences (PKG outreach, v2-17 / N-10; T-120…T-129) — `requirement_outreach` / `src/domain/outreach.ts`

- **Preferences (N-10, v1.8 connected «Avisos de oportunidades»):** «Quiero avisos internos de trabajos urgentes»,
  «Quiero avisos internos AOG» (separate consents, both off until saved), «Horas mínimas que necesitas para
  movilizarte» (whole hours 0–720, optional), «Zona horaria IANA para avisos» (default Europe/Madrid; «Zona horaria no
  válida.»), «Silencio desde/hasta (opcional)» (both or neither, different times, overnight when the start is later;
  «Horas de silencio no válidas.»). Owner-only: no organization, colleague or platform admin reads them. «Sin
  movilización declarada no se distribuyen avisos. El silencio también se respeta para AOG; no se envían correos o
  SMS.» `isIanaTimeZone`, `isValidQuietHours`, the schema `noticePreferencesInput`; the database re-checks every rule
  (zone against its own list). IMPLEMENTED (local).
- **Who may distribute:** an admin or manager of the requirement's organization (role from the database), on an
  `open` need (not draft, paused, covered, closed or archived) whose declared urgency is `urgent` or `aog` (C-8:
  never deduced from the date) and that has not started — **once** per requirement (two clicks at once: one wins, the
  other «Esta necesidad ya se distribuyó.») and at most 10 needs per organization in 24 h. `canDistributeOutreach` decides whether «Distribuir aviso Urgente / AOG»
  shows; the database refuses everything else (`OUTREACH_CONFLICTS`, SQLSTATE CFO01…CFO05).
- **Audience** (all in one database function, v1.8 `server/app.mjs:89-105`): professionals the organization may reach
  outside itself — its external candidate pool: not `private`, `verified_orgs` only for a reviewed organization (BR-8),
  not a member of the organization, not blocking it (N-08) — who have no general restriction and no restricted type
  rating the need asks for (T-124), opted in for **that** urgency, declared a mobilization the start respects (and
  within the need's `maxMobilizationHours` when stated), are outside their quiet hours in their own time zone now,
  have no application to that need other than a withdrawn one, are eligible
  (`app_private.hard_eligibility`: hard qualifications valid for the period, availability covering it) and were not
  notified for it before. Of those, whoever already got 3 outreach notices from that organization in the last
  24 h is not sent another one (delivery bound, T-126); the count still includes them.
- **What each recipient gets:** one in-app notice «{Urgente|AOG}: {título}» · «{organización} · Consulta las
  condiciones y decide si quieres presentar candidatura.», «Nuevo» until opened, «Ver oportunidad» → the opportunity;
  listed only while the need is published and current. E-mail, SMS and push: OUT.
- **What the organization learns:** the count only — «{count, plural, one {# aviso interno creado} other {# avisos
  internos creados}}. Se respetan consentimiento, disponibilidad y silencio. No se han enviado emails.», then
  «Distribuida el {fecha}: {n} avisos internos.» on the need — and **no number** when fewer than 5 professionals of
  its external pool are eligible for the need and not already its applicants (the organization sees those). Never
  who received it nor why someone did not (ORG-06 #4, #5); the audit row `requirement.outreach_distributed` carries the count and the urgency. IMPLEMENTED (local).

## BR-27 Recruiter: represented clients (D-12 provisional model; T-130…T-135) — `src/domain/recruiter.ts` / `represented_clients`

A recruiter is an ordinary organization of type `staffing_agency` that represents clients (`docs/product/RECRUITER_MODEL.md`;
v1.8 `Company2.jsx:103,211`, `Marketplace.jsx:36-44`). No platform or cross-organization role; `platform_role` is untouched.

| Rule    | Statement                                                                                                                                                                                                                                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-27.1 | Only a staffing agency represents clients. Its admins/managers add a client (name 2–120, optional contact e-mail; one live client per name, ≤ 50 pending and ≤ 200 pending or active) and revoke it; every member of the agency reads the portfolio, its admins/managers and platform admins also the contact e-mail; nobody else reads anything. |
| BR-27.2 | A client is `pending` when added and becomes `active` only when a platform admin records the evidence of the representation — never for an agency they belong to, belonged to or acted for (the BR-20 rule). Revocation is final; the client is added again as a new one (T-130).                                                                 |
| BR-27.3 | A staffing agency publishes (creates as non-draft, publishes a draft, resumes a paused requirement) only for an **active** client of its own: «Selecciona un cliente.» in the builder, «Indica el cliente representado.» from the server (CFR01); a draft may wait (v1.8). Other organization types never carry a client (T-132).                 |
| BR-27.4 | The client of a requirement changes only while it is a draft: the client a professional reads on a published requirement is the one who receives the data (55000 afterwards; CFA12 once applied to, as every field, M05). For another client the agency publishes another requirement.                                                            |
| BR-27.5 | While the representation is not active nobody acts for that client: the requirement is not listed in «Oportunidades» / «Ofertas en la red», refuses new applications and every forward step (shortlist, propose, accept, confirm: CFR02). Withdraw, reject, cancel, finish, pause and close stay possible; nothing moves by itself (T-133).       |
| BR-27.6 | Professionals see the client's **name** next to the agency's — «Publicada por {org} para el cliente {cliente}» on the card and the detail — and the apply consent names both («Autorizo compartir con {org}, para su cliente {cliente}, …»). Never the client's contact (T-134).                                                                  |
| BR-27.7 | The organization type is no way around the rules: an organization becomes a staffing agency only without published (open/covered) requirements lacking a client, and stops being one only without live clients and without published requirements for a client (55000; drafts and paused ones do not block — resuming re-applies BR-27.3).        |

Every rule is enforced in the database for every path (RPCs and BEFORE triggers, `20261024500000/500100`); the domain
functions only let the screens say it first (`clientRequired`, `canActForClient`, `activationBlocker`). IMPLEMENTED (local).

## BR-29 Profile medals (N-15, T-143) — `badges()` (`src/domain/badges.ts`)

v1.8 `badges()` (`src/features/progress.js:3-11`) over the professional's **own declarations** (BR-18), shown only
to them («Mi espacio» hero and «Pasaporte visual» of the passport):

| Rule    | Statement                                                                                                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-29.1 | One medal per declared category (the main one first); NDT and Sheet Metal are specialties (wrench), the rest licence shields. A declared NDT / sheet-metal skill without that category adds a specialty. |
| BR-29.2 | One medal per declared type rating («{aircraft} · {category}»): «Revisar vigencia» when its declared validity ended before today (UTC), else «Con restricciones» with its text, else «Tipo declarado».   |
| BR-29.3 | One experience medal when the declared years are > 0 («Experiencia declarada»).                                                                                                                          |
| BR-29.4 | Next's «Verificada» replaces «Declarado» on a category whose code matches an active qualification a platform reviewer verified and whose expiry is not before today.                                     |
| BR-29.5 | The main strip shows experience, the first category, the first aircraft and the first specialty; the rest behind «+N». Declared aircraft without a type rating make no medal (v1.8).                     |

Display only: a medal makes nobody eligible (BR-2/BR-3) and grants no signing authority (v1.8 footnote, shown with
every detail); organizations never see medals. IMPLEMENTED (local, no migration).
