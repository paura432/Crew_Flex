-- Crew Flex — candidate pool selection order (phase 0.8, finding R-11 in
-- docs/integration/crewflex-v13/03-business-rule-conflicts.md).
-- NON-DESTRUCTIVE: `create or replace` with the SAME signature, return type, SECURITY DEFINER,
-- authorization check and output columns; privileges are preserved. No data change.
--
-- Before: the external pool was cut at 100 rows ordered by uuid BEFORE the engine ran, so a fully
-- verified professional could be dropped in favour of soft-only holders with lower uuids.
-- After: the same pool and filters, ordered by hard-qualification strength before the cap.

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
  hard_types as (
    select wrq.qualification_type_id
    from public.work_requirement_qualifications wrq
    where wrq.work_requirement_id = v_req.id and wrq.requirement_level = 'hard'
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
  -- External pool capped at 100, prefiltered by holding any relevant qualification (near misses
  -- stay visible so the engine can explain them). Selection order before the cap: most hard
  -- types held active AND verified, then most hard types held active, then profile id. This only
  -- chooses WHICH rows reach evaluateMatch(); eligibility is decided there, never here.
  external_pool as (
    select tp.profile_id, 'external'::text as pool_name
    from public.technician_profiles tp
    where tp.visibility in ('anonymous', 'open')
      and tp.profile_id not in (select profile_id from org_members)
      and exists (
        select 1 from public.technician_qualifications tq
        where tq.technician_profile_id = tp.profile_id
          and tq.status = 'active'
          and tq.qualification_type_id in (select qualification_type_id from required_types)
      )
    order by
      (select count(*) from public.technician_qualifications tq
       where tq.technician_profile_id = tp.profile_id and tq.status = 'active'
         and tq.verification_status = 'verified'
         and tq.qualification_type_id in (select qualification_type_id from hard_types)) desc,
      (select count(*) from public.technician_qualifications tq
       where tq.technician_profile_id = tp.profile_id and tq.status = 'active'
         and tq.qualification_type_id in (select qualification_type_id from hard_types)) desc,
      tp.profile_id
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
