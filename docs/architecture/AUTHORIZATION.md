# Authorization

> **Local vs production (2026-10-15).** Production has only migrations `20261009120000` and `20261009120100`.
> Every object, rule enforcement or control below that cites a migration dated `20261011…` or `20261015…`
> exists **only in the local database** until the authorized rollout (`docs/audit/CREWFLEX_DIFF_CURRENT.md` §5;
> state in `memory-bank/01-current-state.md`).

**Authentication ≠ authorization.** A session proves who you are; permissions are derived from the
database, never from the client.

## Roles

| Role                   | Source                                            | Grants                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `professional`         | `technician_profiles` row exists for `auth.uid()` | Own profile, qualifications, availability, logbook. LOCAL (`20261022130200/130300`): list published requirements (`list_opportunities`, D-12), apply, accept/withdraw own applications and cancel an own confirmed assignment (`transition_application`, technician side).                        |
| `organization_member`  | `organization_members.role = member`              | Read own org, its requirements, colleagues' membership rows (not their profiles; `/workforce` shows a managers-only state).                                                                                                                                                                       |
| `organization_manager` | `organization_members.role = manager`             | + create/update requirements, read internal workforce, run capacity/matching. LOCAL: read the requirement's applications (`get_requirement_applications`, pool rules) and act on them for the organization (shortlist, propose, reject, confirm, cancel, finish); never on their own application. |
| `organization_admin`   | `organization_members.role = admin`               | + update organization (LOCAL: `update_organization_profile`, never its review state), manage members.                                                                                                                                                                                             |
| `platform_admin`       | `profiles.platform_role = platform_admin`         | Read access across tables for support; reviews pending qualifications through DEFINER `review_qualification` (never their own; audited) — IMPLEMENTED locally 2026-10-15, **OD-3 approval checkpoint** before any remote use. Never derived from metadata; no grant can set it.                   |

`profiles.account_type` only chooses the default workspace route. It grants nothing. Platform admins start at
`/app/admin` and get a «Ver como» switcher (D-13: Técnico / Empresa / Recruiter / Administración) that only links
to their own workspaces: it grants nothing and opens no new read path; `/app/admin` and `/app/recruiter` are 404
for anyone else.

## Permission matrix (RLS)

| Table                                                 | select                                                                                                                                            | insert                                                                                        | update                                                                                                                                                                                                                                                                                                                                        | delete                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `profiles`                                            | own · same-org admin/manager · platform admin                                                                                                     | trigger only                                                                                  | own (`display_name`, `preferred_locale` columns only)                                                                                                                                                                                                                                                                                         | –                                                                                       |
| `technician_profiles`                                 | own · admin/manager of an org the technician belongs to · platform admin                                                                          | own                                                                                           | own (all except `profile_id`)                                                                                                                                                                                                                                                                                                                 | –                                                                                       |
| `organizations`                                       | members · platform admin (LOCAL: fiscal data and review state included)                                                                           | trigger only (sign-up)                                                                        | admin: `name`, `type`, `country`, `tax_id`, `tax_address` (column grants). `review_status` / `reviewed_at`: **no grant** — only `review_organization` (platform admin). Any data change returns a reviewed organization to `pending` (trigger, every path) and is audited `organization.updated`                                              | –                                                                                       |
| `organization_reviews` (LOCAL)                        | platform admin                                                                                                                                    | – (`review_organization` only)                                                                | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `organization_members`                                | members of same org · platform admin                                                                                                              | – (invitation + consent flow is NEXT; prevents admins from attaching arbitrary professionals) | org admin                                                                                                                                                                                                                                                                                                                                     | org admin                                                                               |
| `qualification_types`                                 | any authenticated                                                                                                                                 | –                                                                                             | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `technician_qualifications`                           | own · admin/manager of technician's org · platform admin                                                                                          | own, `verification_status` must be `pending`                                                  | own (not `verification_status` nor `reviewed_*`/`review_note`; evidence change resets to `pending` and clears the review). Review: platform admin via `review_qualification` only. **Select is column-limited**: `reviewed_by` and `review_note` are not readable by API roles; the owner reads reasons through `own_qualification_reviews()` | own                                                                                     |
| `availability_windows`                                | own · admin/manager of technician's org · platform admin                                                                                          | own                                                                                           | own                                                                                                                                                                                                                                                                                                                                           | own                                                                                     |
| `work_requirements`                                   | org members · platform admin                                                                                                                      | org admin/manager, `created_by = auth.uid()`                                                  | org admin/manager                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `work_requirement_qualifications`                     | org members · platform admin                                                                                                                      | org admin/manager                                                                             | –                                                                                                                                                                                                                                                                                                                                             | org admin/manager (BR-1.4 checked at commit: ≥ 1 hard, ≤ 20 for non-draft requirements) |
| `audit_events`                                        | org admin (own org) · platform admin                                                                                                              | – (definer triggers)                                                                          | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `applications` (LOCAL)                                | own (technician) · platform admin. Organizations: **none** — only through `get_requirement_applications` (admin/manager of the requirement's org) | – (`apply_to_requirement` only)                                                               | – (`transition_application` only)                                                                                                                                                                                                                                                                                                             | – (cascades only)                                                                       |
| `logbook_entries` (LOCAL, M14)                        | own only — **no** organization (not even the technician's own, unlike OD-4), manager or platform-admin policy                                     | own (RPC or direct; CHECKs + «no future date» trigger)                                        | own (not `technician_profile_id`)                                                                                                                                                                                                                                                                                                             | own                                                                                     |
| `application_proposals`, `application_events` (LOCAL) | whoever may read the parent application (RLS through it)                                                                                          | – (RPC only)                                                                                  | – (refused by trigger, owner included)                                                                                                                                                                                                                                                                                                        | – (cascades only)                                                                       |
| `technician_type_ratings` (LOCAL, `20261023100100`)   | own · admin/manager of technician's org · platform admin (like the qualifications)                                                                | – (`save_professional_passport` only)                                                         | – (RPC only)                                                                                                                                                                                                                                                                                                                                  | – (RPC only)                                                                            |
| `technician_private_details` (LOCAL)                  | **own only** (not the organization, not platform admins)                                                                                          | – (RPC only)                                                                                  | – (RPC only)                                                                                                                                                                                                                                                                                                                                  | – (cascade)                                                                             |
| `technician_organization_blocks` (LOCAL)              | **own only**                                                                                                                                      | – (RPC only)                                                                                  | –                                                                                                                                                                                                                                                                                                                                             | – (RPC only)                                                                            |
| `notifications` (LOCAL)                               | – (no grant). The recipient's own, through `get_my_notifications` only (access and retention re-checked)                                          | – (DEFINER triggers of the event only)                                                        | – (no grant). Own `read_at` through `mark_notifications_read` (DEFINER, `auth.uid()` in the body)                                                                                                                                                                                                                                             | – (cascades, retention, cap, role loss)                                                 |

| `app_private.feature_flags` | – (no grant; owner only) | – | – | – |
| `app_private.application_transitions`, `app_private.requirement_cards` | – (no grant; read by the DEFINER RPCs) | – | – | – |
| `app_private.idempotency_keys` | own (schema not exposed by PostgREST; reached only through the create RPCs) | own, via the create RPCs | own `resource_id`, via the create RPCs | – |

`anon` has **no** table privileges.

**v1.8 passport (package passport, LOCAL `20261023100*`).** The new `technician_profiles` columns (main category,
categories, aircraft, engines, capabilities, English, own tools, base country, work permits, general restrictions)
follow the row policy above and have **no** column grant: like the three tables, they are written only by the
DEFINER `save_professional_passport`, which writes the caller's rows (`auth.uid()`, a technician profile; 42501
otherwise) in one transaction with the version check. Phone, current employer, minimum rate and blocked
organizations are **owner-only** (D-07, OD-7): no organization, colleague or platform admin reads them, and no
function returns them to anyone else. Professionals list organizations to block through
`list_blockable_organizations()` (professionals only; id + name of the organizations that have published a
requirement at least once — names the network has seen in the opportunities — plus their own memberships and
whatever they already blocked or named as employer; never the whole directory, since anyone can sign up as a
professional — security review MEDIUM-1). Unlike `list_opportunities`, it returns organization ids: they are
needed to block, and they open nothing without membership. A block is applied server-side:
`app_private.ranked_external_pool` leaves the professional out of that organization's external pool and counts
(T-35). Organizations see candidates' declarations only through `get_requirement_candidate_passports`, which
calls `get_requirement_candidate_pool` (same admin/manager check, cap, pseudonyms and blocks) and returns category,
categories, aircraft, English, permits and a `has_restrictions` flag — never the restriction text.

**Published requirements and applicants (D-12 / D-06, LOCAL `20261022130200/130300`).** Professionals still cannot
SELECT `work_requirements`, `organizations` or `work_requirement_qualifications` of other organizations: they read
the published ones (`open`, not ended) only through `list_opportunities`, a fixed projection with the organization
**name** and no ids of people or organizations. An organization reads its applicants only through
`get_requirement_applications`, with the candidate-pool rules (T-04 pseudonym unless internal; name for internal or
`open`; relevant qualifications and overlapping windows; no contact data, no documents — D-07 not activated). A
`private` professional who applies becomes visible to that organization for that requirement (S-7 exception by their
own act). The transition RPC decides the side from the database (applicant = technician; admin/manager of the
requirement's organization who is not the applicant = organization; anyone else gets the same `P0002` as a random id).

**Protected assignment days (BR-4.9, LOCAL `20261023300000`).** The owner's availability writes stay "own", but a
write that touches one of the owner's `confirmed` assignments is refused for everybody (`CFV01` → 409
`ASSIGNMENT_PROTECTED`): the DEFINER trigger `protect_assignment_availability()` reads the owner's applications and
their requirement periods (which a professional cannot SELECT), and `app_private.confirmed_assignment_overlaps(from, to)`
(DEFINER, `authenticated` only) answers only about `auth.uid()`'s own confirmed applications — no other person's data
and no oracle beyond what the caller already reads through RLS. No new grant on a table.
**Organization review and «Empresas verificadas» (OD-5 default = v1.8, LOCAL `20261023500000`…`500300`).** An
organization is `pending` until a platform admin registers its review (`review_organization`: platform role in
the body, never an organization the admin belongs, belonged or acted for (removals audited `organization.member_removed`, `20261023500400`) — «La empresa no puede verificarse a sí misma» —, pending
only, for the version the reviewer saw, fiscal data complete, evidence kept in `organization_reviews`, which
only platform admins read). A professional with visibility `verified_orgs` enters the external pool
(`ranked_external_pool`, hence `get_requirement_candidate_pool` and its summary) **only** for requirements of a
reviewed organization, always pseudonymous; for any other organization it is as invisible as `private`. The
S-7 exception (applying) is unchanged. `get_platform_summary` (DEFINER, platform admin, 42501 otherwise) returns
counts only; the audit view reads `audit_events` under the existing policy.
**In-app notices (v2-18, LOCAL `20261023800000`).** Any signed-in account reads only the notices addressed to it.
Who receives one is decided in the database, in the transaction of the event: the other party of each application
event (the applicant when the organization acts; every admin/manager of the requirement's organization, except the
applicant, when the technician acts) and the active applicants when the requirement is paused, resumed or closed —
never the actor, never a plain `member`. Reading re-checks access at read time: an organization recipient must still
be admin/manager of that organization (losing the role also deletes those notices), and sees the applicant under the
pool rules (T-04). The table has no grant to any API role (owner-only policies stay as a second layer): reads go
through `get_my_notifications`, marks through `mark_notifications_read` (own rows, `read_at` only). The event
trigger share-locks the memberships it notifies, so a concurrent demotion waits and then deletes the new notice.

**Requirement builder (v2 diff area 30, LOCAL `20261023600000/600100`).** The new `work_requirements` columns
(`country`, `timezone`, `description`, `shifts`, `conditions`) are INSERT-only for `authenticated` (the create RPC is
SECURITY INVOKER under the existing admin/manager insert policy, which already allows `draft`); nobody holds UPDATE on
them — edits go through `update_work_requirement` (DEFINER, admin/manager in the body) — and `archived_at` has no grant
at all: only `archive_work_requirement` (DEFINER, admin/manager of the requirement's organization in the body; missing
and not allowed are the same 42501) writes it, one way. CHECK constraints validate every write path, the table owner
included. `count_viable_candidates` (DEFINER) answers admins/managers of the given organization only, with a count of
internal members plus `anonymous`/`open` professionals passing the hard filters — no identities, never `private`
(S-7): the same people matching already shows pseudonymously for a saved requirement. Professionals see the new terms
only through the fixed projection of `list_opportunities` and the proposal `terms` (no ids, no `archived_at`).

## Edge Function checklist

Every protected handler, in order:

1. `requireActor(req)` → verifies JWT via `supabase.auth.getClaims()`; 401 `UNAUTHORIZED` otherwise.
2. Create a Supabase client **bound to the caller's token** (RLS applies).
3. Authorize the operation with a DB read (e.g. membership role) → 403 `FORBIDDEN`.
4. Validate payload with a strict Zod schema → 400 `VALIDATION_ERROR`.
5. Execute. RLS is the second line of defense.

Service role: **not used in V0.** Any future use requires: server-side only, explicit
authorization check first, audit event, and a note in `EDGE_FUNCTIONS.md`.
