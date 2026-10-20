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
                  │                        └──────────1─* availability_windows
                  │
                  └─* organization_members *─1 organizations 1─* work_requirements 1─* work_requirement_qualifications *─1 qualification_types

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

### `organizations`

`id`, `name` (2–160), `type` (`mro` · `airline` · `operator` · `staffing_agency` · `other`),
`country` (ISO 3166-1 alpha-2, nullable), timestamps. Created at sign-up for
`account_type = organization`, with the creator as `admin`.

### `organization_members`

PK (`organization_id`, `profile_id`), `role` (`member` · `manager` · `admin`), `created_at`.
Organization role is independent from `platform_role`.

### `qualification_types`

Reference catalog. `id`, `code` (unique, e.g. `B1.1`, `TR-A320`, `EWIS`), `name`, `category`
(`LICENSE` · `TYPE_RATING` · `TRAINING` · `APPROVAL` · `SKILL`), `requires_expiry`, `created_at`.
Written only by migrations/seed (no user write grant).

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

### `work_requirement_qualifications`

`id`, `work_requirement_id`, `qualification_type_id` (unique per requirement), `requirement_level`
(`hard` · `soft`).

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

Actions in use: `requirement.created`, `qualification.verified`, `qualification.reviewed` (platform
review decision with previous/new status, `note_provided`, `request_id`; since `20261015130400`), `qualification.created`,
`qualification.updated` (type, status or dates changed), `qualification.removed` (owner delete only,
not account-deletion cascades) — the last three since `20261015120000`; `document.uploaded`,
`document.updated` (with the changed field names) and `document.deleted` (owner delete only) since
`20261019160000` (LOCAL ONLY; metadata: ids, kind, mime, size, sha256 — never title or path); `document.purged`
(tombstone id, owner id, reason, `object_found`) since `20261019160200`. Reserved: `organization.member_added`; the hiring
block uses `application.<status>` and `pack.contact_viewed` / `pack.document_url_issued`
(`APPLICATIONS_STATE_MACHINE.md` §4.2 — `document.shared` and `candidate_pack.shared` are superseded).

## Database functions

| Function                                                                                                                                                                                 | Security        | Purpose                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_org_member(org)` / `has_org_role(org, roles)` / `is_platform_admin()`                                                                                                                | DEFINER, stable | RLS helpers (avoid recursive policies).                                                                                                                                                                     |
| `create_work_requirement(...)`                                                                                                                                                           | INVOKER         | Atomic create, RLS enforced.                                                                                                                                                                                |
| `get_requirement_candidate_pool(requirement_id)`                                                                                                                                         | DEFINER         | Returns **matchable data only** for internal + external pools after checking the caller is admin/manager of the requirement's organization. External selection: hard-eligible first (`20261015130300`).     |
| `get_requirement_external_pool_summary(requirement_id)`                                                                                                                                  | DEFINER         | Counts only (`prefiltered`, `hard_eligible`, `cap`), same authorization: tells the UI whether the external evaluation is complete.                                                                          |
| `update_professional_profile(...)`                                                                                                                                                       | INVOKER         | Atomic passport save (two tables, one transaction) with optional optimistic concurrency (`CF412`).                                                                                                          |
| `create_work_requirement_idempotent` · `create_availability_window` · `declare_qualification` · `replace_availability_days` (`20261019120000`, 3-arg since `20261019140000`, local only) | INVOKER         | Idempotent creates (`Idempotency-Key`), key claimed in the same transaction (`app_private.idempotency_keys`).                                                                                               |
| `create_professional_document(key, kind, title, storage_path, mime_type, size_bytes, sha256, expires_at, qualification_id)` (`20261019160000`, local only)                               | INVOKER         | Idempotent document create (`document.create`); path must be `<uid>/<key>-<sha256[0:16]>` (`22023` otherwise); `CF409` same key, other request.                                                             |
| `is_feature_enabled(name)` (`20261019160200`, local only)                                                                                                                                | DEFINER, stable | Whitelisted owner flags (`document_wallet`) for the Next.js server; signed-in users only.                                                                                                                   |
| `document_maintenance_batch(apply, limit)` · `document_purge_recheck(tombstone)` · `document_purge_record(tombstone, outcome, error)` (`20261019160200`, local only)                     | DEFINER         | Platform admin only (re-checked in the body): orphan reconciliation + due tombstones (≤ 100), per-object re-check under row lock, outcome + audit `document.purged`. Never delete objects themselves.       |
| `review_qualification(id, decision, expected_updated_at, note, request_id)`                                                                                                              | DEFINER         | Requires `app_private.feature_flags('qualification_review')`; platform admin only, never own, `pending` → `verified`/`rejected` for the version the reviewer saw, row lock, audit `qualification.reviewed`. |
| `own_qualification_reviews()`                                                                                                                                                            | DEFINER, stable | The caller's own review reasons (the column is not readable otherwise).                                                                                                                                     |
| `enforce_requirement_qualifications()`                                                                                                                                                   | DEFINER trigger | BR-1.4 at commit (deferred).                                                                                                                                                                                |
| `handle_new_user()`                                                                                                                                                                      | DEFINER trigger | Creates profile (+ technician profile or organization + admin membership).                                                                                                                                  |
| `set_updated_at()`                                                                                                                                                                       | trigger         | Reusable `updated_at` maintenance.                                                                                                                                                                          |

### `app_private` schema (not exposed by PostgREST)

`feature_flags(name, enabled)` — owner-only switches, no grant (`qualification_review` gates the review RPC).
`idempotency_keys(actor_id → profiles, operation, key uuid, request_hash, resource_id, created_at)`, PK
(actor, operation, key), RLS own rows; `ranked_external_pool(requirement_id)` (ordering helper, no grant
to API roles); `claim_idempotency_key` / `complete_idempotency_key`.

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
