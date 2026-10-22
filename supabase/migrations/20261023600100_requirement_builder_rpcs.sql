-- Crew Flex — requirement builder RPCs (v2 diff area 30: v2-09, v2-10, v2-12 terms; v2-14 drafts and archive;
-- v2-13 live count of viable candidates). Technical defaults T-60…T-66 (08-product-decisions.md).
-- NON-DESTRUCTIVE: new overloads of create_work_requirement / create_work_requirement_idempotent /
-- update_work_requirement (the old signatures stay, unchanged, for the functions already deployed), two new RPCs
-- (archive_work_requirement, count_viable_candidates), one private helper (hard_eligibility_for) and a
-- `create or replace` of app_private.hard_eligibility with the same signature and the same rule (it now delegates
-- to the helper, so apply, confirm and the live count share ONE SQL expression; rls suite W keeps proving it
-- agrees with ranked_external_pool and evaluateMatch). No table, column, policy, grant or data is removed.
--
-- Drafts (R-D4 default, T-63): `draft` is created by the create RPC when asked; a draft has the columns every
-- requirement has (title, base, period, headcount) but may lack qualifications (0–20, no hard one needed) — the
-- BR-1.4 deferred trigger already skips drafts. Publishing (create as `open`, edit with p_status = 'open', or the
-- status PATCH draft → open) applies the full rules: 1–20 qualifications with a hard one here and at commit
-- (BR-1.4), the start-in-the-future and the shift/term validations in the shared schema (work-requirements).

-- ---------------------------------------------------------------------------------------------
-- Create (admin/manager under RLS, as the old overload) with the status and the new terms.
-- ---------------------------------------------------------------------------------------------
create function public.create_work_requirement(
  p_organization_id uuid,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb,
  p_status public.requirement_status,
  p_country text,
  p_time_zone text,
  p_description text,
  p_shifts jsonb,
  p_conditions jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_draft boolean := p_status is not distinct from 'draft';
begin
  if p_status is null or p_status not in ('draft', 'open') then
    raise exception using errcode = '22023', message = 'a requirement is created as draft or open';
  end if;
  if jsonb_typeof(p_qualifications) is distinct from 'array'
     or jsonb_array_length(p_qualifications) > 20
     or (not v_draft and jsonb_array_length(p_qualifications) < 1) then
    raise exception using errcode = '22023', message = 'qualifications must contain 1-20 items (0-20 for a draft)';
  end if;
  if not v_draft and not exists (
    select 1 from jsonb_array_elements(p_qualifications) q where q ->> 'requirement_level' = 'hard'
  ) then
    raise exception using errcode = '22023', message = 'at least one hard qualification is required';
  end if;

  insert into public.work_requirements
    (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by,
     country, timezone, description, shifts, conditions)
  values
    (p_organization_id, p_title, p_location, p_starts_at, p_ends_at, p_shift, p_headcount, p_urgency,
     p_status, (select auth.uid()), p_country, p_time_zone, nullif(btrim(coalesce(p_description, '')), ''),
     app_private.normalize_requirement_shifts(p_shifts),
     app_private.normalize_requirement_conditions(p_conditions))
  returning id into v_id;

  insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
  select v_id, (q ->> 'qualification_type_id')::uuid, (q ->> 'requirement_level')::public.requirement_level
  from jsonb_array_elements(p_qualifications) q;

  return v_id;
end;
$$;

-- Idempotent wrapper (I-1): the request identity covers the new arguments in canonical form.
create function public.create_work_requirement_idempotent(
  p_idempotency_key uuid,
  p_organization_id uuid,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb,
  p_status public.requirement_status,
  p_country text,
  p_time_zone text,
  p_description text,
  p_shifts jsonb,
  p_conditions jsonb
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app_private.claim_idempotency_key('work_requirement.create', p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id, 'title', p_title, 'location', p_location,
      'starts_at', p_starts_at at time zone 'UTC', 'ends_at', p_ends_at at time zone 'UTC',
      'shift', p_shift, 'headcount', p_headcount, 'urgency', p_urgency,
      'qualifications', (
        select coalesce(jsonb_agg(q order by q ->> 'qualification_type_id'), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(p_qualifications) = 'array'
                                       then p_qualifications else '[]'::jsonb end) q),
      'status', p_status, 'country', p_country, 'time_zone', p_time_zone,
      'description', nullif(btrim(coalesce(p_description, '')), ''),
      'shifts', app_private.normalize_requirement_shifts(p_shifts),
      'conditions', app_private.normalize_requirement_conditions(p_conditions)));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  v_id := public.create_work_requirement(p_organization_id, p_title, p_location, p_starts_at, p_ends_at,
    p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions);
  perform app_private.complete_idempotency_key('work_requirement.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Edit (M05 rules of 20261022130300 + the new terms + drafts). p_status:
--   NULL   → the full creation rules, the status does not change (the old behaviour);
--   'draft'→ save a draft: the row must be a draft; 0–20 qualifications, no hard one needed;
--   'open' → the full rules; a draft is published (draft → open, audited by guard_requirement_status and checked
--            at commit by BR-1.4); an open one stays open; anything else is 55000.
-- Version (CF412), applications (CFA12), closed (55000), no-op when nothing changes, audit `requirement.updated`
-- with the changed field names only — as before.
-- ---------------------------------------------------------------------------------------------
create function public.update_work_requirement(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb,
  p_status public.requirement_status,
  p_country text,
  p_time_zone text,
  p_description text,
  p_shifts jsonb,
  p_conditions jsonb
)
returns table (id uuid, updated_at timestamptz, changed text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_req public.work_requirements%rowtype;
  v_draft_save boolean := p_status is not distinct from 'draft';
  v_publish boolean;
  v_quals jsonb;
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_shifts jsonb;
  v_conditions jsonb;
  v_changed text[] := '{}';
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_status is not null and p_status not in ('draft', 'open') then
    raise exception using errcode = '22023', message = 'a requirement is saved as draft or open';
  end if;
  if jsonb_typeof(p_qualifications) is distinct from 'array'
     or jsonb_array_length(p_qualifications) > 20
     or (not v_draft_save and jsonb_array_length(p_qualifications) < 1) then
    raise exception using errcode = '22023', message = 'qualifications must contain 1-20 items (0-20 for a draft)';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qualifications) q
    where jsonb_typeof(q) <> 'object'
       or q ->> 'qualification_type_id' is null
       or coalesce(q ->> 'requirement_level', '') not in ('hard', 'soft')
  ) then
    raise exception using errcode = '22023', message = 'invalid qualification item';
  end if;
  if not v_draft_save and not exists (
    select 1 from jsonb_array_elements(p_qualifications) q where q ->> 'requirement_level' = 'hard'
  ) then
    raise exception using errcode = '22023', message = 'at least one hard qualification is required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'qualification_type_id', (q ->> 'qualification_type_id')::uuid,
           'requirement_level', q ->> 'requirement_level'
         ) order by (q ->> 'qualification_type_id')::uuid), '[]'::jsonb)
  into v_quals
  from jsonb_array_elements(p_qualifications) q;
  if (select count(distinct q ->> 'qualification_type_id') from jsonb_array_elements(v_quals) q)
     <> jsonb_array_length(v_quals) then
    raise exception using errcode = '22023', message = 'qualifications must be distinct';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'the version the client loaded is required';
  end if;
  v_shifts := app_private.normalize_requirement_shifts(p_shifts);
  v_conditions := app_private.normalize_requirement_conditions(p_conditions);

  -- The role first, then the lock (security review LOW-1): a stranger who knows a published id never locks the
  -- row. organization_id never changes, so the check stays true once locked.
  if not public.has_org_role(
       (select wr.organization_id from public.work_requirements wr where wr.id = p_id),
       array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_req from public.work_requirements wr where wr.id = p_id for update;
  if not found then -- deleted meanwhile (organization deletion cascade)
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if v_req.status = 'closed' then
    raise exception 'a closed requirement cannot be changed' using errcode = '55000';
  end if;
  if v_draft_save and v_req.status <> 'draft' then
    raise exception 'only a draft is saved as a draft' using errcode = '55000';
  end if;
  if p_status = 'open' and v_req.status not in ('draft', 'open') then
    raise exception 'requirement status % → open is not an edit', v_req.status using errcode = '55000';
  end if;
  v_publish := p_status = 'open' and v_req.status = 'draft';

  if p_title is distinct from v_req.title then v_changed := v_changed || 'title'::text; end if;
  if p_location is distinct from v_req.location then v_changed := v_changed || 'location'::text; end if;
  if date_trunc('milliseconds', p_starts_at) is distinct from date_trunc('milliseconds', v_req.starts_at) then
    v_changed := v_changed || 'startsAt'::text;
  end if;
  if date_trunc('milliseconds', p_ends_at) is distinct from date_trunc('milliseconds', v_req.ends_at) then
    v_changed := v_changed || 'endsAt'::text;
  end if;
  if p_shift is distinct from v_req.shift then v_changed := v_changed || 'shift'::text; end if;
  if p_headcount is distinct from v_req.headcount then v_changed := v_changed || 'headcount'::text; end if;
  if p_urgency is distinct from v_req.urgency then v_changed := v_changed || 'urgency'::text; end if;
  if v_quals is distinct from coalesce((
    select jsonb_agg(jsonb_build_object(
             'qualification_type_id', wrq.qualification_type_id,
             'requirement_level', wrq.requirement_level
           ) order by wrq.qualification_type_id)
    from public.work_requirement_qualifications wrq where wrq.work_requirement_id = p_id
  ), '[]'::jsonb) then
    v_changed := v_changed || 'qualifications'::text;
  end if;
  if p_country is distinct from v_req.country then v_changed := v_changed || 'country'::text; end if;
  if p_time_zone is distinct from v_req.timezone then v_changed := v_changed || 'timeZone'::text; end if;
  if v_description is distinct from v_req.description then v_changed := v_changed || 'description'::text; end if;
  if v_shifts is distinct from v_req.shifts then v_changed := v_changed || 'shifts'::text; end if;
  if v_conditions is distinct from v_req.conditions then v_changed := v_changed || 'conditions'::text; end if;

  if cardinality(v_changed) = 0 and not v_publish then
    return query select v_req.id, v_req.updated_at, v_changed;
    return;
  end if;
  if cardinality(v_changed) > 0
     and exists (select 1 from public.applications a where a.requirement_id = p_id) then
    raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
  end if;
  if date_trunc('milliseconds', v_req.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'requirement was modified by another session';
  end if;

  update public.work_requirements wr
  set title = p_title, location = p_location,
      starts_at = case when 'startsAt' = any (v_changed) then p_starts_at else wr.starts_at end,
      ends_at = case when 'endsAt' = any (v_changed) then p_ends_at else wr.ends_at end,
      shift = p_shift, headcount = p_headcount, urgency = p_urgency,
      country = p_country, timezone = p_time_zone, description = v_description,
      shifts = v_shifts, conditions = v_conditions,
      status = case when v_publish then 'open'::public.requirement_status else wr.status end
  where wr.id = p_id;

  if 'qualifications' = any (v_changed) then
    delete from public.work_requirement_qualifications wrq
    where wrq.work_requirement_id = p_id
      and wrq.qualification_type_id not in (
        select (q ->> 'qualification_type_id')::uuid from jsonb_array_elements(v_quals) q);
    insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
    select p_id, (q ->> 'qualification_type_id')::uuid, (q ->> 'requirement_level')::public.requirement_level
    from jsonb_array_elements(v_quals) q
    on conflict (work_requirement_id, qualification_type_id)
      do update set requirement_level = excluded.requirement_level;
  end if;

  if cardinality(v_changed) > 0 then
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (v_uid, v_req.organization_id, 'requirement.updated', 'work_requirement', p_id,
            jsonb_build_object('fields', to_jsonb(v_changed)));
  end if;

  return query select wr.id, wr.updated_at, v_changed from public.work_requirements wr where wr.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Archive (v1.8 «Archivar», one way; T-64): admin/manager of the requirement's organization. A closed requirement
-- is flagged; a draft is closed and flagged in the same step (an archived requirement is always closed, so it is
-- never published again). Anything else must be closed first (409; closing keeps its own rule, T-12). Archiving
-- twice is a no-op. Missing and not allowed are the same 42501 (no oracle on published ids). Audited
-- `requirement.archived {from}` (+ `requirement.status_changed` for a draft, by guard_requirement_status).
-- ---------------------------------------------------------------------------------------------
create function public.archive_work_requirement(p_id uuid)
returns table (id uuid, status public.requirement_status, archived_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_req public.work_requirements%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- The role first, then the lock (security review LOW-1): a stranger who knows a published id never locks the
  -- row. organization_id never changes, so the check stays true once locked.
  if not public.has_org_role(
       (select wr.organization_id from public.work_requirements wr where wr.id = p_id),
       array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_req from public.work_requirements wr where wr.id = p_id for update;
  if not found then -- deleted meanwhile (organization deletion cascade)
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if v_req.archived_at is not null then
    return query select v_req.id, v_req.status, v_req.archived_at;
    return;
  end if;
  if v_req.status not in ('closed', 'draft') then
    raise exception 'close the requirement before archiving it' using errcode = '55000';
  end if;

  update public.work_requirements wr
  set status = 'closed', archived_at = now()
  where wr.id = p_id;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_req.organization_id, 'requirement.archived', 'work_requirement', p_id,
          jsonb_build_object('from', v_req.status));

  return query select wr.id, wr.status, wr.archived_at from public.work_requirements wr where wr.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- One hard-eligibility rule (BR-2/BR-3/BR-4.8) on explicit parameters, so a requirement that is not saved yet
-- (the builder's live count, v2-13) is judged by the same SQL as apply and confirm. Body = the expressions of
-- app_private.hard_eligibility in 20261022130300, with the requirement's columns as arguments.
-- ---------------------------------------------------------------------------------------------
create function app_private.hard_eligibility_for(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_urgency public.requirement_urgency,
  p_hard_type_ids uuid[],
  p_profile_id uuid
)
returns table (qualifications_ok boolean, availability_ok boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with req as (
    -- BR-2: valid for the period ⇔ no expiry or expiry on/after the period's last UTC day
    select ((p_ends_at - interval '1 millisecond') at time zone 'UTC')::date as last_day
  )
  select
    -- every hard type: active, verified, valid for the whole period
    not exists (
      select 1 from unnest(coalesce(p_hard_type_ids, '{}'::uuid[])) as rt(type_id)
      where not exists (
        select 1 from public.technician_qualifications tq
        where tq.technician_profile_id = p_profile_id
          and tq.qualification_type_id = rt.type_id
          and tq.status = 'active'
          and tq.verification_status = 'verified'
          and (tq.expires_at is null or tq.expires_at >= req.last_day))),
    -- BR-4 / BR-4.8: (available ∪ aog_only if AOG) − (unavailable ∪ aog_only if not AOG) covers 100 %
    coalesce((
      select coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (
                        where aw.status = 'available'
                           or (aw.status = 'aog_only' and p_urgency = 'aog')),
                      '{}'::tstzmultirange)
           - coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (
                        where aw.status = 'unavailable'
                           or (aw.status = 'aog_only' and p_urgency <> 'aog')),
                      '{}'::tstzmultirange)
      from public.availability_windows aw
      where aw.technician_profile_id = p_profile_id
        and aw.starts_at < p_ends_at and aw.ends_at > p_starts_at
    ) @> tstzrange(p_starts_at, p_ends_at), false)
  from req;
$$;

create or replace function app_private.hard_eligibility(p_requirement_id uuid, p_profile_id uuid)
returns table (qualifications_ok boolean, availability_ok boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.qualifications_ok, e.availability_ok
  from public.work_requirements wr
  cross join lateral app_private.hard_eligibility_for(
    wr.starts_at, wr.ends_at, wr.urgency,
    array(select rt.qualification_type_id from public.work_requirement_qualifications rt
          where rt.work_requirement_id = wr.id and rt.requirement_level = 'hard'),
    p_profile_id) as e
  where wr.id = p_requirement_id;
$$;

-- «{n} candidatos con requisitos y bloques viables» (v1.8 Company2.jsx:112,125; T-66) for the builder's period,
-- urgency and hard qualifications, saved or not: internal members of the organization (any visibility, BR-7
-- internal pool) plus the external candidates app_private.ranked_external_pool admits — `anonymous`/`open`, or
-- `verified_orgs` when the organization's review is registered (BR-8, 20261023500200), never `private` (S-7), never
-- one who blocked this organization (N-08, 20261023100300) — who pass the hard filters. The same candidate predicate
-- as that pool (PGlite suite requirement-builder compares both on a saved requirement). A COUNT only — no ids, names
-- or data (what matching already shows pseudonymously for a saved requirement). Admin/manager of the organization
-- only; anything else 42501.
create function public.count_viable_candidates(
  p_organization_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_urgency public.requirement_urgency,
  p_hard_type_ids uuid[]
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null
     or not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- Only a period that has not started (the builder's own rule, 15 min grace): past periods would only serve to
  -- probe people's history (security review LOW-2).
  if p_starts_at is null or p_ends_at is null or p_urgency is null
     or p_starts_at < now() - interval '15 minutes'
     or p_ends_at <= p_starts_at or p_ends_at > p_starts_at + interval '366 days'
     or coalesce(cardinality(p_hard_type_ids), 0) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'invalid period or qualifications';
  end if;

  select count(*)::integer into v_count
  from public.technician_profiles tp
  left join public.organization_members m
    on m.organization_id = p_organization_id and m.profile_id = tp.profile_id
  cross join lateral app_private.hard_eligibility_for(
    p_starts_at, p_ends_at, p_urgency, p_hard_type_ids, tp.profile_id) as e
  where (m.profile_id is not null
         or ((tp.visibility in ('anonymous', 'open')
              or (tp.visibility = 'verified_orgs'
                  and exists (select 1 from public.organizations o
                              where o.id = p_organization_id and o.review_status = 'reviewed')))
             and not exists (select 1 from public.technician_organization_blocks b
                             where b.technician_profile_id = tp.profile_id
                               and b.organization_id = p_organization_id)))
    -- cheap prefilter: holds the first hard type, active and verified
    and exists (
      select 1 from public.technician_qualifications tq
      where tq.technician_profile_id = tp.profile_id
        and tq.qualification_type_id = p_hard_type_ids[1]
        and tq.status = 'active' and tq.verification_status = 'verified')
    and e.qualifications_ok and e.availability_ok;
  return v_count;
end;
$$;

revoke execute on function app_private.hard_eligibility_for(
  timestamptz, timestamptz, public.requirement_urgency, uuid[], uuid) from public, anon, authenticated;

revoke execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer,
    public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb),
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb),
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb),
  public.archive_work_requirement(uuid),
  public.count_viable_candidates(uuid, timestamptz, timestamptz, public.requirement_urgency, uuid[])
from public, anon;
grant execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer,
    public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb),
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb),
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb),
  public.archive_work_requirement(uuid),
  public.count_viable_candidates(uuid, timestamptz, timestamptz, public.requirement_urgency, uuid[])
to authenticated;
