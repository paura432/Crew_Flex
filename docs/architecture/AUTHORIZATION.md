# Authorization

> **Local vs production (2026-10-15).** Production has only migrations `20261009120000` and `20261009120100`.
> Every object, rule enforcement or control below that cites a migration dated `20261011…` or `20261015…`
> exists **only in the local database** until the authorized rollout (`docs/audit/CREWFLEX_DIFF_CURRENT.md` §5;
> state in `memory-bank/01-current-state.md`).

**Authentication ≠ authorization.** A session proves who you are; permissions are derived from the
database, never from the client.

## Roles

| Role                   | Source                                            | Grants                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `professional`         | `technician_profiles` row exists for `auth.uid()` | Own profile, qualifications, availability, logbook. LOCAL (`20261022130200/130300`): list published requirements (`list_opportunities`, D-12), apply, accept/withdraw own applications and cancel an own confirmed assignment (`transition_application`, technician side).                                                                                        |
| `organization_member`  | `organization_members.role = member`              | Read own org, its requirements, colleagues' membership rows (not their profiles; `/workforce` shows a managers-only state).                                                                                                                                                                                                                                       |
| `organization_manager` | `organization_members.role = manager`             | + create/update requirements, read internal workforce, run capacity/matching. LOCAL: read the requirement's applications (`get_requirement_applications`, pool rules) and their Candidate Pack copies (`get_application_pack`) and act on them for the organization (shortlist, propose, reject, confirm, cancel, finish); never on their own application.        |
| `organization_admin`   | `organization_members.role = admin`               | + update organization (LOCAL: `update_organization_profile`, never its review state), manage members.                                                                                                                                                                                                                                                             |
| `platform_admin`       | `profiles.platform_role = platform_admin`         | Read access across tables for support; reviews pending qualifications through DEFINER `review_qualification` (never their own; audited) — IMPLEMENTED locally 2026-10-15, **OD-3 approval checkpoint** before any remote use. LOCAL: invites sign-ups while the `invitation_signup` flag is on (`invitations`). Never derived from metadata; no grant can set it. |

`profiles.account_type` only chooses the default workspace route. It grants nothing. Platform admins start at
`/app/admin` and get a «Ver como» switcher (D-13: Técnico / Empresa / Recruiter / Administración) that only links
to their own workspaces: it grants nothing and opens no new read path; `/app/admin` is 404 for anyone else and
`/app/recruiter` for anyone who is neither a platform admin nor a member whose acting organization is a staffing agency
(PKG recruiter; a platform admin without one sees a note).

## Permission matrix (RLS)

| Table                                                                       | select                                                                                                                                                                                              | insert                                                                                        | update                                                                                                                                                                                                                                                                                                                                        | delete                                                                                  |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `profiles`                                                                  | own · same-org admin/manager · platform admin                                                                                                                                                       | trigger only                                                                                  | own (`display_name`, `preferred_locale` columns only)                                                                                                                                                                                                                                                                                         | –                                                                                       |
| `technician_profiles`                                                       | own · admin/manager of an org the technician belongs to · platform admin                                                                                                                            | own                                                                                           | own (all except `profile_id`)                                                                                                                                                                                                                                                                                                                 | –                                                                                       |
| `organizations`                                                             | members · platform admin (LOCAL: fiscal data and review state included)                                                                                                                             | trigger only (sign-up)                                                                        | admin: `name`, `type`, `country`, `tax_id`, `tax_address` (column grants). `review_status` / `reviewed_at`: **no grant** — only `review_organization` (platform admin). Any data change returns a reviewed organization to `pending` (trigger, every path) and is audited `organization.updated`                                              | –                                                                                       |
| `organization_reviews` (LOCAL)                                              | platform admin                                                                                                                                                                                      | – (`review_organization` only)                                                                | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `qualification_reviews` (LOCAL, `20261027300000`)                           | platform admin                                                                                                                                                                                      | – (`review_qualification` only)                                                               | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `organization_members`                                                      | members of same org · platform admin                                                                                                                                                                | – (invitation + consent flow is NEXT; prevents admins from attaching arbitrary professionals) | org admin                                                                                                                                                                                                                                                                                                                                     | org admin                                                                               |
| `qualification_types`                                                       | any authenticated                                                                                                                                                                                   | –                                                                                             | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `technician_qualifications`                                                 | own · admin/manager of technician's org · platform admin                                                                                                                                            | own, `verification_status` must be `pending`                                                  | own (not `verification_status` nor `reviewed_*`/`review_note`; evidence change resets to `pending` and clears the review). Review: platform admin via `review_qualification` only. **Select is column-limited**: `reviewed_by` and `review_note` are not readable by API roles; the owner reads reasons through `own_qualification_reviews()` | own                                                                                     |
| `availability_windows`                                                      | own · admin/manager of technician's org · platform admin                                                                                                                                            | own                                                                                           | own                                                                                                                                                                                                                                                                                                                                           | own                                                                                     |
| `work_requirements`                                                         | org members · platform admin                                                                                                                                                                        | org admin/manager, `created_by = auth.uid()`                                                  | org admin/manager                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `work_requirement_qualifications`                                           | org members · platform admin                                                                                                                                                                        | org admin/manager                                                                             | –                                                                                                                                                                                                                                                                                                                                             | org admin/manager (BR-1.4 checked at commit: ≥ 1 hard, ≤ 20 for non-draft requirements) |
| `audit_events`                                                              | org admin (own org) · platform admin                                                                                                                                                                | – (definer triggers)                                                                          | –                                                                                                                                                                                                                                                                                                                                             | –                                                                                       |
| `account_invitations` (LOCAL)                                               | platform admin only, column-limited (no `code_hash`)                                                                                                                                                | – (`create_invitation` only)                                                                  | – (RPCs only)                                                                                                                                                                                                                                                                                                                                 | – (cascades with the account it created)                                                |
| `applications` (LOCAL)                                                      | own (technician) · platform admin. Organizations: **none** — only through `get_requirement_applications` (admin/manager of the requirement's org)                                                   | – (`apply_to_requirement` only)                                                               | – (`transition_application` only)                                                                                                                                                                                                                                                                                                             | – (cascades only)                                                                       |
| `logbook_entries` (LOCAL, M14)                                              | own only — **no** organization (not even the technician's own, unlike OD-4), manager or platform-admin policy; copied only by applying (BR-25)                                                      | own (RPC or direct; CHECKs + «no future date» trigger)                                        | own (not `technician_profile_id`)                                                                                                                                                                                                                                                                                                             | own                                                                                     |
| `application_proposals`, `application_events` (LOCAL)                       | whoever may read the parent application (RLS through it)                                                                                                                                            | – (RPC only)                                                                                  | – (refused by trigger, owner included)                                                                                                                                                                                                                                                                                                        | – (cascades only)                                                                       |
| `technician_type_ratings` (LOCAL, `20261023100100`)                         | own · admin/manager of technician's org · platform admin (like the qualifications)                                                                                                                  | – (`save_professional_passport` only)                                                         | – (RPC only)                                                                                                                                                                                                                                                                                                                                  | – (RPC only)                                                                            |
| `technician_private_details` (LOCAL)                                        | **own only** (not the organization, not platform admins)                                                                                                                                            | – (RPC only)                                                                                  | – (RPC only)                                                                                                                                                                                                                                                                                                                                  | – (cascade)                                                                             |
| `technician_organization_blocks` (LOCAL)                                    | **own only**                                                                                                                                                                                        | – (RPC only)                                                                                  | –                                                                                                                                                                                                                                                                                                                                             | – (RPC only)                                                                            |
| `represented_clients` (LOCAL, recruiter)                                    | members of the agency · platform admin (column-limited: `contact_email` only through `list_represented_clients`, admins/managers and platform admins)                                               | – (`add_represented_client`: admin/manager of a `staffing_agency`)                            | – (`revoke_represented_client`: the agency's admin/manager; `activate_represented_client`: platform admin, never their own agency)                                                                                                                                                                                                            | – (cascades with the agency)                                                            |
| `represented_client_reviews` (LOCAL, recruiter)                             | platform admin                                                                                                                                                                                      | – (`activate_represented_client` only)                                                        | –                                                                                                                                                                                                                                                                                                                                             | – (cascade)                                                                             |
| `notifications` (LOCAL)                                                     | – (no grant). The recipient's own, through `get_my_notifications` only (access and retention re-checked)                                                                                            | – (DEFINER triggers of the event; `outreach`: `requirement_outreach`)                         | – (no grant). Own `read_at` through `mark_notifications_read` (DEFINER, `auth.uid()` in the body)                                                                                                                                                                                                                                             | – (cascades, retention, cap, role loss)                                                 |
| `application_packs` (LOCAL, v2-15)                                          | – (no grant). Applicant · requirement org's admin/manager now, via `get_application_pack`; own copies via `get_my_application_packs`                                                                | – (AFTER INSERT trigger on `applications`; the applicant's own act only)                      | – (refused by trigger, owner included)                                                                                                                                                                                                                                                                                                        | – (trigger: withdrawal, account closure; cascades)                                      |
| `technician_notice_preferences` (LOCAL)                                     | **own only** (not the organization, not platform admins)                                                                                                                                            | own (`save_notice_preferences` or direct; CHECKs + zone trigger)                              | own, the form's columns (not `profile_id`)                                                                                                                                                                                                                                                                                                    | – (cascade with the account)                                                            |
| `outreach_distributions` (LOCAL)                                            | admin/manager of the requirement's organization · platform admin (urgency, count, time; no recipient)                                                                                               | – (`requirement_outreach` only)                                                               | –                                                                                                                                                                                                                                                                                                                                             | – (cascade with the requirement)                                                        |
| `training_providers` (LOCAL, `20261029100100`)                              | status `reviewed` → any authenticated · admin/manager of the organization · platform admin. Column grant: `review_note` only through the RPCs                                                       | — (RPC `save_training_provider`)                                                              | —                                                                                                                                                                                                                                                                                                                                             | —                                                                                       |
| `training_courses` · `training_editions` · `training_sessions` (LOCAL)      | published (course published + provider reviewed; edition published) → any authenticated · admin/manager of the organization · platform admin. `review_note` / `cancel_reason` only through the RPCs | — (RPCs `save_training_course` / `save_training_edition`)                                     | — (RPCs submit / cancel / `review_training`)                                                                                                                                                                                                                                                                                                  | —                                                                                       |
| `training_favorites` (LOCAL)                                                | own                                                                                                                                                                                                 | — (RPC `toggle_training_favorite`)                                                            | —                                                                                                                                                                                                                                                                                                                                             | — (same RPC)                                                                            |
| `training_requests` · `training_offers` · `training_request_events` (LOCAL) | the professional · admin/manager of the provider organization · platform admin (support; N-6)                                                                                                       | — (RPC `create_training_request`)                                                             | — (RPC `transition_training_request`; offers and events immutable)                                                                                                                                                                                                                                                                            | —                                                                                       |
| `training_messages` (LOCAL)                                                 | the two participants only (the professional, the provider's admin/manager). **Never** platform admins (NEEDS_DECISION N-6 default)                                                                  | — (RPC `send_training_message`)                                                               | — (immutable)                                                                                                                                                                                                                                                                                                                                 | —                                                                                       |

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

**Hiring polish (LOCAL `20261024100000`/`100100`, v2-05/v2-08/v2-20/v2-27).** `list_opportunities` also answers members
of any organization (v2-20 «Ofertas en la red»: the same projection, no eligibility computed, never a commission) and
never returns the caller's own organizations' requirements; a member (any role) applying to its own organization's
requirement is refused (`CFA13`, T-90). The organization-wide «Candidaturas» reads through
`get_organization_applications` (DEFINER, admin/manager of that organization in the body, 42501 otherwise), which
**calls** `get_requirement_applications` for the applicant columns — so the pool rules are not re-implemented — and
filters any other organization's requirement to nothing; `get_requirement_application_counts` (same role check)
returns counts per status per requirement with headcount, period and shift count, no person. No new table grant or
policy.

**Protected assignment days (BR-4.9, LOCAL `20261023300000`).** The owner's availability writes stay "own", but a
write that touches one of the owner's `confirmed` assignments is refused for everybody (`CFV01` → 409
`ASSIGNMENT_PROTECTED`): the DEFINER trigger `protect_assignment_availability()` reads the owner's applications and
their requirement periods (which a professional cannot SELECT), and `app_private.confirmed_assignment_overlaps(from, to)`
(DEFINER, `authenticated` only) answers only about `auth.uid()`'s own confirmed applications — no other person's data
and no oracle beyond what the caller already reads through RLS. No new grant on a table.
**Past-start floor (BR-4.6, N-26, LOCAL `20261024200100`).** Not an authorization change: the INVOKER trigger
`refuse_past_availability_start()` refuses (22023) a Data API write that creates a window, or moves its start, before
today (UTC), for the owner like anyone; grants and policies are unchanged.
**Wallet trash and viewer (N-19/N-21, LOCAL `20261024200000`; `docs/product/DOCUMENT_WALLET.md`).** The owner's
update grant on `professional_documents` gains `archived_at` (the database stamps its own clock); the row policies are
unchanged (own rows only), so archiving, restoring and deleting from the trash stay owner-only, and an archived
document is as private as any other. `document_trash_retention_days()` (DEFINER, `authenticated` only) returns one
number, the retention setting. The trash expiry runs inside `document_maintenance_batch` (platform admin, re-checked
in the body, S-10): the platform admin's sweep deletes expired rows of any owner — the same reach the purge already
had over their objects — and every expiry is audited `document.trash_expired`. The in-app viewer uses the owner's own
60-second signed URL; nobody else gains a path to a file (D-07/D-10 unchanged).
**Organization review and «Empresas verificadas» (OD-5 default = v1.8, LOCAL `20261023500000`…`500300`).** An
organization is `pending` until a platform admin registers its review (`review_organization`: platform role in
the body, never an organization the admin belongs, belonged or acted for (removals audited `organization.member_removed`, `20261023500400`) — «La empresa no puede verificarse a sí misma» —, pending
only, for the version the reviewer saw, fiscal data complete, evidence kept in `organization_reviews`, which
only platform admins read). A professional with visibility `verified_orgs` enters the external pool
(`ranked_external_pool`, hence `get_requirement_candidate_pool` and its summary) **only** for requirements of a
reviewed organization, always pseudonymous; for any other organization it is as invisible as `private`. The
S-7 exception (applying) is unchanged. `get_platform_summary` (DEFINER, platform admin, 42501 otherwise) returns
counts only; the audit view reads `audit_events` under the existing policy.
**Professional block (PKG professional-block, LOCAL `20261024800000`, v2-16, T-160).** The organizations a professional
blocks in the passport (`technician_organization_blocks`, owner-only, written only by `save_professional_passport`) now
bind the professional's own reads and writes too, through one private predicate,
`app_private.technician_blocks_organization(profile, organization)` (STABLE, INVOKER, `search_path = ''`, no execute
for `public`/`anon`/`authenticated`; `app_private` is not exposed): `list_opportunities` never returns a blocked
organization's requirement (so the detail by id is a 404, for professionals and for a member's network view alike),
`get_requirement_profile_rules` leaves its published rules out (an applied-to requirement stays readable), and
`apply_to_requirement` refuses it with `CFA16` `ORGANIZATION_BLOCKED` after the requirement's state and before the
history and the eligibility. Every function keeps its `auth.uid()` + role check and evaluates the block for the
caller only — nobody can ask about another professional's blocks (the helper's profile parameter exists for the pool
bodies, which iterate over candidates; a public function passes `auth.uid()` and nothing else). Applications made
before the block are untouched on both sides (the professional withdraws or accepts as before; the organization
still reads them through `get_requirement_applications`), but the opportunity detail page of such a requirement is a
404 like any other blocked need — the application and its card stay in «Mis candidaturas». The pools, counts,
directory and outreach audience (which already excluded the professional, T-35) are unchanged; the pool bodies
(`ranked_external_pool`, `count_viable_candidates`, `count_visible_network`) keep their inline predicate, each pinned
by its own test (the directory package, `20261024700000`, re-creates `count_visible_network` and adds a copy in
`directory_visible`), until the package that next touches them. Proof: `tests/db/professional-block.test.ts`.

**Shell and «Red visible» (PKG shell-visual, LOCAL `20261024600000`).** `count_visible_network(org)` (DEFINER) answers
admins/managers of that organization only (42501 for members, professionals, other organizations, platform admins
and anon) with one number: the professionals the external pool would let that organization find (BR-8, blocks
included), no identity and no row. The proxy's detail-page check (`src/lib/supabase/detail-gate.ts`, T-147) is UX
only: it repeats, under the caller's JWT, the page's own read (the requirement's organization against the acting
one; `list_opportunities` for an opportunity or a network offer) so a missing or someone else's resource answers a
real 404 before the stream; it grants nothing — the Edge Functions and RLS still decide. The public `/tools`
(T-145) reads no session and no data.
**In-app notices (v2-18, LOCAL `20261023800000`).** Any signed-in account reads only the notices addressed to it.
Who receives one is decided in the database, in the transaction of the event: the other party of each application
event (the applicant when the organization acts; every admin/manager of the requirement's organization, except the
applicant, when the technician acts) and the active applicants when the requirement is paused, resumed or closed —
never the actor, never a plain `member`. Reading re-checks access at read time: an organization recipient must still
be admin/manager of that organization (losing the role also deletes those notices), and sees the applicant under the
pool rules (T-04). The table has no grant to any API role (owner-only policies stay as a second layer): reads go
through `get_my_notifications`, marks through `mark_notifications_read` (own rows, `read_at` only). The event
trigger share-locks the memberships it notifies, so a concurrent demotion waits and then deletes the new notice.
**Candidate Pack copy (v2-15 + v2-04, LOCAL `20261024300000`, BR-25, T-110…T-116).** Applying is the professional's
own act of sharing (S-7 exception) and now also freezes a dated copy of their technical profile in
`application_packs` (AFTER INSERT trigger on `applications`, only when the JWT subject is the applicant). The table has
no grant to any API role (an owner-only select policy is the second layer). `get_application_pack(application)`
(DEFINER) returns it to the applicant or to an admin/manager of the requirement's organization **at reading time**
(null-safe: an application kept after its technician closed the account has no technician, hence no technician
reader); a plain member, another organization, another technician or a platform admin gets the same `P0002` as a
random id. `get_my_application_packs()` returns the caller's own copies (export) and
`get_my_candidate_pack_preview()` the caller's own copy as it would be frozen now (professionals only, 42501
otherwise). The fixed column lists never carry the name, e-mail, phone, employer, blocks, documents or file metadata
(`PACK_ACTIVATION` off); the minimum rate and the restriction texts, owner-only elsewhere (BR-18), are included
because the apply panel previews exactly this content before the consent (T-111). Withdrawal, rejection, cancellation or closing the account
deletes the copies (T-113). Reads are not audited (T-114).
**Account data rights and invitations (PKG account, LOCAL `20261023400000/400100`, T-40…T-44).** Any signed-in user
exports and closes **their own** account only: `account` reads under RLS as the caller and `close_my_account()` takes
no argument that names an account (it is `auth.uid()`); it deletes the Auth user as the function owner — no
privileged key — and the closure rules run in a trigger on `profiles`, so a deletion by an operator (Auth Admin API,
dashboard) follows them too. Only a platform admin creates invitations (`invitations` checks `is_platform_admin()`,
`create_invitation` / `finish_invitation_delivery` re-check it in the body). The UI and the function's response never show an invitation code; a platform admin calling `create_invitation` directly gets the code of the invitation they create (as v1.8's API), and `invitation.sent` is recorded on the function's word (security review L-3).
**Two anon-callable DEFINER functions** (exception to S-10's «revoke from anon», the sign-up page is public):
`invitation_signup_required()` (one boolean) and `invitation_status(code, email)` (a status and an account type for
a code its holder already has; never an address or an id; 244-bit codes). The sign-up trigger is the barrier: with
the flag on, no account is created without a valid code for that address.

**Requirement builder (v2 diff area 30, LOCAL `20261023600000/600100`).** The new `work_requirements` columns
(`country`, `timezone`, `description`, `shifts`, `conditions`) are INSERT-only for `authenticated` (the create RPC is
SECURITY INVOKER under the existing admin/manager insert policy, which already allows `draft`); nobody holds UPDATE on
them — edits go through `update_work_requirement` (DEFINER, admin/manager in the body) — and `archived_at` has no grant
at all: only `archive_work_requirement` (DEFINER, admin/manager of the requirement's organization in the body; missing
and not allowed are the same 42501) writes it, one way. CHECK constraints and the shifts trigger validate every write path, the table owner
included. `count_viable_candidates` (DEFINER) answers admins/managers of the given organization only, with a count of
internal members plus the external pool's candidates (`anonymous`/`open`, `verified_orgs` for a reviewed
organization, never `private` (S-7) nor a professional who blocked it) passing the hard filters — no identities: the same people matching already shows pseudonymously for a saved requirement. Professionals see the new terms
only through the fixed projection of `list_opportunities` and the proposal `terms` (no ids, no `archived_at`).

**Recruiter (PKG recruiter, LOCAL `20261024500000/500100`, D-12 provisional, BR-27, T-130…T-135).** An agency is an
ordinary organization of type `staffing_agency`: its members keep exactly their organization role, there is no
cross-organization or platform role. Its portfolio (`represented_clients`) is read by its members and platform admins
only; nobody writes it directly: admins/managers of the agency add (`pending`) and revoke (final) through DEFINER RPCs
that check the role **and** the organization type in the body (missing and not allowed are the same 42501); only a
platform admin activates one, with evidence kept apart (`represented_client_reviews`, platform admins only), never for
an agency they belong to, belonged to or acted for (the BR-20 rule), audited without the agency's id (T-52). The
requirement's `on_behalf_of_client_id` has no column grant: the create/edit RPC overloads write it and BEFORE triggers
check, for every path, that it is an **active** representation of the requirement's own organization, that an agency
publishes or resumes only with one (CFR01/CFR02), and that it changes only while the requirement is a draft (55000;
the published client is the one the applicant consents to); for a caller who is not admin/manager of that organization the trigger stays silent and RLS gives its usual 42501, so published ids give no oracle on type or clients. While a
representation is not active no application (CFA01 to the applicant, as a paused requirement) and no forward step
(CFR02) is accepted. An organization cannot change its type to or from `staffing_agency` while that would leave
published requirements or live clients outside the rules (`guard_organization_type_clients`, 55000). Professionals and
other organizations learn the client's **name** only, through `list_opportunities` (`client_name`, active
representations only) — never its contact e-mail or id; the consent names agency and client. Another organization's
commission is never shown (OUT).
**v1.8 profile requirements (package matching-v18, LOCAL `20261023900000…200`).** The six new requirement columns
(`category`, `aircraft`, `requires_type_rating`, `engines`, `min_years`, `required_skills`) have no INSERT or UPDATE grant — since P10 (LOCAL `20261027100000`) only the builder RPC overloads write them: the INVOKER create hands them to a BEFORE INSERT trigger through a transaction-local setting (RLS still decides who inserts), the DEFINER edit checks admin/manager, version, applications and closed before its one UPDATE — and are frozen by both guards. Professionals read them
only through `get_requirement_profile_rules(ids)` (DEFINER): professional accounts only (42501), ≤ 200 ids, and only
for requirements they may already see — published and current (D-12) or applied to; any other id is silently
absent, so it is no existence oracle beyond `list_opportunities`. The candidate rows organizations already read
(`get_requirement_candidate_pool`, `get_requirement_applications`, same checks) gain `candidate_declarations`:
the passport-card fields plus, minimised to the requirement (T-85), the engines and capabilities it asks for, the type
ratings of its category on its aircraft (validity and a `restricted` flag — never the restriction text) and the
mobility; never contact, employer, rate, blocks or general-restriction text. `own_candidate_profile` returns the
caller's own declarations in full (INVOKER, own rows). Apply and confirm re-check the rules in a DEFINER trigger on
`applications` (`guard_application_profile_rules`, CFA14 / CFA15); identity and side still come from the RPCs.
**Urgent/AOG outreach and notice preferences (PKG outreach, LOCAL `20261024400000`…`400200`, BR-26).** A
professional's notice preferences (urgent/AOG consents, mobilization, time zone, quiet hours) are **owner-only**
(RLS on `auth.uid()`, no other reader: not their organization, not platform admins); `save_notice_preferences` is
SECURITY INVOKER and writes the caller's row. «Distribuir aviso Urgente / AOG» runs in one DEFINER function,
`requirement_outreach`: the caller must be admin/manager of the requirement's organization (read in the body before the
row is locked; a missing id and another organization's need are the same 42501); the audience is computed inside it —
the organization's external candidate pool (`ranked_external_pool`: never `private`, `verified_orgs` only for a
reviewed organization, never members, never someone who blocked it), the preferences, restrictions, applications,
assignments and `hard_eligibility` — and the organization receives **only the count** (the answer,
`outreach_distributions`, the audit row's `notified`), and no number at all when fewer than 5 professionals of its
external pool are eligible and not its applicants (T-128; the count is taken before the per-person delivery bound); distributions of one organization are serialised and limited to 10 per 24 h. No function returns who was notified or why someone was not.
Each recipient reads their notice through `get_my_notifications` as their own, only while the need is published.

**Candidate directory (PKG directory, LOCAL `20261024700000`, BR-28, T-150…T-158).** «Buscar candidatos» is ONE
DEFINER function, `search_candidate_directory`, and the package is read-only: no RPC takes a pseudonym or writes
(the organization-side block was not ported — v1.8 has none — and is parked under tag
`parked/directory-employer-block` after the security review of 2026-10-23). The caller must be admin/manager of the
organization, read in the body (42501 for a plain member, another organization, a professional, a platform admin
without membership and anon). Whom it may find is the external pool's visibility without a requirement —
`anonymous`/`open`, `verified_orgs` only for a reviewed organization, never a member, never a professional who blocked
it (`app_private.directory_visible`, proven equal to `ranked_external_pool` on randomized profiles; `count_visible_network`
counts the same helper); `private` profiles are never read, counted or resolvable. A row carries a per-**organization**
pseudonym (`CF-` + 10 hex of a salted hash: stable for that organization, different for every other organization and
from every per-requirement ref, not computable from a profile id — T-04 kept, T-151), the name only for `open`, base,
declared years and the passport card minimised as for a requirement that asks for nothing (T-85: no engines,
capabilities or type ratings; never restriction text, contact, employer, rate, blocks, documents or qualifications —
T-153). The filters ask only about what the card shows (category, aircraft, English, years, permit, base) plus an
availability window that starts today or later and spans at most 365 days (BR-4 as a planned need). The database
checks the bounds it can (22023: English level, years, base length, window, limit, offset) and matches category,
aircraft and country as values — an unknown value matches nobody; the Edge Function's schema refuses it with 400
before the call. `total` counts the visible rows of the search. At most 60 searches per organization per minute
(CFD01, T-157); a page is at most 20 rows. The salt, the throttle table and the helpers (`directory_visible`,
`directory_ref`, `directory_throttle`) have no grant for any API role. Proof: `tests/db/directory.test.ts`.

## SECURITY DEFINER functions executable by `authenticated` (Security Advisor, read 2026-10-26)

Production's advisor (`authenticated_security_definer_function_executable`) lists 11 functions. The three trigger-only
ones (`handle_new_user`, `audit_requirement_created`, `audit_qualification_verified`) lose EXECUTE in LOCAL
`20261026100000` (F1b). The other eight **keep it on purpose** (F1c, read from the local schema at 58 migrations; none is
executable by `anon`; `service_role` keeps the platform default and is never used by the app, S-8):

| Function                                                     | Why `authenticated` needs it                                                                                                                 | Check in the body                                                                                                                           | What a direct RPC call can learn                                                                         |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `has_org_role(org, roles)`                                   | Inside 9 RLS policies (evaluated as the caller); the 23 DEFINER functions that call it run as owner and do not depend on the grant           | `profile_id = auth.uid()`                                                                                                                   | Whether **the caller** holds a role in an organization                                                   |
| `is_org_member(org)`                                         | Inside 5 RLS policies; `list_represented_clients`                                                                                            | Wraps `has_org_role` with every role                                                                                                        | Whether the caller is a member                                                                           |
| `is_platform_admin()`                                        | Inside 16 RLS policies (11 DEFINER callers run as owner); Edge Functions `invitations`, `documents-maintenance` (role read from the DB, S-3) | `id = auth.uid()` and `platform_role`                                                                                                       | Whether the caller is a platform admin                                                                   |
| `can_view_member(profile)`                                   | Inside 5 RLS policies (an organization's admins/managers see their members' profile)                                                         | Caller is `admin`/`manager` of an organization where the profile is a member                                                                | For an admin/manager: whether a known profile id is in their own organization (they list members anyway) |
| `get_requirement_candidate_pool(requirement)`                | Edge Functions via `_shared/requirements.ts`; `get_requirement_candidate_passports`                                                          | Requirement's organization: caller `admin`/`manager`, else `42501 not authorized` — the same answer for an unknown id (no existence oracle) | The pool of the caller's own requirement (S-7 minimisation)                                              |
| `get_requirement_external_pool_summary(requirement)`         | Edge Functions via `_shared/requirements.ts`                                                                                                 | Same guard, same single `42501`                                                                                                             | Three counts for the caller's own requirement                                                            |
| `own_qualification_reviews()`                                | Edge Functions `professional-qualifications`, `account` (export)                                                                             | `technician_profile_id = auth.uid()`                                                                                                        | The caller's own review notes                                                                            |
| `review_qualification(id, decision, expected_updated_at, …)` | Edge Function `qualification-reviews` (OD-3)                                                                                                 | Flag `qualification_review` (`0A000`) → `is_platform_admin()` (`42501`) → no self-review → state/version checks; audited                    | Whether the OD-3 flag is on (the flag is checked first — accepted LOW, the flag is not secret)           |

Revoking any of them breaks RLS or the Edge Functions that call them with the caller's JWT. Proof:
`tests/db/rls.test.ts` «F1c» (grants pinned; the helpers answer only about the caller; the pool and the summary give the
same `42501` for an unknown requirement and another organization's), suites B, C and N. Production runs the release-1
bodies (foundation, `20261015130300`, `20261015130400`); the only one the branch re-creates is
`get_requirement_candidate_pool`, with the same guard.

### Training (ADR-003, LOCAL `20261029100000…100400`, flag `training`)

Every training RPC is SECURITY DEFINER with `set search_path = ''`, takes the actor from `auth.uid()` only, reads the
role from the database (`has_org_role` admin/manager for the provider side, `technician_profiles` for the professional,
`is_platform_admin()` for reviews) and refuses with `0A000` while the `training` flag is off. Reviews (`review_training`)
refuse any organization the admin is a member of (S-16 pattern); the review queue never lists them. Requests refuse an
organization the professional belongs to (CFT04). Writes are serialised in the order edition row → request row →
professional advisory lock (`availability:<uuid>`), the same key the employment confirmation takes, so capacity and the
employment ↔ training overlaps are decided under a lock (`scripts/local/db-race-check.sh training`). Reads minimise:
the provider never receives the professional's e-mail or id (N-5), the catalog requires a session (N-4), review notes
reach the owner and admins only. Proof: `tests/db/training.test.ts`.

## Edge Function checklist

Every protected handler, in order:

1. `requireActor(req)` → verifies JWT via `supabase.auth.getClaims()`; 401 `UNAUTHORIZED` otherwise.
2. Create a Supabase client **bound to the caller's token** (RLS applies).
3. Authorize the operation with a DB read (e.g. membership role) → 403 `FORBIDDEN`.
4. Validate payload with a strict Zod schema → 400 `VALIDATION_ERROR`.
5. Execute. RLS is the second line of defense.

Service role: **not used in V0.** Any future use requires: server-side only, explicit
authorization check first, audit event, and a note in `EDGE_FUNCTIONS.md`.
