-- 20261027300000_qualification_review_evidence.sql
-- P12 Admin (F3, 2026-10-27), ADM-03 #10 (v1.8 `Account.jsx` «Evidencia / observaciones de la revisión», required for
-- EVERY review; OD-3 direction «evidence + audit»). Additive, no data change, no grant widened:
--
--   1. `public.qualification_reviews`: the evidence of each qualification decision, kept apart for the platform as
--      `organization_reviews` is (T-52): `note` 1–500, the decision, the version the reviewer looked at. RLS select
--      platform admin only; no write grant (written only by `review_qualification`). The professional never reads it.
--   2. `public.review_qualification` (CREATE OR REPLACE, same signature): the note is REQUIRED for both decisions
--      (22023 «the review needs evidence (1-500 characters)»). It is stored in `qualification_reviews` for every
--      decision and copied to `technician_qualifications.review_note` — the column the owner reads through
--      `own_qualification_reviews()` — only when the decision is `rejected` (BR-2.6: the owner reads the reason, the
--      platform keeps the evidence). Audit unchanged (`qualification.reviewed`, `note_provided` is now always true).
--
-- Rollback (owner, manual): restore the previous function body from 20261015130400 and drop the table.

create table public.qualification_reviews (
  id uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references public.technician_qualifications (id) on delete cascade,
  reviewed_by uuid references public.profiles (id) on delete set null,
  decision public.verification_status not null check (decision in ('verified', 'rejected')),
  note text not null check (char_length(btrim(note)) between 1 and 500),
  -- technician_qualifications.updated_at the reviewer looked at (what exactly was reviewed)
  qualification_version timestamptz not null,
  created_at timestamptz not null default now()
);
comment on table public.qualification_reviews is
  'Evidence of each qualification review (platform admins only; written by review_qualification). P12, T-170.';
alter table public.qualification_reviews enable row level security;
create index qualification_reviews_qualification_created_idx
  on public.qualification_reviews (qualification_id, created_at desc);
revoke all on table public.qualification_reviews from public, anon, authenticated;
grant select on table public.qualification_reviews to authenticated;
create policy qualification_reviews_select_platform_admin on public.qualification_reviews
  for select to authenticated using (public.is_platform_admin());

comment on column public.technician_qualifications.review_note is
  'Reason of a rejection, read by the owner through own_qualification_reviews(). Verification evidence lives in qualification_reviews (platform only, 20261027300000).';

create or replace function public.review_qualification(
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
  -- v1.8: evidence/observations are required for every review (P12, T-170); a rejection's note is its reason.
  if v_note is null then
    raise exception using errcode = '22023', message = 'the review needs evidence (1-500 characters)';
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

  -- The owner reads only the reason of a rejection; the evidence of a verification stays with the platform.
  update public.technician_qualifications q
  set verification_status = p_decision, reviewed_by = v_uid, reviewed_at = now(),
      review_note = case when p_decision = 'rejected' then v_note else null end
  where q.id = p_qualification_id;

  insert into public.qualification_reviews (qualification_id, reviewed_by, decision, note, qualification_version)
  values (v_q.id, v_uid, p_decision, v_note, v_q.updated_at);

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

-- Grants unchanged (authenticated executes; the body checks the platform role); restated for the replaced function.
revoke execute on function
  public.review_qualification(uuid, public.verification_status, timestamptz, text, uuid) from public, anon;
grant execute on function
  public.review_qualification(uuid, public.verification_status, timestamptz, text, uuid) to authenticated;
