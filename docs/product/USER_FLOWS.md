# User Flows

## UF-1 Sign up (IMPLEMENTED)

1. `/register` → choose **Professional** or **Organization**.
2. Professional: display name, email, password.
   Organization: + organization name, type, country.
3. Supabase Auth `signUp`. Trigger `handle_new_user` creates `profiles` and either
   `technician_profiles` or `organizations` + `organization_members(role=admin)`.
4. If the project requires email confirmation → "Check your inbox" state. Otherwise → `/app`.

## UF-2 Sign in / out (IMPLEMENTED)

`/login` → email + password → `/app` → redirected to `/app/organization` or `/app/professional`
by `account_type`. States: loading, invalid credentials, network error, success.
Sign out from the app shell.

## UF-3 Organization: create requirement → capacity → matches (IMPLEMENTED — first milestone)

1. Admin/manager opens `/app/organization` (dashboard). The **Technical Capacity** panel shows the
   next open requirement: Required · Internally eligible · Gap · Coverage + required
   qualifications.
2. `/app/organization/requirements/new`: title, location, start/end, shift, headcount, urgency,
   qualifications (each hard/soft). Client + server validation (Zod).
3. Submit → server action → Edge Function `work-requirements` (POST) → validation → authorization
   (JWT actor, org role from DB) → RPC `create_work_requirement` under RLS → audit
   `requirement.created` → typed response.
4. Redirect to `/app/organization/requirements/[id]`: requirement facts + capacity
   (Edge Function `capacity-evaluate`) + internal workforce explanation.
5. **View eligible external professionals** → `/app/organization/requirements/[id]/matches`
   (Edge Function `matching-evaluate`): eligible first, each with ✓/✗ per qualification,
   availability coverage, location; not eligible with explicit blockers.

## UF-4 Organization: workforce (IMPLEMENTED, read-only)

`/app/organization/workforce`: members of the organization with role and, for technicians, their
qualifications and verification status.

## UF-5 Professional (IMPLEMENTED, local)

`/app/professional` overview (passport completeness + next step), `/profile` (edit name, base, years,
status, mobility, visibility → `professional-profile`), `/qualifications` (declare / edit dates /
withdraw / remove → `professional-qualifications`; review state read-only), `/availability`
(`professional-availability`). Every write goes through an Edge Function with the JWT subject as
owner; the page re-reads after save, so a reload shows the persisted state.

Overview month (v1.8 «Mi espacio», LOCAL 2026-10-22): «Asignado» on the days of a confirmed assignment, a red dot on
days with opportunities (compatible, or «Posible en descanso» on rest days, BR-14.1); pressing a day filters
«Oportunidades para ti» to it («Oportunidades · {día}», «Quitar selección de fecha»); past days are disabled. In
`/availability` the days of a confirmed assignment are disabled and protected on the server too (BR-4.9).

## UF-6 Candidate Pack / application / coverage (PLANNED)

From a match, the organization requests interest; the professional consents and shares a
Candidate Pack scoped to that requirement; confirmed assignments cover headcount.

## UF-7 Language (IMPLEMENTED, local)

Any signed-in user opens `/app/settings` → Language / Idioma → picks Español or English. The choice is
saved on their profile through `user-preferences` and in the locale cookie; the current page re-renders
in place (no reload, no sign-out, form state kept). It persists after reload and after signing out and
back in, on any device. Before sign-in the public pages offer the same ES | EN switch (cookie only), and
the browser language decides when nothing is stored (`docs/product/I18N_STRATEGY.md` §3).

## UF-8 Platform admin: qualification review (IMPLEMENTED, local only — activation needs OD-3)

1. A platform admin (`profiles.platform_role = platform_admin`; the nav entry is shown only to them) opens
   `/app/admin/verifications`: pending, active qualifications of other people, with the version loaded.
2. Verify, or reject with a mandatory reason (≤ 500 chars). Never their own qualification.
3. `qualification-reviews` → `review_qualification` locks the row and re-checks status and version; a stale
   version or a concurrent decision returns a conflict and nothing is written. Audited `qualification.reviewed`.
4. The professional sees the new status and, for a rejection, the reason; matching treats a verified hard
   qualification as valid (BR-3).
5. Fails closed unless the owner-only DB flag and the function secret are both on (`20261015130400`).
