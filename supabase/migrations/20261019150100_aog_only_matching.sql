-- Crew Flex — `aog_only` windows in the external candidate pool (owner decision C-8 / D-05).
-- NON-DESTRUCTIVE: `create or replace` of app_private.ranked_external_pool with the same signature,
-- return type and privileges; only the availability expression changes. No data change.
--
-- BR-4.8 (precedence when windows overlap): unavailable > aog_only > available.
--   requirement urgency = 'aog' → effective availability = (available ∪ aog_only) − unavailable
--   any other urgency           → effective availability = available − (unavailable ∪ aog_only)
-- AOG is the urgency DECLARED on the requirement; it is never inferred from lead time.
-- tests/db/rls.test.ts "P." asserts this SQL and evaluateMatch() agree.

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

