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
                  │                        └──────────1─* technician_organization_blocks *─1 organizations (owner only)
                  │
                  └─* organization_members *─1 organizations 1─* work_requirements 1─* work_requirement_qualifications *─1 qualification_types
                                                       └─* organization_reviews (evidence, platform admins only)
                                                                                 │
technician_profiles 1─* applications *──────────────────────────────────────────┘  (one per technician × requirement, except withdrawn)
                          ├─* application_proposals (immutable versions, R-08)
                          └─* application_events (timeline)

audit_events (append-only, written by triggers)
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
only** (not the own organization, not platform admins); no write grant. D-07: no function returns it to anyone else.

### `technician_organization_blocks` (`20261023100100`, LOCAL ONLY) — owner only

PK (`technician_profile_id` → `technician_profiles`, `organization_id` → `organizations`), both on delete cascade,
`created_at`; ≤ 200 per professional. RLS select: **owner only**; no write grant. Read server-side by
`app_private.ranked_external_pool` to leave the professional out of that organization's external pool (T-35).

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

### `availability_rotations` (`20261019140000`, local only)

The cycle generator's saved pattern, one row per technician: `pattern` (14 values, BR-4.7), `anchor`
date (day 1, UTC), `custom_cycle text[]` (≤ 31 × `working`/`off`; 1–31 when `pattern = custom`).
**Private:** RLS select/insert/update/delete own only — no organization, manager or platform-admin
policy (work/rest days are private in the prototype). Written by the app through `replace_availability_days` (third argument `p_rotation`); the owner's own grants also allow direct writes, harmless under owner-only RLS and the CHECKs. Read by `GET /professional-availability`. Note: the pattern itself is private, but the working days it generates are stored as `unavailable` windows, which organizations can see like any other window — the rota can be inferred from them (review LOW-2).

### `work_requirements`

`id`, `organization_id`, `title`, `location`, `starts_at`, `ends_at`, `shift`, `headcount` (1–50),
`urgency`, `status`, `created_by` → `profiles`, timestamps. Created through RPC
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

### `work_requirement_qualifications`

`id`, `work_requirement_id`, `qualification_type_id` (unique per requirement), `requirement_level`
(`hard` · `soft`).

### `applications` (`20261022130300`, LOCAL ONLY — D-06, `APPLICATIONS_STATE_MACHINE.md`)

| Column                      | Type                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `id`                        | uuid PK                                                                                    |
| `requirement_id`            | → `work_requirements` on delete cascade                                                    |
| `technician_profile_id`     | → `technician_profiles(profile_id)` on delete cascade                                      |
| `status`                    | `application_status`: the 9 states of the contract, default `received`                     |
| `current_proposal_id`       | → own `application_proposals` (composite FK, deferred); required from `proposed` on        |
| `accepted_proposal_id`      | the version the technician accepted (R-08: stays on v(n) while v(n+1) is `proposed`)       |
| `reason`                    | text 1–1000, present **exactly** for `rejected` / `cancelled` (T-10: both parties read it) |
| `created_at` / `updated_at` | timestamptz; `updated_at` (ms) is the optimistic version of every transition               |

One period per application (Q6: the requirement's `[starts_at, ends_at)`). Unique partial index
`(requirement_id, technician_profile_id) WHERE status <> 'withdrawn'` (Q5, T-09: re-applying only after
`withdrawn`). An **assignment** is an application in `confirmed` — derived, never a separate table.
RLS: select own (technician) or platform admin; **no write grant to any API role** (RPCs only); organizations
read nothing directly. Deleting a confirmed or finished application (account deletion cascade) frees its seat: a
`covered` requirement goes back to `open` (trigger `release_seat_on_application_delete`, system change).

### `application_proposals` · `application_events` (`20261022130300`, LOCAL ONLY)

Proposals: `id`, `application_id` (cascade), `version` (1, 2, … unique per application), `terms` jsonb = the frozen
requirement card (`OpportunityRequirement` without id/createdAt; T-11, no free text), `created_at`. A trigger
refuses every UPDATE (owner included). Events: `id`, `application_id`, `seq` (order), `from_status` (null for the
application itself), `to_status`, `actor` (`technician` · `organization`, never a person id), `proposal_id`
(created or accepted by that step), `created_at`; append-only (UPDATE refused). Both are readable by whoever may
read the application (RLS through the parent) and written only by the RPCs.

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
| `created_at` / `updated_at` | timestamptz (`set_updated_at`)                                                 | –                        |

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
| `cv_relevant`               | boolean, default false («Seleccionable para expediente»; read by nothing until D-07)         | yes                     |
| `archived`                  | boolean, default false (v1.8 «Archivar» / «Restaurar»)                                       | update only             |
| `created_at` / `updated_at` | timestamptz (`set_updated_at`)                                                               | –                       |

RLS: own rows only (select/insert/update/delete); **no organization, manager or platform-admin policy** — unlike the
passport and availability (OD-4), the technician's own organization cannot read it. No status column: every entry is
self-declared (v1.8 `status: 'self-declared'`) and nothing can verify one. Creates go through
`create_logbook_entry` (idempotent); direct PostgREST writes are held to the same CHECKs and date trigger.
Account deletion cascades (auth user → profile → technician profile → entries; keys through the profile).

### `app_private.document_object_tombstones` · `app_private.document_retention_settings` (`20261019160200`, LOCAL ONLY)

Tombstones (`id`, `storage_path`, `owner_id` (no FK), `reason` `owner_delete` · `account_deleted` · `operator_delete` ·
`orphan_upload`, `deleted_at`, `purge_after`, `legal_hold` default false, `purged_at`, `attempts`, `last_error` ≤ 200;
one open tombstone per path) are written by the AFTER DELETE trigger on `professional_documents` and by
reconciliation. Settings: one row (`account_deletion_grace` default 30 days, `orphan_upload_grace` default 24 h).
Both: RLS on, no policy, no grant — DEFINER functions only. Retention rules: `DOCUMENT_WALLET.md` §6.

### `audit_events`

`id`, `actor_profile_id`, `organization_id` nullable, `action`, `entity_type`, `entity_id`,
`metadata jsonb` (never secrets / documents), `created_at`. **Append-only**: no insert/update/delete
grant for API roles; rows are written by SECURITY DEFINER triggers.

Actions in use: `requirement.created`, `requirement.status_changed` (`{from,to}`; covered ↔ open set by an
application carry `system: true` and no actor, since `20261022130300`), `requirement.updated` (`{fields}`, M05 edit),
`application.<status>` (`received` … `cancelled`, one per successful apply/transition, metadata `from`, `to`,
`actor` side, `requirement_id`, `proposal_version`, `reason_provided`, `request_id` — never the reason; rows whose
actor is the technician have **no organization id**, so an organization's audit trail never carries an applicant's
profile id, T-04), `qualification.verified`, `qualification.reviewed` (platform
review decision with previous/new status, `note_provided`, `request_id`; since `20261015130400`), `qualification.created`,
`qualification.updated` (type, status or dates changed), `qualification.removed` (owner delete only,
not account-deletion cascades) — the last three since `20261015120000`; `document.uploaded`,
`document.updated` (with the changed field names) and `document.deleted` (owner delete only) since
`20261019160000` (LOCAL ONLY; metadata: ids, kind, mime, size, sha256 — never title or path); `document.purged`
(tombstone id, owner id, reason, `object_found`) since `20261019160200`; `logbook.created`, `logbook.updated`
(`changed` field names) and `logbook.deleted` (owner delete only, not account-deletion cascades) since
`20261023200000` (LOCAL ONLY; metadata: the technician profile id and the changed field names — never a value, and
never the selection flag, not even as a changed name: an update that only toggles it is not audited, because platform
admins read every audit row; security review 2026-10-22). Like the document rows, logbook audit rows keep their
entity and technician profile ids after an account deletion (the actor becomes null). Reserved: `organization.member_added`; the hiring
(tombstone id, owner id, reason, `object_found`) since `20261019160200`. `organization.updated` (`{fields,
review_reset}`, with the organization id: the organization's admin reads it in «Actividad de esta organización») and
`organization.reviewed` (`{previous_review_status, review_status, note_provided, request_id}`, **no organization
id**, so the reviewer's id never reaches the organization's trail; never the note) since `20261023500100` (LOCAL); `organization.member_removed` (`{profile_id, role}`, with the organization id, every removal path; skipped when the organization itself is deleted) since `20261023500400` (LOCAL).
Reserved: `organization.member_added`; the hiring
block's Candidate Pack (D-07, not implemented) will use `pack.contact_viewed` / `pack.document_url_issued`
(`APPLICATIONS_STATE_MACHINE.md` §4.2 — `document.shared` and `candidate_pack.shared` are superseded).

## Database functions

| Function                                                                                                                                                                                 | Security        | Purpose                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_org_member(org)` / `has_org_role(org, roles)` / `is_platform_admin()`                                                                                                                | DEFINER, stable | RLS helpers (avoid recursive policies).                                                                                                                                                                                                                  |
| `create_work_requirement(...)`                                                                                                                                                           | INVOKER         | Atomic create, RLS enforced.                                                                                                                                                                                                                             |
| `get_requirement_candidate_pool(requirement_id)`                                                                                                                                         | DEFINER         | Returns **matchable data only** for internal + external pools after checking the caller is admin/manager of the requirement's organization. External selection: hard-eligible first (`20261015130300`).                                                  |
| `get_requirement_external_pool_summary(requirement_id)`                                                                                                                                  | DEFINER         | Counts only (`prefiltered`, `hard_eligible`, `cap`), same authorization: tells the UI whether the external evaluation is complete.                                                                                                                       |
| `update_professional_profile(...)`                                                                                                                                                       | INVOKER         | Atomic passport save (two tables, one transaction) with optional optimistic concurrency (`CF412`). Superseded locally by `save_professional_passport`; kept for the deployed function.                                                                   |
| `save_professional_passport(passport jsonb, expected_updated_at)` (`20261023100200`, local only)                                                                                         | DEFINER         | Whole v1.8 passport in one transaction (5 tables, full replacement), `CF412`; professionals only (42501); exact keys, no repeats, ≤ 40 ratings, ≤ 200 blocks, ratings on declared values (22023). Sole writer of the new columns and tables.             |
| `list_blockable_organizations()` (`20261023100200`, local only)                                                                                                                          | DEFINER, stable | Professionals only (42501): id + name of organizations that published (non-draft), own memberships, own blocks and employer (those first; ≤ 500), for «Empresa actual» and «Organizaciones bloqueadas».                                                  |
| `get_requirement_candidate_passports(requirement_id)` (`20261023100300`, local only)                                                                                                     | DEFINER, stable | Pool authorization (admin/manager, 42501); exactly the rows of `get_requirement_candidate_pool` (calls it): ref, main category, categories, aircraft, English, permits, `has_restrictions`. Nothing private.                                             |
| `create_work_requirement_idempotent` · `create_availability_window` · `declare_qualification` · `replace_availability_days` (`20261019120000`, 3-arg since `20261019140000`, local only) | INVOKER         | Idempotent creates (`Idempotency-Key`), key claimed in the same transaction (`app_private.idempotency_keys`).                                                                                                                                            |
| `create_professional_document(key, kind, title, storage_path, mime_type, size_bytes, sha256, expires_at, qualification_id)` (`20261019160000`, local only)                               | INVOKER         | Idempotent document create (`document.create`); path must be `<uid>/<key>-<sha256[0:16]>` (`22023` otherwise); `CF409` same key, other request.                                                                                                          |
| `create_logbook_entry(key, entry_date, aircraft, ata, hours, category, environment, description, cv_relevant)` (`20261023200000`, local only)                                            | INVOKER         | Idempotent logbook create (`logbook_entry.create`), owner = JWT subject; `CF409` same key, other request. The operation CHECK is re-created from its current definition (values are added, never dropped).                                               |
| `is_feature_enabled(name)` (`20261019160200`, local only)                                                                                                                                | DEFINER, stable | Whitelisted owner flags (`document_wallet`) for the Next.js server; signed-in users only.                                                                                                                                                                |
| `document_maintenance_batch(apply, limit)` · `document_purge_recheck(tombstone)` · `document_purge_record(tombstone, outcome, error)` (`20261019160200`, local only)                     | DEFINER         | Platform admin only (re-checked in the body): orphan reconciliation + due tombstones (≤ 100), per-object re-check under row lock, outcome + audit `document.purged`. Never delete objects themselves.                                                    |
| `review_qualification(id, decision, expected_updated_at, note, request_id)`                                                                                                              | DEFINER         | Requires `app_private.feature_flags('qualification_review')`; platform admin only, never own, `pending` → `verified`/`rejected` for the version the reviewer saw, row lock, audit `qualification.reviewed`.                                              |
| `own_qualification_reviews()`                                                                                                                                                            | DEFINER, stable | The caller's own review reasons (the column is not readable otherwise).                                                                                                                                                                                  |
| `enforce_requirement_qualifications()`                                                                                                                                                   | DEFINER trigger | BR-1.4 at commit (deferred).                                                                                                                                                                                                                             |
| `handle_new_user()`                                                                                                                                                                      | DEFINER trigger | Creates profile (+ technician profile or organization + admin membership).                                                                                                                                                                               |
| `list_opportunities(id, urgency, q, limit)` (`20261022130200`, local only)                                                                                                               | DEFINER, stable | D-12: published, current requirements (`open`, `ends_at > now()`) for professional accounts only (42501 otherwise), fixed projection (organization name, no ids of people/organizations, no counts), ≤ 200 rows, `total`.                                |
| `own_candidate_profile(from, to)` (`20261022130200`, local only)                                                                                                                         | INVOKER, stable | The caller's own matchable data in the candidate-pool column shape (`toCandidate`), for their own eligibility.                                                                                                                                           |
| `update_work_requirement(id, expected_updated_at, …, qualifications)` (`20261022130300`, local only)                                                                                     | DEFINER         | M05 edit (see `work_requirements`): admin/manager, creation validations, `CF412`, `CFA12` after any application, `55000` closed, no-op when unchanged, audit `requirement.updated`.                                                                      |
| `apply_to_requirement(requirement_id, key, share_consent, request_id)` (`20261022130300`, local only)                                                                                    | DEFINER         | ∅ → `received`: technician only, idempotent (`application.create`), open (`CFA01`), not started (`CFA02`), Q5/T-09 (`CFA09`/`CFA10`), eligible now (T-08: `CFA03`/`CFA04`); the share consent must be `true` (22023), recorded as a flag; event + audit. |
| `transition_application(id, to, expected_updated_at, key, reason, proposal_id, request_id)` (`20261022130300`, local only)                                                               | DEFINER         | Every other transition (`app_private.application_transitions`): locks, side from the DB, idempotent (`application.transition`), version `CF412`, proposals, confirm re-checks, covered ↔ open; event + audit.                                            |
| `get_requirement_applications(requirement_id)` · `get_my_applications()` · `get_application_counts(org)` (`20261022130300`, local only)                                                  | DEFINER, stable | Org view (admin/manager, pool rules, 42501 otherwise) · own applications with the requirement card · counts per status (admin/manager).                                                                                                                  |
| `protect_assignment_availability()` · `app_private.confirmed_assignment_overlaps(from, to)` (`20261023300000`, local only)                                                               | DEFINER         | BR-4.9: AFTER trigger on `availability_windows` (a write that leaves a confirmed assignment it reduces below 100 % → `CFV01`) · does a period overlap the caller's own confirmed assignment (`auth.uid()`).                                              |
| `update_organization_profile(id, expected_updated_at, name, type, country, tax_id, tax_address)` (`20261023500100`, local only)                                                          | INVOKER         | «Organización» save: RLS decides (admin only; anyone else 42501), input checks (22023), version `CF412`, no write when nothing changed. Returns the new version.                                                                                         |
| `review_organization(id, expected_updated_at, note, request_id)` (`20261023500100`, local only)                                                                                          | DEFINER         | Platform admin, never a current or former own organization (42501, `500400`), evidence 1–2000 (22023), row lock, pending + seen version + fiscal data complete (55000), P0002; sets `reviewed`, keeps the evidence, audit.                               |
| `get_platform_summary()` (`20261023500300`, local only)                                                                                                                                  | DEFINER, stable | Platform admin only (42501): professional accounts, organizations, active needs, working now, AOG with vacancies, seats to fill per hard licence (`demand`). Counts only, no money (T-53).                                                               |
| `set_updated_at()`                                                                                                                                                                       | trigger         | Reusable `updated_at` maintenance.                                                                                                                                                                                                                       |

### `app_private` schema (not exposed by PostgREST)

`feature_flags(name, enabled)` — owner-only switches, no grant (`qualification_review` gates the review RPC).
`application_transitions(from_status, to_status, actor, reason_required)` — the 16 rows of
`APPLICATION_TRANSITIONS`, no grant (`20261022130300`). View `requirement_cards` — the one projection of a requirement
professionals may see (also the proposal terms), no grant (`20261022130200`). `hard_eligibility(requirement, profile)`
— BR-2/BR-3/BR-4.8 for one professional, the same expressions as `ranked_external_pool` (rls suite W proves the
three agree), used at apply and confirm.
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
