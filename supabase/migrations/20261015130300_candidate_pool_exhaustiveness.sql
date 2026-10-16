-- Crew Flex — external candidate pool: eligible candidates are never cut by the cap, and a
-- truncated pool is reported as such (remediation 2026-10-15, finding "candidate pool").
-- NON-DESTRUCTIVE: `create or replace` of get_requirement_candidate_pool with the SAME signature,
-- return type, SECURITY DEFINER, authorization check and output columns (privileges preserved);
-- adds one private helper and one summary RPC. No data change.
--
-- Problem left by 20261015120100: the 100-row cap was applied after ordering by "hard types held
-- active and verified". 100 professionals whose verified ratings expire during the requirement (or
-- who are not available) outrank — and push out — a professional who meets everything. The engine
-- (evaluateMatch) never sees them, and the UI showed "N evaluated" as if the network was exhausted.
--
-- Fix:
--   1. The selection order puts FIRST every candidate who passes the hard filters of BR-3 exactly
--      as src/domain/matching.ts decides them (all hard types active + verified + valid for the whole
--      period by the BR-2 date rule; availability covers 100 % of [starts_at, ends_at) with
--      unavailable overriding available). So if at most 100 candidates are eligible, all of them
--      reach the engine. This is a selection ORDER only: eligibility is still decided by
--      evaluateMatch() — tests/db/rls.test.ts "M." asserts SQL and TypeScript agree.
--   2. get_requirement_external_pool_summary() returns how many external candidates passed the
--      prefilter, how many pass the hard filters and the cap, so the UI states when results are
--      partial instead of presenting them as exhaustive.

create function app_private.ranked_external_pool(p_requirement_id uuid)
returns table (profile_id uuid, hard_eligible boolean, verified_hard integer, active_hard integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with req as (
    select wr.id, wr.organization_id, wr.starts_at, wr.ends_at,
           -- BR-2: valid for the period ⇔ no expiry or expiry on/after the period's last UTC day
           -- (validityForPeriod uses date(endsAt − 1 ms)).
           ((wr.ends_at - interval '1 millisecond') at time zone 'UTC')::date as last_day
    from public.work_requirements wr where wr.id = p_requirement_id
  ),
  required_types as (
    select wrq.qualification_type_id, wrq.requirement_level
    from public.work_requirement_qualifications wrq where wrq.work_requirement_id = p_requirement_id
  ),
  candidates as (
    select tp.profile_id
    from public.technician_profiles tp, req
    where tp.visibility in ('anonymous', 'open')
      and not exists (select 1 from public.organization_members om
                      where om.organization_id = req.organization_id and om.profile_id = tp.profile_id)
      and exists (
        select 1 from public.technician_qualifications tq
        where tq.technician_profile_id = tp.profile_id
          and tq.status = 'active'
          and tq.qualification_type_id in (select qualification_type_id from required_types))
  )
  select
    c.profile_id,
    -- every hard type: active, verified, valid for the whole period
    not exists (
      select 1 from required_types rt
      where rt.requirement_level = 'hard'
        and not exists (
          select 1 from public.technician_qualifications tq
          where tq.technician_profile_id = c.profile_id
            and tq.qualification_type_id = rt.qualification_type_id
            and tq.status = 'active'
            and tq.verification_status = 'verified'
            and (tq.expires_at is null or tq.expires_at >= req.last_day)))
    and coalesce((
      select coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (where aw.status = 'available'),
                      '{}'::tstzmultirange)
           - coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (where aw.status = 'unavailable'),
                      '{}'::tstzmultirange)
      from public.availability_windows aw
      where aw.technician_profile_id = c.profile_id
        and aw.starts_at < req.ends_at and aw.ends_at > req.starts_at
    ) @> tstzrange(req.starts_at, req.ends_at), false),
    (select count(*)::integer from public.technician_qualifications tq
     where tq.technician_profile_id = c.profile_id and tq.status = 'active'
       and tq.verification_status = 'verified'
       and tq.qualification_type_id in (select qualification_type_id from required_types
                                        where requirement_level = 'hard')),
    (select count(*)::integer from public.technician_qualifications tq
     where tq.technician_profile_id = c.profile_id and tq.status = 'active'
       and tq.qualification_type_id in (select qualification_type_id from required_types
                                        where requirement_level = 'hard'))
  from candidates c, req;
$$;

revoke execute on function app_private.ranked_external_pool(uuid) from public, anon, authenticated;

create or replace function public.get_requirement_candidate_pool(p_requirement_id uuid)
returns table (
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_req public.work_requirements%rowtype;
begin
  select * into v_req from public.work_requirements where id = p_requirement_id;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  with required_types as (
    select wrq.qualification_type_id
    from public.work_requirement_qualifications wrq
    where wrq.work_requirement_id = v_req.id
  ),
  org_members as (
    select om.profile_id from public.organization_members om where om.organization_id = v_req.organization_id
  ),
  -- ponytail: internal pool is uncapped (capacity must count everyone); paginate if orgs exceed ~1k technicians.
  internal_pool as (
    select tp.profile_id, 'internal'::text as pool_name
    from public.technician_profiles tp
    where tp.profile_id in (select profile_id from org_members)
  ),
  -- External pool capped at 100 (T9, candidate enumeration). Order before the cap: candidates who
  -- pass every hard filter first, then the strongest near misses (they stay visible so the engine
  -- can explain them), then profile id for stability.
  external_pool as (
    select r.profile_id, 'external'::text as pool_name
    from app_private.ranked_external_pool(v_req.id) r
    order by r.hard_eligible desc, r.verified_hard desc, r.active_hard desc, r.profile_id
    limit 100
  ),
  pool as (
    select * from internal_pool
    union all
    select * from external_pool
  )
  select
    case when p.pool_name = 'internal' then p.profile_id::text
         else 'CF-' || upper(left(encode(sha256(convert_to(v_req.id::text || ':' || p.profile_id::text, 'UTF8')), 'hex'), 10))
    end,
    p.pool_name,
    case when p.pool_name = 'internal' or tp.visibility = 'open' then pr.display_name end,
    tp.base_location,
    tp.years_experience,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'qualificationTypeId', tq.qualification_type_id,
               'code', qt.code,
               'status', tq.status,
               'verificationStatus', tq.verification_status,
               'expiresAt', tq.expires_at
             ) order by qt.code)
      from public.technician_qualifications tq
      join public.qualification_types qt on qt.id = tq.qualification_type_id
      where tq.technician_profile_id = p.profile_id
        and tq.qualification_type_id in (select qualification_type_id from required_types)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', aw.starts_at,
               'endsAt', aw.ends_at,
               'status', aw.status
             ) order by aw.starts_at)
      from public.availability_windows aw
      where aw.technician_profile_id = p.profile_id
        and aw.starts_at < v_req.ends_at
        and aw.ends_at > v_req.starts_at
    ), '[]'::jsonb)
  from pool p
  join public.technician_profiles tp on tp.profile_id = p.profile_id
  join public.profiles pr on pr.id = p.profile_id;
end;
$$;

-- Counts only (no identities): how complete the external evaluation is.
create function public.get_requirement_external_pool_summary(p_requirement_id uuid)
returns table (prefiltered integer, hard_eligible integer, cap integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_req public.work_requirements%rowtype;
begin
  select * into v_req from public.work_requirements where id = p_requirement_id;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select count(*)::integer, (count(*) filter (where r.hard_eligible))::integer, 100
  from app_private.ranked_external_pool(v_req.id) r;
end;
$$;

revoke execute on function public.get_requirement_external_pool_summary(uuid) from public, anon;
grant execute on function public.get_requirement_external_pool_summary(uuid) to authenticated;
