-- Crew Flex — the v1.8 profile requirements in the SQL mirror of the matching engine (package matching-v18;
-- BR-3.7–3.13, T-80…T-86). The verdict is still src/domain/matching.ts `evaluateMatch`; this SQL only has to
-- agree with it (apply/confirm re-checks, the external pool's eligible-first order and counts).
-- NON-DESTRUCTIVE: two private helpers; `create or replace` of app_private.ranked_external_pool (same
-- signature, return type and privileges, body of 20261023500200 with ONE predicate added); drop + create of
-- app_private.hard_eligibility_for and count_viable_candidates (new trailing parameters WITH defaults, so every
-- existing call keeps working) and of app_private.hard_eligibility, get_requirement_candidate_pool,
-- own_candidate_profile and get_requirement_applications, whose return types grow by one column (PostgreSQL only
-- allows either through drop + create; same bodies otherwise, same grants re-applied in this transaction; no
-- data); one new DEFINER read RPC. No table, column, policy or data is removed.
--
-- 1. app_private.profile_rules_ok(profile, rules…, last_day) — THE SQL expression of BR-3.7–3.13, on explicit
--    rule values. Reads the professional's declarations (technician_profiles, technician_type_ratings; BR-18).
--    NULL / empty = not required, so a requirement stating none is unaffected.
-- 2. app_private.hard_eligibility_for (the builder's explicit-parameter rule, 20261023600100) takes the rules
--    and returns `profile_ok` too; app_private.hard_eligibility stays its thin wrapper (the requirement's
--    columns, the builder's `country` included); count_viable_candidates (the builder's live count) passes the
--    rules it is given and counts only who passes all three. The applications trigger of the next migration
--    reads hard_eligibility().profile_ok at apply and confirm; the assignment protection keeps reading
--    availability_ok.
-- 3. app_private.ranked_external_pool: `hard_eligible` = qualifications ∧ availability ∧ profile rules, so the
--    eligible-first order (BR-7) and get_requirement_external_pool_summary keep meaning «passes every hard
--    filter of BR-3». It keeps BOTH predicates of its latest body (20261023500200): the passport block (N-08,
--    T-35) and «Empresas verificadas» (BR-8, T-50).
-- 4. The candidate row (pool, own profile, applications) gains `candidate_declarations` jsonb from ONE helper
--    (app_private.candidate_declarations), read by the shared parser (src/lib/candidate-pool.ts). For an
--    organization it carries only what the requirement's verdict can use beyond what the passport card
--    already shows (main category, categories, aircraft, English, work permits, «restrictions declared»):
--    the engines and capabilities the requirement asks for, the type ratings of its category on its aircraft
--    (aircraft, category, validity, whether restricted — never the text) and the mobility (BR-5.6). The own
--    profile carries everything (it is the professional's own data).
-- 5. get_requirement_profile_rules(ids) — the requirement-side rules for professionals: requirements they may
--    read (published and current, D-12) or applied to. Organizations read the columns under RLS.

-- ---------------------------------------------------------------------------------------------
-- 1. The profile rules (BR-3.7–3.13). Order of the v1.8 connected `eligible` (server/rules.mjs:27).
-- ---------------------------------------------------------------------------------------------
create function app_private.profile_rules_ok(
  p_profile_id uuid,
  p_country text,
  p_category text,
  p_aircraft text[],
  p_requires_type_rating boolean,
  p_engines text[],
  p_min_years integer,
  p_required_skills text[],
  p_last_day date
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select
      -- BR-3.7 work permit for the job country
      (p_country is null or p_country = any (tp.work_permits))
      -- BR-3.8 category among the declared ones
      and (p_category is null or p_category = any (tp.categories))
      -- BR-3.9 one of the accepted aircraft declared
      and (coalesce(cardinality(p_aircraft), 0) = 0 or tp.aircraft && p_aircraft)
      -- BR-3.10 a declared rating of the category on an accepted aircraft, valid through the period's last
      -- UTC day (BR-2, endsAt − 1 ms) and without restrictions (C-10 default)
      and (not coalesce(p_requires_type_rating, false) or exists (
            select 1 from public.technician_type_ratings r
            where r.technician_profile_id = tp.profile_id
              and r.category = p_category
              and r.aircraft = any (p_aircraft)
              and (r.expires_at is null or r.expires_at >= p_last_day)
              and r.restrictions is null))
      -- BR-3.11 one of the engines declared
      and (coalesce(cardinality(p_engines), 0) = 0 or tp.engines && p_engines)
      -- BR-3.12 minimum years; an undeclared experience counts as 0
      and (p_min_years is null or coalesce(tp.years_experience, 0) >= p_min_years)
      -- BR-3.13 every required capability declared
      and coalesce(p_required_skills, '{}'::text[]) <@ tp.skills
    from public.technician_profiles tp
    where tp.profile_id = p_profile_id
  ), false);
$$;

-- The declarations matching reads, as the camelCase JSON of `CandidateDeclarations` (src/domain/matching.ts).
-- p_requirement_id NULL = the own profile (everything); otherwise only what that requirement can use (see 4).
create function app_private.candidate_declarations(p_profile_id uuid, p_requirement_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'primaryCategory', tp.primary_category,
    'categories', to_jsonb(tp.categories),
    'aircraft', to_jsonb(tp.aircraft),
    'engines', to_jsonb(case when p_requirement_id is null then tp.engines
                             else array(select e from unnest(tp.engines) e
                                        where e = any (coalesce(wr.engines, '{}'::text[]))) end),
    'skills', to_jsonb(case when p_requirement_id is null then tp.skills
                            else array(select s from unnest(tp.skills) s
                                       where s = any (coalesce(wr.required_skills, '{}'::text[]))) end),
    'englishLevel', tp.english_level,
    'mobility', tp.mobility,
    'workPermits', to_jsonb(tp.work_permits),
    'typeRatings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'aircraft', r.aircraft,
               'category', r.category,
               'expiresAt', r.expires_at,
               'restricted', r.restrictions is not null
             ) order by r.aircraft, r.category)
      from public.technician_type_ratings r
      where r.technician_profile_id = tp.profile_id
        and (p_requirement_id is null
             or (coalesce(wr.requires_type_rating, false)
                 and r.category = wr.category and r.aircraft = any (wr.aircraft)))
    ), '[]'::jsonb),
    -- Same expression as get_requirement_candidate_passports (20261023100300).
    'hasRestrictions', tp.general_restrictions is not null
      or exists (select 1 from public.technician_type_ratings r
                 where r.technician_profile_id = tp.profile_id and r.restrictions is not null)
  )
  from public.technician_profiles tp
  left join public.work_requirements wr on wr.id = p_requirement_id
  where tp.profile_id = p_profile_id;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. One hard-eligibility rule (apply, confirm, assignment protection, the builder's live count): the body of
--    app_private.hard_eligibility_for in 20261023600100 plus the profile rules as trailing parameters with
--    «not required» defaults and a `profile_ok` column. hard_eligibility stays the thin wrapper over a saved
--    requirement. rls suite W, tests/db/requirement-builder.test.ts and tests/db/matching-v18.test.ts prove it
--    agrees with ranked_external_pool.hard_eligible, count_viable_candidates and evaluateMatch().eligible.
-- ---------------------------------------------------------------------------------------------
drop function app_private.hard_eligibility(uuid, uuid);
drop function app_private.hard_eligibility_for(timestamptz, timestamptz, public.requirement_urgency, uuid[], uuid);
create function app_private.hard_eligibility_for(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_urgency public.requirement_urgency,
  p_hard_type_ids uuid[],
  p_profile_id uuid,
  p_country text default null,
  p_category text default null,
  p_aircraft text[] default '{}',
  p_requires_type_rating boolean default false,
  p_engines text[] default '{}',
  p_min_years integer default null,
  p_required_skills text[] default '{}'
)
returns table (qualifications_ok boolean, availability_ok boolean, profile_ok boolean)
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
    ) @> tstzrange(p_starts_at, p_ends_at), false),
    -- BR-3.7–3.13 (matching-v18)
    app_private.profile_rules_ok(p_profile_id, p_country, p_category, p_aircraft, p_requires_type_rating,
      p_engines, p_min_years, p_required_skills, req.last_day)
  from req;
$$;

create function app_private.hard_eligibility(p_requirement_id uuid, p_profile_id uuid)
returns table (qualifications_ok boolean, availability_ok boolean, profile_ok boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.qualifications_ok, e.availability_ok, e.profile_ok
  from public.work_requirements wr
  cross join lateral app_private.hard_eligibility_for(
    wr.starts_at, wr.ends_at, wr.urgency,
    array(select rt.qualification_type_id from public.work_requirement_qualifications rt
          where rt.work_requirement_id = wr.id and rt.requirement_level = 'hard'),
    p_profile_id,
    wr.country, wr.category, wr.aircraft, wr.requires_type_rating, wr.engines, wr.min_years,
    wr.required_skills) as e
  where wr.id = p_requirement_id;
$$;

-- The builder's live count (body of 20261023600100) with the profile rules: the form sends the job's country;
-- the other rules default to «not required» until the form offers them. Same checks and errors as before.
drop function public.count_viable_candidates(uuid, timestamptz, timestamptz, public.requirement_urgency, uuid[]);
create function public.count_viable_candidates(
  p_organization_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_urgency public.requirement_urgency,
  p_hard_type_ids uuid[],
  p_country text default null,
  p_category text default null,
  p_aircraft text[] default '{}',
  p_requires_type_rating boolean default false,
  p_engines text[] default '{}',
  p_min_years integer default null,
  p_required_skills text[] default '{}'
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
    p_starts_at, p_ends_at, p_urgency, p_hard_type_ids, tp.profile_id,
    p_country, p_category, p_aircraft, p_requires_type_rating, p_engines, p_min_years,
    p_required_skills) as e
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
    and e.qualifications_ok and e.availability_ok and e.profile_ok;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. External pool prefilter: body of 20261023500200, `hard_eligible` also requires the profile rules.
-- ---------------------------------------------------------------------------------------------
create or replace function app_private.ranked_external_pool(p_requirement_id uuid)
returns table (profile_id uuid, hard_eligible boolean, verified_hard integer, active_hard integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with req as (
    select wr.id, wr.organization_id, wr.starts_at, wr.ends_at, wr.urgency,
           wr.country, wr.category, wr.aircraft, wr.requires_type_rating, wr.engines, wr.min_years,
           wr.required_skills,
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
    where (tp.visibility in ('anonymous', 'open')
           -- BR-8 «Empresas verificadas»: only for an organization with a registered review
           or (tp.visibility = 'verified_orgs'
               and exists (select 1 from public.organizations o
                           where o.id = req.organization_id and o.review_status = 'reviewed')))
      and not exists (select 1 from public.organization_members om
                      where om.organization_id = req.organization_id and om.profile_id = tp.profile_id)
      -- N-08 / T-35 (passport package, 20261023100300): the professional blocked this organization.
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
    ) @> tstzrange(req.starts_at, req.ends_at), false)
    -- BR-3.7–3.13 (matching-v18)
    and app_private.profile_rules_ok(c.profile_id, req.country, req.category, req.aircraft,
      req.requires_type_rating, req.engines, req.min_years, req.required_skills, req.last_day),
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

-- ---------------------------------------------------------------------------------------------
-- 4a. Candidate pool (body of 20261015130300) + candidate_declarations.
-- ---------------------------------------------------------------------------------------------
drop function public.get_requirement_candidate_pool(uuid);
create function public.get_requirement_candidate_pool(p_requirement_id uuid)
returns table (
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb,
  candidate_declarations jsonb
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
    ), '[]'::jsonb),
    app_private.candidate_declarations(p.profile_id, v_req.id)
  from pool p
  join public.technician_profiles tp on tp.profile_id = p.profile_id
  join public.profiles pr on pr.id = p.profile_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4b. Own matchable data (body of 20261022130200) + candidate_declarations (everything: own data).
-- ---------------------------------------------------------------------------------------------
drop function public.own_candidate_profile(timestamptz, timestamptz);
create function public.own_candidate_profile(p_from timestamptz default null, p_to timestamptz default null)
returns table (
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb,
  candidate_declarations jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    tp.profile_id::text,
    'internal'::text, -- own profile: named, like an internal candidate
    pr.display_name,
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
      where tq.technician_profile_id = tp.profile_id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', aw.starts_at,
               'endsAt', aw.ends_at,
               'status', aw.status
             ) order by aw.starts_at)
      from public.availability_windows aw
      where aw.technician_profile_id = tp.profile_id
        and (p_to is null or aw.starts_at < p_to)
        and (p_from is null or aw.ends_at > p_from)
    ), '[]'::jsonb),
    app_private.candidate_declarations(tp.profile_id, null)
  from public.technician_profiles tp
  join public.profiles pr on pr.id = tp.profile_id
  where tp.profile_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------------------------
-- 4c. The organization's view of one requirement's applications (body of 20261022130300) +
--     candidate_declarations of each applicant for that requirement.
-- ---------------------------------------------------------------------------------------------
drop function public.get_requirement_applications(uuid);
create function public.get_requirement_applications(p_requirement_id uuid)
returns table (
  application_id uuid,
  status public.application_status,
  created_at timestamptz,
  updated_at timestamptz,
  reason text,
  current_proposal jsonb,
  accepted_proposal_id uuid,
  history jsonb,
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb,
  candidate_declarations jsonb
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
  select * into v_req from public.work_requirements wr where wr.id = p_requirement_id;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  select
    a.id, a.status, a.created_at, a.updated_at, a.reason,
    app_private.proposal_json(a.current_proposal_id), a.accepted_proposal_id,
    app_private.application_history(a.id),
    case when m.profile_id is not null then a.technician_profile_id::text
         else 'CF-' || upper(left(encode(sha256(convert_to(
                v_req.id::text || ':' || a.technician_profile_id::text, 'UTF8')), 'hex'), 10))
    end,
    case when m.profile_id is not null then 'internal' else 'external' end,
    case when m.profile_id is not null or tp.visibility = 'open' then pr.display_name end,
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
      where tq.technician_profile_id = a.technician_profile_id
        and tq.qualification_type_id in (
          select wrq.qualification_type_id from public.work_requirement_qualifications wrq
          where wrq.work_requirement_id = v_req.id)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', aw.starts_at,
               'endsAt', aw.ends_at,
               'status', aw.status
             ) order by aw.starts_at)
      from public.availability_windows aw
      where aw.technician_profile_id = a.technician_profile_id
        and aw.starts_at < v_req.ends_at
        and aw.ends_at > v_req.starts_at
    ), '[]'::jsonb),
    app_private.candidate_declarations(a.technician_profile_id, v_req.id)
  from public.applications a
  join public.technician_profiles tp on tp.profile_id = a.technician_profile_id
  join public.profiles pr on pr.id = a.technician_profile_id
  left join public.organization_members m
    on m.organization_id = v_req.organization_id and m.profile_id = a.technician_profile_id
  where a.requirement_id = v_req.id
  order by a.created_at, a.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. The requirement-side rules for professionals (the opportunities list and their own applications
--    evaluate eligibility in TypeScript on their own data; the country already comes with the card). Professional accounts only (42501 otherwise,
--    as list_opportunities); at most 200 ids per call (22023), the cap of list_opportunities. Only the
--    requirements the caller may read: published and current (open, not ended — D-12) or applied to;
--    any other id is silently absent (no existence oracle beyond what list_opportunities already shows).
-- ---------------------------------------------------------------------------------------------
create function public.get_requirement_profile_rules(p_requirement_ids uuid[])
returns table (
  requirement_id uuid,
  category text,
  aircraft text[],
  requires_type_rating boolean,
  engines text[],
  min_years integer,
  required_skills text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null
     or not exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_requirement_ids is null or cardinality(p_requirement_ids) > 200 then
    raise exception using errcode = '22023', message = 'between 0 and 200 requirement ids';
  end if;

  return query
  select wr.id, wr.category, wr.aircraft, wr.requires_type_rating, wr.engines, wr.min_years,
         wr.required_skills
  from public.work_requirements wr
  where wr.id = any (p_requirement_ids)
    and ((wr.status = 'open' and wr.ends_at > now())
         or exists (select 1 from public.applications a
                    where a.requirement_id = wr.id and a.technician_profile_id = v_uid))
  order by wr.id;
end;
$$;

-- Privileges: helpers private; the RPCs as before (anon nothing, authenticated execute).
-- candidate_declarations keeps EXECUTE for `authenticated` because own_candidate_profile is SECURITY
-- INVOKER (the caller's own rows under RLS): it is INVOKER too, so it reads only what the caller may read,
-- and app_private is not exposed by PostgREST.
revoke execute on function
  app_private.profile_rules_ok(uuid, text, text, text[], boolean, text[], integer, text[], date),
  app_private.hard_eligibility_for(timestamptz, timestamptz, public.requirement_urgency, uuid[], uuid, text, text,
    text[], boolean, text[], integer, text[]),
  app_private.hard_eligibility(uuid, uuid)
from public, anon, authenticated;
revoke execute on function app_private.candidate_declarations(uuid, uuid) from public, anon;
grant execute on function app_private.candidate_declarations(uuid, uuid) to authenticated;
revoke execute on function
  public.count_viable_candidates(uuid, timestamptz, timestamptz, public.requirement_urgency, uuid[], text, text,
    text[], boolean, text[], integer, text[]),
  public.get_requirement_candidate_pool(uuid),
  public.own_candidate_profile(timestamptz, timestamptz),
  public.get_requirement_applications(uuid),
  public.get_requirement_profile_rules(uuid[])
from public, anon;
grant execute on function
  public.count_viable_candidates(uuid, timestamptz, timestamptz, public.requirement_urgency, uuid[], text, text,
    text[], boolean, text[], integer, text[]),
  public.get_requirement_candidate_pool(uuid),
  public.own_candidate_profile(timestamptz, timestamptz),
  public.get_requirement_applications(uuid),
  public.get_requirement_profile_rules(uuid[])
to authenticated;
