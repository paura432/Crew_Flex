-- Crew Flex — manual qualification review by a platform admin (remediation 2026-10-15, phase 6;
-- docs/integration/crewflex-v13/08-product-decisions.md D-01 = OD-3).
-- NON-DESTRUCTIVE: three nullable columns, one SECURITY DEFINER RPC, a `create or replace` of the
-- verification-reset trigger function (same signature) that also clears the review metadata.
--
-- APPROVAL CHECKPOINT: OD-3 (who verifies, with which evidence) is still OPEN. The flow FAILS CLOSED
-- in the database itself: review_qualification() refuses to run unless the row
-- `app_private.feature_flags('qualification_review', true)` exists. Only the database owner can write
-- that table (no grant to any API role; schema not exposed by PostgREST), e.g. from the SQL editor:
--   insert into app_private.feature_flags (name, enabled) values ('qualification_review', true);
-- So applying this migration remotely by accident, or calling the RPC directly through PostgREST,
-- cannot verify anything until the owner approves D-01 option (a) and inserts the flag. The Edge
-- Function has its own flag (QUALIFICATION_REVIEW_ENABLED) on top. (A custom GUC was tried first:
-- the Supabase `postgres` role cannot `alter database … set` custom parameters.)
--
-- Rules implemented (the minimum that respects the current policy):
--   * only `profiles.platform_role = 'platform_admin'` may review (never from metadata — the role
--     has no grant and the sign-up trigger always writes 'user');
--   * nobody reviews their own qualification;
--   * organizations cannot review (no grant on verification_status; this RPC refuses them);
--   * transitions: pending → verified | rejected, on ACTIVE rows only; a rejection needs a reason;
--   * the row is locked and its current status AND version (`updated_at` the reviewer saw) are
--     re-checked, so two reviewers cannot both decide and nobody approves dates the professional
--     changed after the queue was loaded (independent review M1);
--   * every decision is audited (`qualification.reviewed`, with the request id for correlation).
--     The note is stored on the row for the professional to read; the audit keeps only whether a
--     note was given (no free text, no documents in the audit trail).
--   * Verification is about the evidence, not about time: an expired-but-verified rating stays
--     verified and the engine still blocks it for periods after its expiry (BR-2).

create table app_private.feature_flags (
  name text primary key check (name ~ '^[a-z_]{3,40}$'),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table app_private.feature_flags enable row level security; -- no policies: API roles see nothing
revoke all on table app_private.feature_flags from public, anon, authenticated;
comment on table app_private.feature_flags is
  'Owner-controlled switches for flows that need an explicit product decision (OD-3: qualification_review).';

alter table public.technician_qualifications
  add column reviewed_by uuid references public.profiles (id) on delete set null,
  add column reviewed_at timestamptz,
  add column review_note text check (char_length(review_note) <= 500);

comment on column public.technician_qualifications.review_note is
  'Reason given by the platform reviewer (required for rejections). Readable only by the owner (own_qualification_reviews) and platform admins. No personal data.';

-- Review metadata is not readable by organizations (independent review M2): the table-level SELECT
-- grant is replaced by a column list without `reviewed_by` and `review_note`. RLS is unchanged. The
-- owner reads the reason through own_qualification_reviews(); platform admins through the RPCs.
revoke select on public.technician_qualifications from authenticated;
grant select (id, technician_profile_id, qualification_type_id, status, issued_at, expires_at,
              verification_status, created_at, updated_at, reviewed_at)
  on public.technician_qualifications to authenticated;

create function public.own_qualification_reviews()
returns table (qualification_id uuid, review_note text, reviewed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.id, q.review_note, q.reviewed_at
  from public.technician_qualifications q
  where q.technician_profile_id = (select auth.uid()) and q.review_note is not null;
$$;
revoke execute on function public.own_qualification_reviews() from public, anon;
grant execute on function public.own_qualification_reviews() to authenticated;

-- Re-dating a reviewed qualification sends it back to review (unchanged rule) and now also clears
-- who reviewed it and why: the old decision no longer applies to the new evidence.
create or replace function public.reset_verification_on_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_status = old.verification_status
     and old.verification_status <> 'pending'
     and (new.qualification_type_id, new.issued_at, new.expires_at)
         is distinct from (old.qualification_type_id, old.issued_at, old.expires_at) then
    new.verification_status := 'pending';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.review_note := null;
  end if;
  return new;
end;
$$;

create function public.review_qualification(
  p_qualification_id uuid,
  p_decision public.verification_status,
  p_expected_updated_at timestamptz,
  p_note text default null,
  p_request_id uuid default null
)
returns table (id uuid, verification_status public.verification_status, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_q public.technician_qualifications%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not exists (select 1 from app_private.feature_flags f
                 where f.name = 'qualification_review' and f.enabled) then
    raise exception using errcode = '0A000', message = 'qualification review is not enabled';
  end if;
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_decision is null or p_decision not in ('verified', 'rejected') then
    raise exception using errcode = '22023', message = 'decision must be verified or rejected';
  end if;
  if p_decision = 'rejected' and v_note is null then
    raise exception using errcode = '22023', message = 'a rejection needs a reason';
  end if;
  if char_length(v_note) > 500 then
    raise exception using errcode = '22023', message = 'note is too long';
  end if;

  select * into v_q from public.technician_qualifications q where q.id = p_qualification_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'qualification not found';
  end if;
  if v_q.technician_profile_id = v_uid then
    raise exception using errcode = '42501', message = 'nobody reviews their own qualification';
  end if;
  if v_q.status <> 'active' or v_q.verification_status <> 'pending' then
    raise exception using errcode = '55000', message = 'qualification is not awaiting review';
  end if;
  if p_expected_updated_at is null
     or date_trunc('milliseconds', v_q.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = '55000', message = 'qualification changed since it was loaded';
  end if;

  update public.technician_qualifications q
  set verification_status = p_decision, reviewed_by = v_uid, reviewed_at = now(), review_note = v_note
  where q.id = p_qualification_id;

  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'qualification.reviewed', 'technician_qualification', v_q.id,
    jsonb_build_object(
      'technician_profile_id', v_q.technician_profile_id,
      'qualification_type_id', v_q.qualification_type_id,
      'previous_verification_status', v_q.verification_status,
      'verification_status', p_decision,
      'note_provided', v_note is not null,
      'request_id', p_request_id));

  return query
  select q.id, q.verification_status, q.reviewed_at
  from public.technician_qualifications q where q.id = p_qualification_id;
end;
$$;

revoke execute on function
  public.review_qualification(uuid, public.verification_status, timestamptz, text, uuid) from public, anon;
grant execute on function
  public.review_qualification(uuid, public.verification_status, timestamptz, text, uuid) to authenticated;
