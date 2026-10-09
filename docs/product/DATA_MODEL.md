# Data Model V0

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

| Column                      | Type                                         | Notes                                                                     |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------- |
| `id`                        | uuid PK → `auth.users(id)` on delete cascade |                                                                           |
| `display_name`              | text 1–120                                   | Only column a user can update.                                            |
| `account_type`              | `professional` · `organization`              | Chosen at sign-up. UX routing only; **grants no permission**.             |
| `platform_role`             | `user` · `platform_admin`                    | Default `user`. Never read from sign-up metadata, not updatable by users. |
| `created_at` / `updated_at` | timestamptz                                  |                                                                           |

### `technician_profiles`

| Column             | Type                                            |
| ------------------ | ----------------------------------------------- |
| `profile_id`       | uuid PK → `profiles(id)`                        |
| `base_location`    | text ≤ 80, nullable                             |
| `mobility`         | `local` · `national` · `international`          |
| `years_experience` | int 0–60, nullable                              |
| `current_status`   | `employed` · `contractor` · `between_contracts` |
| `visibility`       | `private` (default) · `anonymous` · `open`      |

Created by trigger for `account_type = professional`.

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

| Column                  | Type                                            | Writable by owner |
| ----------------------- | ----------------------------------------------- | ----------------- |
| `id`                    | uuid PK                                         | –                 |
| `technician_profile_id` | → `technician_profiles`                         | insert only       |
| `qualification_type_id` | → `qualification_types`, unique per technician  | yes               |
| `status`                | `active` · `withdrawn`                          | yes               |
| `issued_at`             | date, nullable                                  | yes               |
| `expires_at`            | date, nullable, `≥ issued_at`                   | yes               |
| `verification_status`   | `pending` · `verified` · `rejected` · `expired` | **no**            |

Trigger `reset_verification_on_change`: if the owner changes type/dates of a non-pending
qualification, verification returns to `pending` (prevents "verify then extend expiry" tampering).

### `availability_windows`

`id`, `technician_profile_id`, `starts_at`, `ends_at` (`> starts_at`), `status`
(`available` · `unavailable`), timestamps.

### `work_requirements`

`id`, `organization_id`, `title`, `location`, `starts_at`, `ends_at`, `shift`, `headcount` (1–50),
`urgency`, `status`, `created_by` → `profiles`, timestamps. Created through RPC
`create_work_requirement(...)` (SECURITY INVOKER: RLS applies) which inserts the requirement and its
qualifications in one transaction.

### `work_requirement_qualifications`

`id`, `work_requirement_id`, `qualification_type_id` (unique per requirement), `requirement_level`
(`hard` · `soft`).

### `audit_events`

`id`, `actor_profile_id`, `organization_id` nullable, `action`, `entity_type`, `entity_id`,
`metadata jsonb` (never secrets / documents), `created_at`. **Append-only**: no insert/update/delete
grant for API roles; rows are written by SECURITY DEFINER triggers.

Actions in use: `requirement.created`, `qualification.verified`. Reserved: `qualification.created`,
`qualification.updated`, `document.shared`, `candidate_pack.shared`, `organization.member_added`.

## Database functions

| Function                                                                  | Security        | Purpose                                                                                                                                     |
| ------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_org_member(org)` / `has_org_role(org, roles)` / `is_platform_admin()` | DEFINER, stable | RLS helpers (avoid recursive policies).                                                                                                     |
| `create_work_requirement(...)`                                            | INVOKER         | Atomic create, RLS enforced.                                                                                                                |
| `get_requirement_candidate_pool(requirement_id)`                          | DEFINER         | Returns **matchable data only** for internal + external pools after checking the caller is admin/manager of the requirement's organization. |
| `handle_new_user()`                                                       | DEFINER trigger | Creates profile (+ technician profile or organization + admin membership).                                                                  |
| `set_updated_at()`                                                        | trigger         | Reusable `updated_at` maintenance.                                                                                                          |

## Types

- **Database types:** `src/types/database.ts`. Generated with `pnpm db:types` once the project is
  linked. Until then it is a hand-written subset (PARTIAL — see `OPEN_DECISIONS.md`).
- **Domain types:** `src/domain/*`. A row is not a domain object; edge functions map rows →
  domain explicitly.

## Storage (PLANNED)

Private bucket `evidence`. DB stores `object_path` only; access via authorization check + signed URL
(≤ 60 s). Never a public bucket for CVs, licences, certificates or IDs. Never persist signed URLs.
