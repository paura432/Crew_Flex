# Data Model V0

> **Local vs production (2026-10-15).** Production has only migrations `20261009120000` and `20261009120100`.
> Every object, rule enforcement or control below that cites a migration dated `20261011…` or `20261015…`
> exists **only in the local database** until the authorized rollout (`docs/audit/CREWFLEX_DIFF_CURRENT.md` §5;
> state in `memory-bank/01-current-state.md`).

Source of truth: `supabase/migrations/`. This document explains intent.

Principle: **source of truth + deterministic calculation**. Matches and capacity are computed on
demand, never persisted (no duplicated derived state).

## Entity diagram

```
auth.users 1─1 profiles 1─0..1 technician_profiles 1─* technician_qualifications *─1 qualification_types
                  │                        ├──────────1─* availability_windows
                  │                        └──────────1─* logbook_entries (owner only, M14)
                  │                        ├──────────1─* technician_type_ratings (declared, package passport)
                  │                        ├──────────1─0..1 technician_private_details (owner only)
                  │                        ├──────────1─* technician_organization_blocks *─1 organizations (owner only)
                  │                        └──────────1─0..1 technician_notice_preferences (owner only, PKG outreach)
                  │
                  └─* organization_members *─1 organizations 1─* work_requirements 1─* work_requirement_qualifications *─1 qualification_types
                                                       ├─* organization_reviews (evidence, platform admins only)
                                                       └─* represented_clients (staffing agency) 1─* represented_client_reviews
                                                              0..1 ─ work_requirements.on_behalf_of_client_id (recruiter, LOCAL 20261024500100)
                                         work_requirements 1─0..1 outreach_distributions (count only, PKG outreach)
                                         work_requirements 1─* notifications (kind `outreach`, PKG outreach)
                                                                                 │
technician_profiles 1─* applications *──────────────────────────────────────────┘  (one per technician × requirement, except withdrawn)
                          ├─* application_proposals (immutable versions, R-08)
                          ├─* application_events (timeline)
                          ├─0..1 application_packs (Candidate Pack copy frozen when applying, v2-15)
                          └─* notifications *─1 profiles (recipient; in-app notices, v2-18)

audit_events (append-only, written by triggers)
account_invitations (sign-up by invitation, owner flag; LOCAL 20261023400000)
```

## Tables

### `profiles`

One row per auth user. **`id` = `auth.users.id`** (no separate `auth_user_id`, no duplicated email
or password). Created by trigger `on_auth_user_created`.

| Column                      | Type                                         | Notes                                                                                         |
| --------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `id`                        | uuid PK → `auth.users(id)` on delete cascade |                                                                                               |
| `display_name`              | text 1–120                                   | Updatable by the owner (with `preferred_locale`).                                             |
| `account_type`              | `professional` · `organization`              | Chosen at sign-up. UX routing only; **grants no permission**.                                 |
| `platform_role`             | `user` · `platform_admin`                    | Default `user`. Never read from sign-up metadata, not updatable by users.                     |
| `preferred_locale`          | `es` · `en` · null                           | UI language (phase 1.5). Updatable by the owner (column grant). NULL = cookie/browser decide. |
| `created_at` / `updated_at` | timestamptz                                  |                                                                                               |

### `technician_profiles`

| Column             | Type                                            |
| ------------------ | ----------------------------------------------- |
| `profile_id`       | uuid PK → `profiles(id)`                        |
| `base_location`    | text ≤ 80, nullable                             |
| `mobility`         | `local` · `national` · `international`          |
| `years_experience` | int 0–60, nullable                              |
| `current_status`   | `employed` · `contractor` · `between_contracts` |
| `visibility`       | `private` (default) · `anonymous` · `open`      |

Created by trigger for `account_type = professional` only; API roles have no INSERT grant (`20261015120000`).
`visibility` also takes `verified_orgs` («Empresas verificadas», LOCAL `20261023500000`, BR-8): matchable only by
organizations whose review is registered.

**v1.8 passport declarations (`20261023100100`, LOCAL ONLY — package passport, BR-18, T-30…T-35).** Readable like
the row (owner · own-organization admin/manager · platform admin); **no write grant**: written only by
`save_professional_passport`. CHECKs repeat `src/domain/passport.ts`.

| Column                 | Type                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `primary_category`     | text, nullable; one of `categories` (never `''`)                                                                  |
| `categories`           | text[] ⊆ the 12 v1.8 categories (`B1.1`…`B3`, `CAT-A`, `CAT-C`, `MECHANIC`, `SHEET-METAL`, `NDT`, `HELPER`), `{}` |
| `aircraft`             | text[] ⊆ the 12 v1.8 aircraft (`A320 Family` … `Robinson R44`), default `{}`                                      |
| `engines`              | text[] ⊆ the 7 v1.8 engines, default `{}`                                                                         |
| `skills`               | text[] ⊆ the 9 v1.8 capabilities (`line_maintenance` … `cabin_systems`), default `{}`                             |
| `english_level`        | `A1`…`C2`, nullable                                                                                               |
| `own_tools`            | boolean, default false                                                                                            |
| `base_country`         | one of the 27 EU ISO codes, nullable                                                                              |
| `work_permits`         | text[] ⊆ the 27 EU ISO codes, default `{}`                                                                        |
| `general_restrictions` | text ≤ 2000, nullable, never blank                                                                                |

### `technician_type_ratings` (`20261023100100`, LOCAL ONLY)

Declared type ratings (v1.8 `ratings`), not the verified TYPE_RATING qualifications matching reads. `id`,
`technician_profile_id` → `technician_profiles` on delete cascade, `aircraft` (12 v1.8 aircraft), `category` (the 8
licence categories), `expires_at` date nullable, `restrictions` text ≤ 500 nullable (never blank), timestamps;
unique (`technician_profile_id`, `aircraft`, `category`); ≤ 40 per professional (save function). RLS select: owner ·
`can_view_member` · platform admin; no write grant.

### `technician_private_details` (`20261023100100`, LOCAL ONLY) — owner only

`profile_id` PK → `technician_profiles` on delete cascade, `phone` (≤ 32, digits/spaces/`().-`, optional leading
`+`), `current_employer_id` → `organizations` on delete set null, `min_rate` numeric(10,2) 0.01–100 000 nullable,
`rate_unit` `hour` · `day` (default `day`), timestamps. Created by the first passport save. RLS select: **owner
only** (not the own organization, not platform admins); no write grant. D-07: no function returns it to anyone else,
except `min_rate` / `rate_unit` inside the Candidate Pack copy of the professional's own application (BR-25, T-111).

### `technician_organization_blocks` (`20261023100100`, LOCAL ONLY) — owner only

PK (`technician_profile_id` → `technician_profiles`, `organization_id` → `organizations`), both on delete cascade,
`created_at`; ≤ 200 per professional. RLS select: **owner only**; no write grant. Read server-side by
`app_private.ranked_external_pool` to leave the professional out of that organization's external pool (T-35) and,
through `app_private.technician_blocks_organization(profile, organization)` (`20261024800000`, v2-16, T-160), by
`list_opportunities`, `get_requirement_profile_rules` and `apply_to_requirement` to hide that organization's
requirements from the professional and refuse a new application (`CFA16`).

### `technician_notice_preferences` (`20261024400100`, LOCAL ONLY — PKG outreach N-10, T-120…T-123) — owner only

| Column                        | Type                                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile_id`                  | PK → `technician_profiles` on delete cascade (leaves with the account)                                                                                                                                |
| `urgent_opt_in`, `aog_opt_in` | boolean, default false — «Quiero avisos internos de trabajos urgentes» / «… AOG»                                                                                                                      |
| `mobilization_hours`          | integer 0–720, null = not declared (no outreach reaches the professional)                                                                                                                             |
| `time_zone`                   | text ≤ 64, IANA shape, default `Europe/Madrid`; trigger `technician_notice_preferences_time_zone` keeps only names of `pg_timezone_names` (case-insensitive, stored in its spelling; 22023 otherwise) |
| `quiet_start`, `quiet_end`    | time, both or neither, whole minutes, never equal; start > end spans midnight                                                                                                                         |
| `created_at`, `updated_at`    | timestamptz                                                                                                                                                                                           |

RLS: select / insert / update **own only** (`profile_id = auth.uid()`); column grants: insert of the form's columns
and `profile_id`, update of the form's columns (never `profile_id`); no delete grant. Written by
`save_notice_preferences` (SECURITY INVOKER, `auth.uid()`'s row) or directly under the same RLS and CHECKs. Read by
`requirement_outreach` as its owner; nobody else (not the organization, not platform admins). Listed in the account
export.

### `organizations`

`id`, `name` (2–160), `type` (`mro` · `airline` · `operator` · `staffing_agency` · `other`),
`country` (ISO 3166-1 alpha-2, nullable), timestamps. Created at sign-up for
`account_type = organization`, with the creator as `admin`.

**«Organización» and its review (LOCAL `20261023500100`, OD-5 default = v1.8 connected, T-50…T-52).** Added:
`tax_id` (≤ 80, nullable), `tax_address` (≤ 400, nullable) — organizations created at sign-up have neither —,
`review_status` (`organization_review_status`: `pending` default · `reviewed`) and `reviewed_at` (set exactly when
`reviewed`, CHECK). The admin edits name, type, country and the two fiscal fields through
`update_organization_profile` (or the same column grants); `review_status` / `reviewed_at` have no grant and are
set only by `review_organization`. Trigger `organizations_reset_review` (BEFORE UPDATE): any change of name, type,
country, tax id or address returns the organization to `pending`; trigger `organizations_audit_change` (AFTER, DEFINER)
writes `organization.updated` `{fields, review_reset}` with the organization id. The screen offers the 27 EU
countries (T-51); the column still accepts any ISO code (sign-up).

### `organization_reviews` (`20261023500100`, LOCAL ONLY)

`id`, `organization_id` (cascade), `reviewed_by` → `profiles` (set null), `note` (evidence, 1–2000, v1.8 «Evidencia /
observaciones de la revisión»), `organization_version` (the `updated_at` the reviewer saw), `created_at`. RLS select
platform admin only; no write grant (written by `review_organization`). The organization never reads it.

### `organization_members`

PK (`organization_id`, `profile_id`), `role` (`member` · `manager` · `admin`), `created_at`.
Organization role is independent from `platform_role`.

### `qualification_types`

Reference catalog. `id`, `code` (unique, e.g. `B1.1`, `TR-A320`, `EWIS`), `name`, `category`
(`LICENSE` · `TYPE_RATING` · `TRAINING` · `APPROVAL` · `SKILL`), `requires_expiry`, `created_at`.
Written only by migrations/seed (no user write grant). `20261023100000` (local, T-30) adds the v1.8 categories it
lacked: `B1.2`, `B1.4`, `B3` (LICENSE, expiry required) and `MECHANIC`, `SHEET-METAL`, `HELPER` (SKILL).

### `technician_qualifications`

| Column                  | Type                                            | Writable by owner                                                              |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `id`                    | uuid PK                                         | –                                                                              |
| `technician_profile_id` | → `technician_profiles`                         | insert only                                                                    |
| `qualification_type_id` | → `qualification_types`, unique per technician  | insert only                                                                    |
| `status`                | `active` · `withdrawn`                          | yes                                                                            |
| `issued_at`             | date, nullable                                  | yes                                                                            |
| `expires_at`            | date, nullable, `≥ issued_at`                   | yes                                                                            |
| `verification_status`   | `pending` · `verified` · `rejected` · `expired` | **no**                                                                         |
| `reviewed_by`           | → `profiles`, nullable (platform admin)         | **no**                                                                         |
| `reviewed_at`           | timestamptz, nullable                           | **no**                                                                         |
| `review_note`           | text ≤ 500, nullable; required for rejections   | **no** (owner reads it via `own_qualification_reviews()`; not column-readable) |

Trigger `reset_verification_on_change`: if the owner changes type/dates of a non-pending
qualification, verification returns to `pending` (prevents "verify then extend expiry" tampering) and,
since `20261015130400`, the review columns are cleared.
Trigger `enforce_qualification_expiry` (since `20261015120000`): an `active` row whose type has
`requires_expiry` must carry `expires_at` (BR-2.7, SQLSTATE 23514).

### `availability_windows`

`id`, `technician_profile_id`, `starts_at`, `ends_at` (`> starts_at`, `≤ starts_at + 366 days` since
`20261015120000`), `status`
(`available` · `unavailable`), timestamps.

Writes are serialised per technician: trigger `availability_windows_lock_owner` (BEFORE INSERT/UPDATE/
DELETE, `lock_availability_owner()`) takes `pg_advisory_xact_lock` keyed by the owner, as does
`replace_availability_days` before reading (`20261019130000`, local only).

`status` is `available` / `unavailable` / `aog_only` (`aog_only` added by `20261019150000`, local only; meaning in BR-4.8).

Confirmed assignments are protected (BR-4.9, `20261023300000`, local only): trigger
`availability_windows_protect_assignments` (AFTER INSERT/UPDATE/DELETE, DEFINER `protect_assignment_availability()`)
raises `CFV01` when a row change reduces the availability of one of the owner's `confirmed` applications and that
assignment is then not covered 100 % (`app_private.hard_eligibility`); `replace_availability_days` refuses every listed
day that overlaps one (`app_private.confirmed_assignment_overlaps`) and splits a window tail-first so an adjacent
assignment never looks uncovered mid-save. Skipped while the profile is being deleted (cascade).

No single window starts on a past UTC day (BR-4.6, N-26, `20261024200100`, local only): trigger
`availability_windows_refuse_past_start` (BEFORE INSERT/UPDATE OF `starts_at`, INVOKER
`refuse_past_availability_start()`) raises `22023` (hint `past_start`) when a Data API write (`current_user =
authenticated`) creates a window, or moves its start (to the minute), before today 00:00 UTC. Seeds and operators are
not API writes; existing past windows stay.

### `availability_rotations` (`20261019140000`, local only)

The cycle generator's saved pattern, one row per technician: `pattern` (14 values, BR-4.7), `anchor`
date (day 1, UTC), `custom_cycle text[]` (≤ 31 × `working`/`off`; 1–31 when `pattern = custom`).
**Private:** RLS select/insert/update/delete own only — no organization, manager or platform-admin
policy (work/rest days are private in the prototype). Written by the app through `replace_availability_days` (third argument `p_rotation`); the owner's own grants also allow direct writes, harmless under owner-only RLS and the CHECKs. Read by `GET /professional-availability`. Note: the pattern itself is private, but the working days it generates are stored as `unavailable` windows, which organizations can see like any other window — the rota can be inferred from them (review LOW-2).

### `work_requirements`

`id`, `organization_id`, `title`, `location`, `starts_at`, `ends_at`, `shift`, `headcount` (1–50),
`urgency`, `status`, `created_by` → `profiles` (on delete **set null**, nullable since `20261023400100`: the requirement
outlives its author's account; inserts still need `created_by = auth.uid()`), timestamps. Created through RPC
`create_work_requirement(...)` (SECURITY INVOKER: RLS applies) which inserts the requirement and its
qualifications in one transaction (the API uses the idempotent wrapper `create_work_requirement_idempotent`).
Deferred constraint triggers `work_requirements_qualification_invariant` /
`work_requirement_qualifications_invariant` (`20261015130000`): at commit, every `open`/`covered` requirement
has ≥ 1 `hard` and ≤ 20 qualifications (SQLSTATE 23514), whatever the write path; drafts may be
incomplete and cancelling/closing is always possible.

**Edit (M05, LOCAL `20261022130300`):** `update_work_requirement(...)` (DEFINER, admin/manager in the body) with
the creation validations, an optimistic version (`updated_at`, ms, `CF412`) and an audit row `requirement.updated`
`{fields: [...]}` (names only). Once a requirement **ever received an application** (withdrawn included) its
business columns and qualifications are frozen for every write path (trigger `guard_requirement_with_applications`,
SQLSTATE `CFA12`); status changes stay possible. On qualification writes this guard and the closed-requirement guard
answer only to an admin/manager of the requirement's organization (or the owner): a stranger always gets RLS's
42501, so published ids (D-12) give no oracle on applications or closure (security review 2026-10-22). `covered` ↔ `open` follow the confirmed seats and happen only
inside `transition_application` (transaction-local flag read by `guard_requirement_status`); closing is refused
while an application is `accepted` or `confirmed` (`CFA11`, T-12).

**Requirement builder (v2 diff area 30, LOCAL `20261023600000/600100`, BR-1.10…BR-1.15, defaults T-60…T-66).**
Six nullable columns (NULL = not stated, which every older row is):

| Column        | Type / check                                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `country`     | text, one of the 27 EU ISO codes (`work_requirements_country_eu` = `EU_COUNTRIES`)                                                                                                                                                                                                                                                 |
| `timezone`    | text, one of the EU IANA zones or `UTC` (`work_requirements_timezone_known` = `REQUIREMENT_TIME_ZONES`); only tells local dates apart                                                                                                                                                                                              |
| `description` | text 1–4000                                                                                                                                                                                                                                                                                                                        |
| `shifts`      | jsonb `[{startsAt, endsAt, baseHours}]`, canonical ISO UTC (ms), sorted; trigger `work_requirements_shifts_valid` (`app_private.requirement_shifts_valid`, only when shifts, zone or period are written): 1–366, ≤ 24 h each, 0.25–24 base hours ≤ the duration, no overlap, one per local start date, the period = their envelope |
| `conditions`  | jsonb of known keys only (rates, per diem, hours per shift, contract, budget flag, mobilisation, incorporation, logistics); CHECK `app_private.requirement_conditions_valid`; informative, no money flow (OD-7)                                                                                                                    |
| `archived_at` | timestamptz, only on a `closed` row (`work_requirements_archived_closed`), one way; written by `archive_work_requirement` only                                                                                                                                                                                                     |

API roles get INSERT on the first five (the create RPC is SECURITY INVOKER) and no UPDATE on any of them: edits go
through `update_work_requirement`. Both freeze guards (`guard_closed_requirement`, `guard_requirement_with_applications`)
cover them too, and `archived_at` can never be cleared. Shifts are a validated list on the row, not a table: no shift ids
until partial coverage (v2-30) needs them (T-60). Drafts (`draft`, created by the new create overload) may lack
qualifications; BR-1.4 still applies when they are published. The opportunity projection (`list_opportunities`,
`app_private.requirement_cards`) and therefore every proposal's `terms` carry `country`, `timeZone`, `description`,
`shifts`, `conditions` — still no ids of people or organizations, never `archived_at`.

**Requirement on behalf of a client (PKG recruiter, LOCAL `20261024500100`, BR-27, T-132…T-134).** One more nullable
column, `on_behalf_of_client_id` → `represented_clients` (NULL = no client, every non-agency requirement). No INSERT or
UPDATE grant: the create overload with `p_on_behalf_of_client_id` (INVOKER) hands it to its insert through the
transaction-local setting `crewflex.requirement_client` (the `crewflex.system_status` pattern; API clients cannot call
`set_config`), the edit overload (DEFINER) writes it. BEFORE trigger `work_requirements_with_client`
(`guard_requirement_client`, every path): for a caller who is not admin/manager of the organization the rules stay silent and RLS answers 42501 (no oracle); the client is an `active` representation of the requirement's organization (22023 / `CFR02`); a staffing
agency's insert as non-draft, draft → open, paused → open or client change leaves a client (`CFR01`); the client changes
only on a draft (55000 once published or closed; `CFA12` once applied to). BEFORE trigger `organizations_type_clients`
(`guard_organization_type_clients`): no type change to or from `staffing_agency` while published requirements or live
clients would end outside these rules (55000, BR-27.7). Changes audited
`requirement.client_changed {client_id, previous_client_id}` (agency as organization). BEFORE trigger
`applications_client_active` (`guard_application_client`) refuses an application and every forward step (shortlisted,
proposed, accepted, confirmed) while the representation is not active (`CFA01` for the new application — the applicant
learns only «not open» —, `CFR02` for the agency's steps). `list_opportunities` returns
`client_name` (active representations only; the others are not listed); `app_private.requirement_cards` is unchanged.

### `represented_clients` (`20261024500000`, LOCAL ONLY — recruiter, D-12 provisional, BR-27)

`id`, `agency_id` → `organizations` (cascade), `name` (2–120, trimmed), `contact_email` (nullable, lower-case),
`status` `representation_status` (`pending` · `active` · `revoked`, with the matching `activated_at` / `revoked_at`
CHECK), `created_by` → `profiles` (set null), `created_at`, `updated_at`. One live (pending/active) client per name
per agency (unique index on `lower(name)` where not revoked); ≤ 50 pending and ≤ 200 live per agency (in the add RPC).
RLS select: members of the agency, platform admins, **column-limited** (no grant on `contact_email`: the agency's
admins/managers and platform admins read it through `list_represented_clients(org)`, a plain member gets null;
`list_representation_reviews()` is the platform admin's queue with the agency's name); no write grant — `add_represented_client` (admin/manager of a staffing
agency), `revoke_represented_client` (admin/manager, final), `activate_represented_client` (platform admin with
evidence, never their own agency) are the only writers.

### `represented_client_reviews` (`20261024500000`, LOCAL ONLY)

`id`, `client_id` → `represented_clients` (cascade), `reviewed_by` → `profiles` (set null), `note` (1–2000, the
evidence), `created_at`. Platform admins only (as `organization_reviews`); written by `activate_represented_client`.

**v1.8 profile requirements (package matching-v18, LOCAL `20261023900000`, BUSINESS_RULES BR-3.7–3.13, T-80…T-87).**
Six more columns, «not required» when NULL / empty (every older row; the job's `country` above is the seventh rule):

| Column                 | Type / check                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `category`             | text, one of the 12 v1.8 categories (`PROFESSIONAL_CATEGORIES`), nullable                         |
| `aircraft`             | text[] ⊆ the 12 v1.8 aircraft, default `{}` — «Aeronaves aceptadas», any of                       |
| `requires_type_rating` | boolean, default false; true only with a licence `category` (8 of the 12) and ≥ 1 aircraft (T-83) |
| `engines`              | text[] ⊆ the 7 v1.8 engines, default `{}` — any of                                                |
| `min_years`            | integer 0–60, nullable                                                                            |
| `required_skills`      | text[] ⊆ the 9 v1.8 capabilities, default `{}` — all of                                           |

No INSERT or UPDATE grant: today only the seed and the owner write them (the builder form and its RPCs adopt them in a
follow-up). Both freeze guards cover them (closed: 55000; after the first application: CFA12). Organizations read them
on their requirement rows (RLS) and on each row of the organization-wide `get_organization_applications` (hiring-polish;
since `20261024100900` it also returns the applicant's `candidate_declarations`); professionals through
`get_requirement_profile_rules`.

### `work_requirement_qualifications`

`id`, `work_requirement_id`, `qualification_type_id` (unique per requirement), `requirement_level`
(`hard` · `soft`).

### `applications` (`20261022130300`, LOCAL ONLY — D-06, `APPLICATIONS_STATE_MACHINE.md`)

| Column                      | Type                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `id`                        | uuid PK                                                                                      |
| `requirement_id`            | → `work_requirements` on delete cascade                                                      |
| `technician_profile_id`     | → `technician_profiles(profile_id)` on delete **set null** (nullable since `20261023400100`) |
| `status`                    | `application_status`: the 9 states of the contract, default `received`                       |
| `current_proposal_id`       | → own `application_proposals` (composite FK, deferred); required from `proposed` on          |
| `accepted_proposal_id`      | the version the technician accepted (R-08: stays on v(n) while v(n+1) is `proposed`)         |
| `reason`                    | text 1–1000, present **exactly** for `rejected` / `cancelled` (T-10: both parties read it)   |
| `created_at` / `updated_at` | timestamptz; `updated_at` (ms) is the optimistic version of every transition                 |

One period per application (Q6: the requirement's `[starts_at, ends_at)`). Unique partial index
`(requirement_id, technician_profile_id) WHERE status <> 'withdrawn'` (Q5, T-09: re-applying only after
`withdrawn`). An **assignment** is an application in `confirmed` — derived, never a separate table.
RLS: select own (technician) or platform admin; **no write grant to any API role** (RPCs only); organizations
read nothing directly. An application deleted with its requirement or organization frees its seat: a `covered`
requirement goes back to `open` (trigger `release_seat_on_application_delete`, system change). **Account deletion no
longer deletes applications** (T-42, LOCAL `20261023400100`, «Account closure and retention» below): the row stays
with `technician_profile_id = NULL`; it is refused while one is `accepted`/`confirmed` (CFA11), and
`received`/`shortlisted`/`proposed` ones are withdrawn first with an event and an audit row. Trigger
`applications_technician_removed` refuses a NULL technician on a row still in progress (any other path). The
organization's applicant list (`get_requirement_applications`) no longer shows those rows; seats (`finished`) still
count.

### `application_proposals` · `application_events` (`20261022130300`, LOCAL ONLY)

Proposals: `id`, `application_id` (cascade), `version` (1, 2, … unique per application), `terms` jsonb = the frozen
requirement card (`OpportunityRequirement` without id/createdAt; T-11, no free text), `created_at`. A trigger
refuses every UPDATE (owner included). Events: `id`, `application_id`, `seq` (order), `from_status` (null for the
application itself), `to_status`, `actor` (`technician` · `organization`, never a person id), `proposal_id`
(created or accepted by that step), `created_at`; append-only (UPDATE refused). Both are readable by whoever may
read the application (RLS through the parent) and written only by the RPCs.

### `application_packs` (`20261024300000`, LOCAL ONLY — Candidate Pack copy, v2-15 + v2-04, BR-25, T-110…T-116)

One row per application, written by the AFTER INSERT trigger `applications_freeze_pack` in the transaction that
creates the application (only when the JWT subject is the applicant, or there is no JWT: seed), from the private
builder `app_private.candidate_pack_content(profile)` — one STABLE statement, so a copy never mixes two passport
saves. Columns: `application_id` PK → `applications` on delete cascade, `created_at` (the copy date), the
technician-profile declarations of that moment (`primary_category`, `categories`, `years_experience`,
`english_level`, `base_location`, `base_country`, `aircraft`, `engines`, `skills`, `work_permits`,
`general_restrictions`), `min_rate` + `rate_unit` (both or neither, CHECK) from the private details — **never** their
phone or employer —, and three jsonb arrays with fixed keys: `type_ratings` (`aircraft`, `category`, `expiresAt`,
`restrictions`), `qualifications` (active ones: `code`, `name`, `category`, `verificationStatus`, `expiresAt`; no
review data) and `experience` (≤ 20, CHECK: `date`, `aircraft`, `ata`, `hours`, `category`, `environment`,
`description` of the non-archived `cv_relevant` logbook entries, newest first; no ids). No name, contact, employer,
blocks, documents or file metadata column exists. UPDATE refused (trigger, 55000). Deleted by trigger
`applications_drop_pack` when the application becomes `withdrawn`, `rejected` or `cancelled` (`PACK_DROPPED_STATUSES`)
or loses its technician (account closure: the
application stays without the profile, T-42; its copy does not, T-113), and with its application. RLS on; **no
grant** to any API role (owner-only select policy as a second layer); read through `get_application_pack`,
`get_my_application_packs` and, for the preview, `get_my_candidate_pack_preview` (table below). No backfill for older
applications.

### `notifications` (`20261023800000`, LOCAL ONLY — in-app notices «Avisos internos», v2-18, T-70…T-73)

| Column               | Type                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `id`                 | uuid PK                                                                                      |
| `recipient_id`       | → `profiles` on delete cascade                                                               |
| `kind`               | `notification_kind`: `application` (a status reached) · `requirement` · `outreach` (PKG)     |
| `application_id`     | → `applications` on delete cascade; for `requirement`, the recipient's active application    |
|                      | (null only for `outreach`, `20261024400200`)                                                 |
| `requirement_id`     | → `work_requirements` on delete cascade; `outreach` only, one per recipient                  |
| `application_status` | `application`: the status reached (`received` = a new application, told to the organization) |
| `requirement_status` | `requirement`: `paused`, `open` (resumed from paused) or `closed`                            |
| `created_at`         | timestamptz                                                                                  |
| `read_at`            | timestamptz, null = unread; set only by `mark_notifications_read`, never before creation     |

**Ids and enums only — no text, no other person's id** (an organization's row names the application, never the
applicant). Written only by DEFINER triggers in the transaction of the event: `application_events_notify` (AFTER
INSERT on `application_events`: the other party of the actor — the applicant when the organization acts, every
admin/manager of the requirement's organization except the applicant when the technician acts) and
`work_requirements_notify_status` (pause, resume, close → each active application's technician); the actor is never
notified. Rendered at read time by `get_my_notifications` (requirement title; technician side the organization name;
organization side the applicant under the pool rules of **today**). No grant to any API role (RLS owner-only policies
as a second layer). Retention and volume (T-71, T-73): 180 days and the newest 200 per recipient — never listed
beyond that, pruned when the recipient gets a notice or marks one read; while unread, a notice takes the next event
of its kind about the same technician and requirement (a status, a pause/resume/close, a re-application) instead of
a new row; deleted with the application, the requirement or the recipient; an organization recipient's notices of
that organization are deleted when they lose admin/manager
(`organization_members_drop_notifications`; the event trigger share-locks the memberships it notifies, so a
concurrent demotion waits and then deletes the new notice). No audit row of its own: the event that caused the
notice is audited. **`outreach` (PKG outreach, `20261024400200`, BR-26):** written by `requirement_outreach()` only,
one per recipient and requirement, read by its recipient as their own (technician side) while the need is `open` and
not ended, with the urgency of its distribution (`outreach_urgency` of `get_my_notifications`); application notices of
a technician who closed the account (technician → NULL) are neither listed nor counted.

### `outreach_distributions` (`20261024400200`, LOCAL ONLY — PKG outreach v2-17, T-125…T-128)

PK `requirement_id` → `work_requirements` on delete cascade (one distribution per need); `urgency` (`urgent` | `aog`,
the declared one at distribution time); `notified_count` ≥ 0 (who the rules reach, before the 3-per-24 h delivery bound), **null** when fewer than
5 professionals of the external pool were eligible and not applicants (T-128: the number is then neither shown nor stored); `created_at` (also counted for the limit of
10 distributions per organization per 24 h). **No recipient and no actor** (the audit
row `requirement.outreach_distributed` has the actor, the count and the urgency). RLS select: admin/manager of the
requirement's organization · platform admin; no write grant — `requirement_outreach()` is its only writer.

### `professional_documents` (`20261019160000`, LOCAL ONLY — D-10, `DOCUMENT_WALLET.md`)

| Column                      | Type                                                                           | Writable by owner        |
| --------------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| `id`                        | uuid PK                                                                        | –                        |
| `owner_id`                  | → `technician_profiles(profile_id)` on delete cascade                          | insert only (= JWT sub)  |
| `kind`                      | `document_kind`: `license` · `course` · `other`                                | yes                      |
| `title`                     | text 1–180 (sanitised by `sanitizeDocumentTitle`)                              | yes                      |
| `storage_path`              | text UNIQUE, CHECK `<owner_id>/<uuid>-<16 hex>` (no other separator, no `..`)  | insert only              |
| `mime_type`                 | `application/pdf` · `image/png` · `image/jpeg` (from magic bytes)              | insert only              |
| `size_bytes`                | int 1–5242880                                                                  | insert only              |
| `sha256`                    | text `^[0-9a-f]{64}$`                                                          | insert only              |
| `expires_at`                | date, nullable                                                                 | yes                      |
| `qualification_id`          | → `technician_qualifications` on delete set null; trigger: must be the owner's | yes                      |
| `scan_status`               | `document_scan_status`: `not_scanned` (default) · `clean` · `infected`         | **no** (no column grant) |
| `archived_at`               | timestamptz, nullable: in the trash since (N-19, `20261024200000`)             | update only (BR-24)      |
| `created_at` / `updated_at` | timestamptz (`set_updated_at`)                                                 | –                        |

`archived_at` (trash, BR-24): trigger `professional_documents_archive_clock` (BEFORE UPDATE OF `archived_at`) stamps
`now()` when a document enters the trash, keeps the first date while it stays there and clears it on restore, so no
client can backdate or post-date it; partial index on the archived rows. The app's other reads (review list, document
count, qualification evidence) skip archived rows (T-101).

RLS: own rows only (select/insert/update/delete); **no organization, manager or platform-admin policy**.
Inserts go through `create_professional_document` and require the owner-only flag
`app_private.feature_flags('document_wallet')` (`20261019160200`; reads, edits and deletes do not). The insert trigger also requires the Storage object to
exist with the declared size, so direct PostgREST inserts cannot create rows without bytes.

### `logbook_entries` (`20261023200000`, LOCAL ONLY — M14/N-12, BUSINESS_RULES BR-17)

The professional's personal, **self-declared** logbook (v1.8 «Logbook personal»; FD-25: never an official record).

| Column                      | Type                                                                                         | Writable by owner       |
| --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------- |
| `id`                        | uuid PK                                                                                      | –                       |
| `technician_profile_id`     | → `technician_profiles(profile_id)` on delete cascade                                        | insert only (= JWT sub) |
| `entry_date`                | date; never after today in Europe/Madrid (trigger `enforce_logbook_entry_date`, 23514, T-19) | yes                     |
| `aircraft`                  | text 1–100, not blank (free text; the 12 v1.8 models are UI suggestions)                     | yes                     |
| `ata`                       | text ≤ 10, nullable, not blank                                                               | yes                     |
| `hours`                     | numeric(3,1) 0–24                                                                            | yes                     |
| `category`                  | `logbook_category`: the 6 v1.8 categories, default `defect_rectification`                    | yes                     |
| `environment`               | `logbook_environment`: the 5 v1.8 environments, default `line_maintenance`                   | yes                     |
| `description`               | text 1–3000, not blank                                                                       | yes                     |
| `cv_relevant`               | boolean, default false («Seleccionable para expediente»; copied into a pack copy, BR-25)     | yes                     |
| `archived`                  | boolean, default false (v1.8 «Archivar» / «Restaurar»)                                       | update only             |
| `created_at` / `updated_at` | timestamptz (`set_updated_at`)                                                               | –                       |

RLS: own rows only (select/insert/update/delete); **no organization, manager or platform-admin policy** — unlike the
passport and availability (OD-4), the technician's own organization cannot read it. Only the professional's own act
shares entries: applying copies the selected ones into that application's `application_packs` row (BR-25). No status column: every entry is
self-declared (v1.8 `status: 'self-declared'`) and nothing can verify one. Creates go through
`create_logbook_entry` (idempotent); direct PostgREST writes are held to the same CHECKs and date trigger.
Account deletion cascades (auth user → profile → technician profile → entries; keys through the profile).

### `app_private.document_object_tombstones` · `app_private.document_retention_settings` (`20261019160200`, LOCAL ONLY)

Tombstones (`id`, `storage_path`, `owner_id` (no FK), `reason` `owner_delete` · `account_deleted` · `operator_delete` ·
`orphan_upload` · `trash_expired` (since `20261024200000`: an archived document past `archive_retention`, due at
once), `deleted_at`, `purge_after`, `legal_hold` default false, `purged_at`, `attempts`, `last_error` ≤ 200;
one open tombstone per path) are written by the AFTER DELETE trigger on `professional_documents` and by
reconciliation. Settings: one row (`account_deletion_grace` default 30 days, `orphan_upload_grace` default 24 h,
`archive_retention` default 30 days, 1–3650 days, T-100, since `20261024200000`).
Both: RLS on, no policy, no grant — DEFINER functions only. Retention rules: `DOCUMENT_WALLET.md` §6.

### `account_invitations` (`20261023400000`, LOCAL ONLY — OD-8 default T-40)

`id`, `email` (lower-case, trimmed), `account_type` (`professional` · `organization` — `platform_admin` is a platform
role and is never invited), `code_hash` (SHA-256 hex of the 64-hex random code; the code itself is stored nowhere),
`created_by` → `profiles` (set null), `created_at`, `expires_at` (= created + 7 days), `consumed_by` → `profiles`
(**cascade**: the invitation holds an e-mail address and leaves with the account it created), `consumed_at`,
`revoked_at`. One open invitation per address (unique partial index); a new one revokes the previous one. RLS: select
for platform admins only, column-limited (no `code_hash`); no write grant (DEFINER RPCs only). Gate: the owner-only
row `app_private.feature_flags('invitation_signup', true)`; without it open sign-up is unchanged. Retention: trigger `on_auth_user_deleted_forget_invitations` (BEFORE DELETE on `auth.users`, accounts with a profile only) deletes every invitation of the address with the account; unused ones (revoked or expired) are deleted 30 days later by the next `create_invitation`.

**Sign-up with the flag on** (`handle_new_user`, same trigger): a new Auth user needs `raw_user_meta_data.invitation_code`
= the code of an open, unexpired invitation for that same e-mail (`CFI01` otherwise); the account type comes from the
invitation, which is consumed in the same transaction, and the code is removed from the metadata. A **delivery
account** (metadata `invitation_delivery` = an open invitation's id for that very address) gets no profile: the
`invitations` function creates it through the public Auth API only so that Auth sends the invitation e-mail, and
`finish_invitation_delivery()` deletes it right after. The `invitation_delivery` marker is refused (`CFI01`) anywhere else, flag off included.

### Account closure and retention (`20261023400100`, LOCAL ONLY — M-3 default T-42)

`close_my_account()` deletes the caller's own document rows (tombstones `owner_delete`) and then their Auth user, in
one transaction, with the JWT claims cleared for the cascade (so owner-delete audit triggers do not write rows with an
actor that is being deleted — the same as a deletion by the Auth Admin API). Trigger `profiles_before_delete` applies
the rules to **every** deletion path: refused (`CFA11`) while the person has an `accepted`/`confirmed` application or
while a requirement of an organization whose **last admin** they are has one; `received`/`shortlisted`/`proposed`
applications become `withdrawn` (event actor `technician`, audit `application.withdrawn` without actor or
organization, `account_closed: true`); that organization's draft/open/paused requirements close (audited by
`guard_requirement_status`). The last-admin question is asked after locking those organizations' rows (`for no key update`), so two admins closing at once cannot both leave. `profiles_audit_closed` writes `account.closed`.

| Leaves with the account                                                                                                                                                                                                                                                                                            | Stays, without the profile                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth user, sessions, identities · profile · technician profile, passport declarations, type ratings, private details, blocks, logbook, qualifications, windows, rotation · notices · memberships · idempotency keys · own documents (rows; objects: see `DOCUMENT_WALLET.md` §6) · every invitation of the address | applications (`technician_profile_id` NULL; status, proposals, history) · requirements they created (`created_by` NULL) · the organization, its other members and history · audit rows (actor NULL; ids in metadata) |

### `audit_events`

`id`, `actor_profile_id`, `organization_id` nullable, `action`, `entity_type`, `entity_id`,
`metadata jsonb` (never secrets / documents), `created_at`. **Append-only**: no insert/update/delete
grant for API roles; rows are written by SECURITY DEFINER triggers.

Actions in use: `requirement.created`, `requirement.status_changed` (`{from,to}`; covered ↔ open set by an
application carry `system: true` and no actor, since `20261022130300`), `requirement.updated` (`{fields}`, M05 edit;
since `20261023600100` also `country`, `timeZone`, `description`, `shifts`, `conditions`), `requirement.archived`
(`{from}`, `20261023600100`),
`application.<status>` (`received` … `cancelled`, one per successful apply/transition, metadata `from`, `to`,
`actor` side, `requirement_id`, `proposal_version`, `reason_provided`, `request_id` — never the reason; rows whose
actor is the technician have **no organization id**, so an organization's audit trail never carries an applicant's
profile id, T-04), `qualification.verified`, `qualification.reviewed` (platform
review decision with previous/new status, `note_provided`, `request_id`; since `20261015130400`), `qualification.created`,
`qualification.updated` (type, status or dates changed), `qualification.removed` (owner delete only,
not account-deletion cascades) — the last three since `20261015120000`; `document.uploaded`,
`document.updated` (with the changed field names) and `document.deleted` (owner delete only) since
`20261019160000` (LOCAL ONLY; metadata: ids, kind, mime, size, sha256 — never title or path); `document.purged`
(tombstone id, owner id, reason, `object_found`) since `20261019160200`; `document.archived`, `document.restored`
(owner, `changed` includes `archived_at`) and `document.trash_expired` (the maintenance caller as actor; not on an
account-deletion cascade) since `20261024200000` (LOCAL, same metadata as `document.deleted`); `logbook.created`, `logbook.updated`
(`changed` field names) and `logbook.deleted` (owner delete only, not account-deletion cascades) since
`20261023200000` (LOCAL ONLY; metadata: the technician profile id and the changed field names — never a value, and
never the selection flag, not even as a changed name: an update that only toggles it is not audited, because platform
admins read every audit row; security review 2026-10-22). Like the document rows, logbook audit rows keep their
entity and technician profile ids after an account deletion (the actor becomes null). Reserved: `organization.member_added`; the hiring
(tombstone id, owner id, reason, `object_found`) since `20261019160200`. `organization.updated` (`{fields,
review_reset}`, with the organization id: the organization's admin reads it in «Actividad de esta organización») and
`organization.reviewed` (`{previous_review_status, review_status, note_provided, request_id}`, **no organization
id**, so the reviewer's id never reaches the organization's trail; never the note) since `20261023500100` (LOCAL); `organization.member_removed` (`{profile_id, role}`, with the organization id, every removal path; skipped when the organization itself is deleted) since `20261023500400` (LOCAL).
LOCAL `20261023400000/400100` (PKG account):
`invitation.created` (`{account_type, replaced, request_id}` — never the address or the code), `invitation.sent` /
`invitation.revoked` (`{delivery_account_removed, request_id, reason?}`), `account.closed` (entity = the closed
profile id, no actor, `{account_type, self_service, request_id}`), and `application.withdrawn` with
`account_closed: true` and no actor for the withdrawals a closure makes. Reserved: `organization.member_added`; the hiring
block's Candidate Pack (D-07, not implemented) will use `pack.contact_viewed` / `pack.document_url_issued`
(`APPLICATIONS_STATE_MACHINE.md` §4.2 — `document.shared` and `candidate_pack.shared` are superseded).

## Database functions

| Function                                                                                                                                                                                                                    | Security        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_org_member(org)` / `has_org_role(org, roles)` / `is_platform_admin()`                                                                                                                                                   | DEFINER, stable | RLS helpers (avoid recursive policies).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `create_work_requirement(...)`                                                                                                                                                                                              | INVOKER         | Atomic create, RLS enforced.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `get_requirement_candidate_pool(requirement_id)` (+ `candidate_declarations` since `20261023900100`)                                                                                                                        | DEFINER         | Returns **matchable data only** for internal + external pools after checking the caller is admin/manager of the requirement's organization. External selection: hard-eligible first (`20261015130300`).                                                                                                                                                                                                                                                                                                                                                                             |
| `get_requirement_external_pool_summary(requirement_id)`                                                                                                                                                                     | DEFINER         | Counts only (`prefiltered`, `hard_eligible`, `cap`), same authorization: tells the UI whether the external evaluation is complete.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `update_professional_profile(...)`                                                                                                                                                                                          | INVOKER         | Atomic passport save (two tables, one transaction) with optional optimistic concurrency (`CF412`). Superseded locally by `save_professional_passport`; kept for the deployed function.                                                                                                                                                                                                                                                                                                                                                                                              |
| `save_professional_passport(passport jsonb, expected_updated_at)` (`20261023100200`, local only)                                                                                                                            | DEFINER         | Whole v1.8 passport in one transaction (5 tables, full replacement), `CF412`; professionals only (42501); exact keys, no repeats, ≤ 40 ratings, ≤ 200 blocks, ratings on declared values (22023). Sole writer of the new columns and tables.                                                                                                                                                                                                                                                                                                                                        |
| `list_blockable_organizations()` (`20261023100200`, local only)                                                                                                                                                             | DEFINER, stable | Professionals only (42501): id + name of organizations that published (non-draft), own memberships, own blocks and employer (those first; ≤ 500), for «Empresa actual» and «Organizaciones bloqueadas».                                                                                                                                                                                                                                                                                                                                                                             |
| `get_requirement_candidate_passports(requirement_id)` (`20261023100300`, local only)                                                                                                                                        | DEFINER, stable | Pool authorization (admin/manager, 42501); exactly the rows of `get_requirement_candidate_pool` (calls it): ref, main category, categories, aircraft, English, permits, `has_restrictions`. Nothing private.                                                                                                                                                                                                                                                                                                                                                                        |
| `create_work_requirement_idempotent` · `create_availability_window` · `declare_qualification` · `replace_availability_days` (`20261019120000`, 3-arg since `20261019140000`, local only)                                    | INVOKER         | Idempotent creates (`Idempotency-Key`), key claimed in the same transaction (`app_private.idempotency_keys`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `create_professional_document(key, kind, title, storage_path, mime_type, size_bytes, sha256, expires_at, qualification_id)` (`20261019160000`, local only)                                                                  | INVOKER         | Idempotent document create (`document.create`); path must be `<uid>/<key>-<sha256[0:16]>` (`22023` otherwise); `CF409` same key, other request.                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `create_logbook_entry(key, entry_date, aircraft, ata, hours, category, environment, description, cv_relevant)` (`20261023200000`, local only)                                                                               | INVOKER         | Idempotent logbook create (`logbook_entry.create`), owner = JWT subject; `CF409` same key, other request. The operation CHECK is re-created from its current definition (values are added, never dropped).                                                                                                                                                                                                                                                                                                                                                                          |
| `is_feature_enabled(name)` (`20261019160200`, local only)                                                                                                                                                                   | DEFINER, stable | Whitelisted owner flags (`document_wallet`) for the Next.js server; signed-in users only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `document_maintenance_batch(apply, limit)` · `document_purge_recheck(tombstone)` · `document_purge_record(tombstone, outcome, error)` (`20261019160200`, local only)                                                        | DEFINER         | Platform admin only (re-checked in the body): expired trash (N-19) + orphan reconciliation + due tombstones (≤ 100), per-object re-check under row lock, outcome + audit `document.purged`. Never delete objects themselves.                                                                                                                                                                                                                                                                                                                                                        |
| `document_trash_retention_days()` (`20261024200000`, local only)                                                                                                                                                            | DEFINER, stable | Signed-in users only: the trash retention in whole days (`archive_retention`, rounded up) for «restorable for {n} days».                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `stamp_professional_document_archive()` · `app_private.document_trash_expired(archived_at)` (`20261024200000`, local only)                                                                                                  | INVOKER trigger | The trash clock on `professional_documents.archived_at` · private helper «archived and past `archive_retention`» for the tombstone and audit triggers.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `refuse_past_availability_start()` (`20261024200100`, local only)                                                                                                                                                           | INVOKER trigger | BR-4.6 / N-26: a Data API write cannot create a window, or move its start, before today (UTC): `22023`, hint `past_start`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `review_qualification(id, decision, expected_updated_at, note, request_id)`                                                                                                                                                 | DEFINER         | Requires `app_private.feature_flags('qualification_review')`; platform admin only, never own, `pending` → `verified`/`rejected` for the version the reviewer saw, row lock, audit `qualification.reviewed`.                                                                                                                                                                                                                                                                                                                                                                         |
| `own_qualification_reviews()`                                                                                                                                                                                               | DEFINER, stable | The caller's own review reasons (the column is not readable otherwise).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `enforce_requirement_qualifications()`                                                                                                                                                                                      | DEFINER trigger | BR-1.4 at commit (deferred).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `handle_new_user()`                                                                                                                                                                                                         | DEFINER trigger | Creates profile (+ technician profile or organization + admin membership). With the `invitation_signup` flag (LOCAL `20261023400000`): valid code required (`CFI01`), type from the invitation, consumed; delivery accounts get no profile.                                                                                                                                                                                                                                                                                                                                         |
| `list_opportunities(id, urgency, q, limit)` (`20261022130200`, columns `20261023600000`, `20261024100000`, `20261024500100`, block `20261024800000`, local only)                                                            | DEFINER, stable | D-12: published, current requirements (`open`, `ends_at > now()`) for professional accounts and (v2-20 «Ofertas en la red») organization members; anyone else 42501. Fixed projection (organization name, no ids of people/organizations, no counts), ≤ 200 rows, `total`; never the caller's own organizations' requirements (T-90) nor those of an organization the caller blocked (v2-16, T-160); `q` also matches a required qualification's code or name (T-91).                                                                                                               |
| `own_candidate_profile(from, to)` (`20261022130200`; + `candidate_declarations` since `20261023900100`, local only)                                                                                                         | INVOKER, stable | The caller's own matchable data in the candidate-pool column shape (`toCandidate`), for their own eligibility.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `update_work_requirement(id, expected_updated_at, …, qualifications)` (`20261022130300`, local only)                                                                                                                        | DEFINER         | M05 edit (see `work_requirements`): admin/manager, creation validations, `CF412`, `CFA12` after any application, `55000` closed, no-op when unchanged, audit `requirement.updated`.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `create_work_requirement(…, status, country, time_zone, description, shifts, conditions)` + `…_idempotent` (`20261023600100`, local only)                                                                                   | INVOKER         | New overloads (the old ones stay): `draft` (0–20 qualifications) or `open` (1–20 with a hard one); terms normalised (`normalize_requirement_shifts/conditions`); the key's hash covers them.                                                                                                                                                                                                                                                                                                                                                                                        |
| `update_work_requirement(…, status, country, time_zone, description, shifts, conditions)` (`20261023600100`, local only)                                                                                                    | DEFINER         | New overload: as the M05 edit plus the terms; `status` NULL keeps it, `draft` saves a draft (only a draft), `open` publishes a draft; changed names include the terms.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `archive_work_requirement(id)` (`20261023600100`, local only)                                                                                                                                                               | DEFINER         | v1.8 «Archivar» (T-64): admin/manager; closed → archived, draft → closed + archived, else `55000`; twice = no-op; 42501 for anyone else; audit `requirement.archived`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `count_viable_candidates(org, starts_at, ends_at, urgency, hard_type_ids, country)` (`20261023600100`; `country` since `20261023900100` — the only profile rule the count takes, security review MEDIUM-1, local only)      | DEFINER, stable | Builder live count (T-66): admin/manager of `org`; members + `anonymous`/`open` professionals passing `app_private.hard_eligibility_for`; a number only.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `get_requirement_profile_rules(requirement_ids)` (`20261023900100`, block `20261024800000`, local only)                                                                                                                     | DEFINER, stable | Professionals only (42501), ≤ 200 ids (22023): the v1.8 profile rules (no country: it comes with the card) of the requirements the caller may read — published and current (D-12) of an organization the caller did not block (v2-16), or applied to; others silently absent.                                                                                                                                                                                                                                                                                                       |
| `guard_application_profile_rules()` (`20261023900200`, local only)                                                                                                                                                          | DEFINER trigger | BEFORE INSERT / UPDATE OF status on `applications`: at apply and at confirmation `hard_eligibility().profile_ok` (`PROFILE_REQUIREMENTS_UNMET`); at confirmation declared general restrictions (`RESTRICTIONS_DECLARED`, T-87).                                                                                                                                                                                                                                                                                                                                                     |
| `apply_to_requirement(requirement_id, key, share_consent, request_id)` (`20261022130300`, `20261024100000`, `20261024800000`, local only)                                                                                   | DEFINER         | ∅ → `received`: technician only, idempotent (`application.create`), open (`CFA01`), not started (`CFA02`), organization not blocked by the applicant (`CFA16`, v2-16/T-160), Q5/T-09 (`CFA09`/`CFA10`), eligible now (T-08: `CFA03`/`CFA04`), last: not a member of the requirement's organization (`CFA13`, T-90); the share consent must be `true` (22023), recorded as a flag; event + audit.                                                                                                                                                                                    |
| `app_private.technician_blocks_organization(profile, organization)` (`20261024800000`, local only)                                                                                                                          | INVOKER, stable | Private predicate «this professional blocked this organization» (one row of `technician_organization_blocks`), read by the three functions above for the caller only (the profile parameter is for the pool bodies, which iterate over candidates; a public function passes `auth.uid()` only); no execute for `public`, `anon` or `authenticated`. `ranked_external_pool`, `count_viable_candidates` and `count_visible_network` keep their inline copy, each pinned by its own test, until the package that next touches them (the directory re-creates `count_visible_network`). |
| `transition_application(id, to, expected_updated_at, key, reason, proposal_id, request_id)` (`20261022130300`, local only)                                                                                                  | DEFINER         | Every other transition (`app_private.application_transitions`): locks, side from the DB, idempotent (`application.transition`), version `CF412`, proposals, confirm re-checks, covered ↔ open; event + audit.                                                                                                                                                                                                                                                                                                                                                                       |
| `get_requirement_applications(requirement_id)` · `get_my_applications()` · `get_application_counts(org)` (`20261022130300`, local only)                                                                                     | DEFINER, stable | Org view (admin/manager, pool rules, 42501 otherwise) · own applications with the requirement card · counts per status (admin/manager).                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `get_organization_applications(org, requirement, status, limit, offset)` · `get_requirement_application_counts(org)` (`20261024100100`; + `candidate_declarations` and the rule columns since `20261024100900`, local only) | DEFINER, stable | v2-05/v2-08, admin/manager of `org` (42501 otherwise): one page (≤ 50, newest first, `total`) of the applications to its requirements — applicant columns from `get_requirement_applications` (called: pool rules), plus the requirement card; a closed account's row has no applicant columns · counts per status of each requirement with applications, with headcount, period and shift count (BR-23).                                                                                                                                                                           |
| `protect_assignment_availability()` · `app_private.confirmed_assignment_overlaps(from, to)` (`20261023300000`, local only)                                                                                                  | DEFINER         | BR-4.9: AFTER trigger on `availability_windows` (a write that leaves a confirmed assignment it reduces below 100 % → `CFV01`) · does a period overlap the caller's own confirmed assignment (`auth.uid()`).                                                                                                                                                                                                                                                                                                                                                                         |
| `update_organization_profile(id, expected_updated_at, name, type, country, tax_id, tax_address)` (`20261023500100`, local only)                                                                                             | INVOKER         | «Organización» save: RLS decides (admin only; anyone else 42501), input checks (22023), version `CF412`, no write when nothing changed. Returns the new version.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `review_organization(id, expected_updated_at, note, request_id)` (`20261023500100`, local only)                                                                                                                             | DEFINER         | Platform admin, never a current or former own organization (42501, `500400`), evidence 1–2000 (22023), row lock, pending + seen version + fiscal data complete (55000), P0002; sets `reviewed`, keeps the evidence, audit.                                                                                                                                                                                                                                                                                                                                                          |
| `get_platform_summary()` (`20261023500300`, local only)                                                                                                                                                                     | DEFINER, stable | Platform admin only (42501): professional accounts, organizations, active needs, working now, AOG with vacancies, seats to fill per hard licence (`demand`). Counts only, no money (T-53).                                                                                                                                                                                                                                                                                                                                                                                          |
| `count_visible_network(org)` (`20261024600000`, local only)                                                                                                                                                                 | DEFINER, stable | «Red visible» (T-146, BR-8): admin/manager of `org` (42501 otherwise); professionals the organization can find externally (`anonymous`/`open`, `verified_orgs` once reviewed; not members, not blocked). A number only.                                                                                                                                                                                                                                                                                                                                                             |
| `get_my_notifications(id, offset, limit)` · `count_my_unread_notifications()` (`20261023800000`, local only)                                                                                                                | DEFINER, stable | The caller's notices (≤ 50 per page, newest first, `total`) and unread count, through `app_private.visible_notifications()`: retention and access re-checked at read time; 42501 without a session.                                                                                                                                                                                                                                                                                                                                                                                 |
| `get_application_pack(application_id)` · `get_my_application_packs()` · `get_my_candidate_pack_preview()` (`20261024300000`, local only)                                                                                    | DEFINER, stable | Candidate Pack copy (BR-25), fixed columns: one application's copy for the applicant or an admin/manager of its requirement's organization now (anyone else `P0002`, like a missing id; zero rows = no copy) · own copies (export) · own copy as it would be frozen now (professionals). 42501 without a session.                                                                                                                                                                                                                                                                   |
| `save_notice_preferences(urgent, aog, mobilization_hours, time_zone, quiet_start, quiet_end)` (`20261024400100`, local only)                                                                                                | INVOKER         | PKG outreach N-10: the caller's own notice preferences (`auth.uid()`, upsert under RLS; zone trigger and CHECKs apply); 42501 without a session, FK error without a technician profile.                                                                                                                                                                                                                                                                                                                                                                                             |
| `requirement_outreach(requirement_id, request_id)` (`20261024400200`, local only)                                                                                                                                           | DEFINER         | PKG outreach v2-17: admin/manager of the need's organization (42501, also for a missing id), once per need, `urgent`/`aog`, `open`, not started, ≤ 10 a day (CFO01…CFO05); writes the BR-26 audience's notices, the distribution and the audit row (count only). `get_my_notifications` gains `outreach_urgency` (drop + create).                                                                                                                                                                                                                                                   |
| `mark_notifications_read(id)` (`20261023800000`, local only)                                                                                                                                                                | DEFINER         | One notice (`id`) or every unread one (null) of the caller read at the database's clock, then prunes the caller's expired ones; returns the rows matched.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `create_invitation(email, account_type, request_id)` · `finish_invitation_delivery(id, sent, request_id)` (`20261023400000`, local only)                                                                                    | DEFINER         | Platform admin only (re-checked in the body), flag required (`0A000`): create returns the code once to the caller (the `invitations` function), audit `invitation.created`; `23505` when the address already has an account. Finish deletes the address's delivery account(s) (no profile, `invitation_delivery` marker) and audits sent / revoked.                                                                                                                                                                                                                                 |
| `invitation_status(code, email)` · `invitation_signup_required()` (`20261023400000`, local only)                                                                                                                            | DEFINER, stable | **Anon-callable on purpose** (the sign-up page is public): a status (`valid` · `other_email` · `invalid` · `off`) and the account type, or one boolean. Never an address or an id; codes carry 244 random bits.                                                                                                                                                                                                                                                                                                                                                                     |
| `close_my_account(request_id)` (`20261023400100`, local only)                                                                                                                                                               | DEFINER         | The caller only (no argument names the account): own document rows, then the Auth user (rules above); returns the deleted documents' storage paths.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `before_account_deleted()` · `audit_account_closed()` · `guard_application_technician_removed()` (`20261023400100`, local only)                                                                                             | DEFINER trigger | Closure rules for every deletion path · `account.closed` · no application in progress loses its technician.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `add_represented_client(org, name, email, req)` · `revoke_represented_client(id, req)` · `activate_represented_client(id, note, req)` (`20261024500000`, local)                                                             | DEFINER         | Recruiter portfolio: add (admin/manager of a staffing agency, pending), revoke (final), activate (platform admin with evidence, never own agency); audited `client.added` / `client.revoked` / `client.activated`                                                                                                                                                                                                                                                                                                                                                                   |
| `create_work_requirement(…, on_behalf_of_client_id)` + `…_idempotent` · `update_work_requirement(…, on_behalf_of_client_id)` (`20261024500100`, local)                                                                      | INVOKER/DEFINER | The builder overloads with the represented client; they call the `20261023600100` overloads (rules unchanged)                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `list_represented_clients(org)` · `list_representation_reviews()` (`20261024500000`, local)                                                                                                                                 | DEFINER, stable | The portfolio (members; e-mail for admins/managers and platform admins) and the platform admin's review queue, ≤ 200                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `guard_requirement_client()` · `audit_requirement_client()` · `guard_application_client()` · `guard_organization_type_clients()` (`20261024500100`, local)                                                                  | DEFINER         | Triggers: the client rules (BR-27.3–27.5, BR-27.7) on every path, `requirement.client_changed` audit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `set_updated_at()`                                                                                                                                                                                                          | trigger         | Reusable `updated_at` maintenance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

### `app_private` schema (not exposed by PostgREST)

`feature_flags(name, enabled)` — owner-only switches, no grant (`qualification_review` gates the review RPC;
`invitation_signup` turns sign-up into sign-up by invitation, read by `invitation_signup_on()`, LOCAL
`20261023400000`; `invitation_code_hash(code)` is the one SHA-256 of a code).
`application_transitions(from_status, to_status, actor, reason_required)` — the 16 rows of
`APPLICATION_TRANSITIONS`, no grant (`20261022130300`). View `requirement_cards` — the one projection of a requirement
professionals may see (also the proposal terms), no grant (`20261022130200`). `hard_eligibility(requirement, profile)`
— BR-2/BR-3/BR-4.8 for one professional, the same expressions as `ranked_external_pool` (rls suite W proves the
three agree), used at apply and confirm; since `20261023900100` (LOCAL) it returns `profile_ok` too (BR-3.7–3.13, one
expression `profile_rules_ok(profile, country, category, aircraft, requires_type_rating, engines, min_years,
required_skills, last_day)`, also in `ranked_external_pool.hard_eligible`; suite matching-v18 proves SQL = TS), and
`candidate_declarations(profile, requirement)` builds the `candidate_declarations` jsonb of the candidate rows
(`get_requirement_candidate_pool`, `get_requirement_applications`, `own_candidate_profile`): for a requirement only the
engines and capabilities it asks for, the ratings of its category on its aircraft (`restricted` flag, never the text)
and the mobility beyond the passport card's fields; for the own profile everything. EXECUTE for `authenticated` on it
only (INVOKER, called by the INVOKER `own_candidate_profile`). Notices (`20261023800000`): `notification_retention()` (180 days),
`candidate_pseudonym(requirement, profile)` (the pool's `CF-…` expression; the notices suite proves they agree),
`prune_notifications(recipients)`, `visible_notifications()` (since `20261024400200` also the `outreach` kind, and
without application notices whose technician closed the account) — no grants. `candidate_pack_content(profile)`
(`20261024300000`) — the one builder of a Candidate Pack copy, used by the freezing trigger and the preview, no
grant. Since `20261023600100` it delegates to
`hard_eligibility_for(starts_at, ends_at, urgency, hard_type_ids, profile, …profile rules)` — the same expressions on
explicit parameters (the profile rules as trailing parameters with «not required» defaults since `20261023900100`),
also used by the builder's live count (country only) — and the requirement builder's validators
`requirement_shifts_valid`, `requirement_conditions_valid`, `normalize_requirement_shifts/conditions` live here
(EXECUTE for `authenticated`: CHECK constraints run with the writer's privileges; pure functions).
`idempotency_keys(actor_id → profiles, operation, key uuid, request_hash, resource_id, created_at)`, PK
(actor, operation, key), RLS own rows; `ranked_external_pool(requirement_id)` (ordering helper, no grant
to API roles; since `20261023500200` (LOCAL) it admits `verified_orgs` professionals only when the requirement's
organization is `reviewed`, BR-8); `claim_idempotency_key` / `complete_idempotency_key`.

## Types

- **Database types:** `src/types/database.ts`. Generated with `pnpm db:types` once the project is
  linked. Until then it is a hand-written subset (PARTIAL — see `OPEN_DECISIONS.md`).
- **Domain types:** `src/domain/*`. A row is not a domain object; edge functions map rows →
  domain explicitly.

## Storage

**Bucket `professional-documents` (`20261019160000`, LOCAL ONLY).** Private (`public = false`),
`file_size_limit = 5242880`, `allowed_mime_types` pdf/png/jpeg. `storage.objects` policies for
`authenticated`: select / insert / delete only in the caller's folder (`(storage.foldername(name))[1] =
auth.uid()`); insert only for the server-derived name shape and only by accounts with a technician profile
(`20261019160100`); delete refused while a document row points at
the object; no update policy (immutable objects). The DB stores the path only; access is a signed URL valid
60 s issued per request with the owner's JWT. Never a public bucket for CVs, licences, certificates or IDs.
Never persist signed URLs. The earlier plan of a generic `evidence` bucket is superseded by this one
(D-10, `DOCUMENT_WALLET.md`).
