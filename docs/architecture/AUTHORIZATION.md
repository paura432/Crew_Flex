# Authorization

**Authentication ≠ authorization.** A session proves who you are; permissions are derived from the
database, never from the client.

## Roles

| Role                   | Source                                            | Grants                                                                                          |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `professional`         | `technician_profiles` row exists for `auth.uid()` | Own profile, qualifications, availability.                                                      |
| `organization_member`  | `organization_members.role = member`              | Read own org, its requirements.                                                                 |
| `organization_manager` | `organization_members.role = manager`             | + create/update requirements, read internal workforce, run capacity/matching.                   |
| `organization_admin`   | `organization_members.role = admin`               | + update organization, manage members.                                                          |
| `platform_admin`       | `profiles.platform_role = platform_admin`         | Read access across tables for support; verification (PLANNED, via privileged audited function). |

`profiles.account_type` only chooses the default workspace route. It grants nothing.

## Permission matrix (RLS)

| Table                             | select                                                                   | insert                                       | update                                                               | delete            |
| --------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------- | ----------------- |
| `profiles`                        | own · same-org admin/manager · platform admin                            | trigger only                                 | own (`display_name` column only)                                     | –                 |
| `technician_profiles`             | own · admin/manager of an org the technician belongs to · platform admin | own                                          | own (all except `profile_id`)                                        | –                 |
| `organizations`                   | members · platform admin                                                 | trigger only (sign-up)                       | admin                                                                | –                 |
| `organization_members`            | members of same org · platform admin                                     | org admin                                    | org admin                                                            | org admin         |
| `qualification_types`             | any authenticated                                                        | –                                            | –                                                                    | –                 |
| `technician_qualifications`       | own · admin/manager of technician's org · platform admin                 | own, `verification_status` must be `pending` | own (not `verification_status`; evidence change resets to `pending`) | own               |
| `availability_windows`            | own · admin/manager of technician's org · platform admin                 | own                                          | own                                                                  | own               |
| `work_requirements`               | org members · platform admin                                             | org admin/manager, `created_by = auth.uid()` | org admin/manager                                                    | –                 |
| `work_requirement_qualifications` | org members · platform admin                                             | org admin/manager                            | –                                                                    | org admin/manager |
| `audit_events`                    | org admin (own org) · platform admin                                     | – (definer triggers)                         | –                                                                    | –                 |

`anon` has **no** table privileges.

## Edge Function checklist

Every protected handler, in order:

1. `requireActor(req)` → verifies JWT via `supabase.auth.getClaims()`; 401 `UNAUTHORIZED` otherwise.
2. Create a Supabase client **bound to the caller's token** (RLS applies).
3. Authorize the operation with a DB read (e.g. membership role) → 403 `FORBIDDEN`.
4. Validate payload with a strict Zod schema → 400 `VALIDATION_ERROR`.
5. Execute. RLS is the second line of defense.

Service role: **not used in V0.** Any future use requires: server-side only, explicit
authorization check first, audit event, and a note in `EDGE_FUNCTIONS.md`.
