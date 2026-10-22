-- Crew Flex — blocked organizations leave the external pool; candidates' passport declarations for the
-- organization's candidate cards (package passport: N-08, T-35; MatchCard).
-- NON-DESTRUCTIVE: `create or replace` of app_private.ranked_external_pool with the SAME signature,
-- return type, privileges and expressions as 20261019150100 plus one visibility predicate; one new
-- DEFINER read function. No data change.
--
-- 1. N-08 (v1.8 `server/app.mjs:56`: the directory skips profiles whose `blocked` lists the company): a
--    professional who blocked an organization is not an EXTERNAL candidate of that organization's
--    requirements, so neither get_requirement_candidate_pool nor get_requirement_external_pool_summary
--    (both read this helper) shows or counts them. Eligibility is unchanged: hard_eligible, the
--    ordering and app_private.hard_eligibility keep their expressions (rls suite W still compares them).
--    Not affected, by design (T-35): the INTERNAL pool (membership, OD-4), the opportunities list, and
--    applications — applying is the professional's own act and shows them to that organization (S-7
--    exception), as before.
--
-- 2. get_requirement_candidate_passports(requirement) returns, for exactly the rows of
--    get_requirement_candidate_pool (it calls it, so the same authorization, cap, order and blocks apply
--    and the two can never disagree), the declarations v1.8 shows on a candidate card: main category,
--    categories, aircraft, English, work permits and whether restrictions are declared. Never contact,
--    employer, rate, blocks or the restriction text (D-07, OD-7). Joined by the same reference: the
--    profile id for internal candidates, the per-requirement `CF-…` pseudonym for external ones (T-04).

create or replace function app_private.ranked_external_pool(p_requirement_id uuid)
returns table (profile_id uuid, hard_eligible boolean, verified_hard integer, active_hard integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with req as (
    select wr.id, wr.organization_id, wr.starts_at, wr.ends_at, wr.urgency,
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
      -- N-08 / T-35: the professional blocked this organization.
      and not exists (select 1 from public.technician_organization_blocks b
                      where b.technician_profile_id = tp.profile_id and b.organization_id = req.organization_id)
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
      -- BR-4.8: `aog_only` counts as available only for AOG requirements and blocks otherwise;
      -- `unavailable` overrides both (same rule as src/domain/availability.ts effectiveWindows).
      select coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (
                        where aw.status = 'available'
                           or (aw.status = 'aog_only' and req.urgency = 'aog')),
                      '{}'::tstzmultirange)
           - coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (
                        where aw.status = 'unavailable'
                           or (aw.status = 'aog_only' and req.urgency <> 'aog')),
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

create function public.get_requirement_candidate_passports(p_requirement_id uuid)
returns table (
  candidate_ref text,
  primary_category text,
  categories text[],
  aircraft text[],
  english_level text,
  work_permits text[],
  has_restrictions boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_req public.work_requirements%rowtype;
begin
  -- Same check and error as the pool (no existence oracle); the pool call below re-checks it.
  select * into v_req from public.work_requirements where id = p_requirement_id;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  with pool as (
    select p.candidate_ref from public.get_requirement_candidate_pool(v_req.id) p
  ),
  -- Reference of every professional who can be in the pool: members by profile id; the external
  -- candidates of this requirement (ranked_external_pool: visible, not members, not blocking, holding a
  -- required type — the set the pool's top 100 is taken from) by the pseudonym formula of
  -- get_requirement_candidate_pool. Hashing only that set keeps a 40-bit `CF-` collision from ever
  -- attaching a non-candidate's declarations to a pool reference (security review, info).
  refs as (
    select om.profile_id, om.profile_id::text as ref
    from public.organization_members om
    where om.organization_id = v_req.organization_id
    union all
    select r.profile_id,
           'CF-' || upper(left(encode(sha256(convert_to(v_req.id::text || ':' || r.profile_id::text, 'UTF8')), 'hex'), 10))
    from app_private.ranked_external_pool(v_req.id) r
  )
  select
    pool.candidate_ref,
    tp.primary_category,
    tp.categories,
    tp.aircraft,
    tp.english_level,
    tp.work_permits,
    tp.general_restrictions is not null
      or exists (select 1 from public.technician_type_ratings r
                 where r.technician_profile_id = tp.profile_id and r.restrictions is not null)
  from pool
  join refs on refs.ref = pool.candidate_ref
  join public.technician_profiles tp on tp.profile_id = refs.profile_id;
end;
$$;

revoke execute on function public.get_requirement_candidate_passports(uuid) from public, anon;
grant execute on function public.get_requirement_candidate_passports(uuid) to authenticated;
