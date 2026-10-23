-- Crew Flex — «Buscar candidatos»: the organization's free candidate directory and the employer block
-- (package directory; v2 diff 30 «Backlog derivado» v2-22, v2-23, v2-16 and area 10 #6; BUSINESS_RULES BR-28,
-- technical defaults T-150…T-159). v1.8 `CandidateDirectory.jsx`, connected `directoryProfile` (`app.mjs:50-58`).
--
-- NON-DESTRUCTIVE: one private settings row, one private throttle table, one new public table (no API grant), three
-- private helpers, two new DEFINER RPCs, and `create or replace` of app_private.ranked_external_pool,
-- public.count_viable_candidates and public.count_visible_network — same signatures, return types and privileges;
-- the first two are the CURRENT bodies of 20261023900100 with ONE predicate added (the organization's own block,
-- v2-16; every earlier predicate — the professional's block N-08/T-35, «Empresas verificadas» BR-8/T-50, the
-- profile rules BR-3.7–3.13 — is kept), the third (20261024600000, «Red visible») now counts the directory's
-- visibility helper minus the organization's own blocks. No table, column, policy or data is removed.
--
-- Security model (S-7, S-10; review focus: a requirement-less search as an enumeration oracle, T-04 linkability):
-- 1. Who may search: an admin or manager of the organization, read from the database in the body (42501
--    otherwise — a plain member, another organization, a professional, a platform admin without membership,
--    anon). PostgREST reaches only the two public RPCs; the helpers and the tables have no API grant.
-- 2. Whom the organization may find (app_private.directory_visible): the external pool's visibility rules
--    without a requirement — `anonymous` / `open`, `verified_orgs` only for a reviewed organization, never a
--    member of the organization, never a professional who blocked it (technician_organization_blocks) — minus
--    the professionals the organization itself blocked (organization_candidate_blocks, v2-16). `private`
--    profiles are never read, never counted and never resolvable from a ref: the directory tells nothing
--    about them. Parity with ranked_external_pool: tests/db/directory.test.ts on randomized profiles.
-- 3. What a row carries: a per-ORGANIZATION pseudonym `CF-<10 hex>` (sha256 of a secret salt, the organization
--    and the profile — stable for that organization so it can page, recognise and block; different for every
--    other organization and different from every per-requirement ref, so refs link nothing across
--    organizations or needs, and nobody who knows a profile id can compute one — T-04 kept, T-151), the display
--    name only when `open`, base, declared years and the passport card as `candidate_declarations`
--    (app_private.candidate_declarations minimised as for a requirement that asks for nothing: engines,
--    capabilities and type ratings empty — T-85; never restriction text, contact, employer, rate, blocks,
--    documents or qualifications, T-153).
-- 4. Filters (T-154): category, aircraft, work-permit country and minimum years through
--    app_private.profile_rules_ok (the matching rules BR-3.7/3.8/3.9/3.12 on explicit values), English through
--    the CEFR order (no declared level never meets a minimum, v1.8), base as a case-insensitive substring, the
--    availability window through app_private.hard_eligibility_for (BR-4 as a planned need: `aog_only` is not
--    availability) and only for a window that starts today or later and spans at most 365 days (v1.8 «intervalo
--    válido de hasta un año»; past windows would only serve to probe people's history). Every filter but the
--    window asks about a value the card already shows, so narrowing the list reveals nothing a card does not.
-- 5. Counts: `total` counts the visible rows of the search (never `private`, never blockers), the same set the
--    organization pages through — not an oracle beyond the list itself.
-- 6. Throttle (T-157): at most 60 directory calls (searches and block/unblock alike) per organization per minute,
--    whoever runs them (app_private.directory_throttle over app_private.directory_search_events, self-pruning);
--    the 61st is CFD01 — a bound on probing, not a security boundary. The page is at most 20 rows (the function's
--    page size; the database is the backstop for a direct PostgREST call) and the offset at most 10 000.
-- 7. The employer block (v2-16, T-158): admin/manager only, by the ref the organization sees, resolved only among
--    the professionals it may currently find (so no ref of a private profile, a member or a blocker resolves —
--    CFD02 like an unknown one, no existence oracle); audited `directory.candidate_blocked` /
--    `…_unblocked` with the block row id and the request id only (never the profile id — an organization admin
--    reads its audit rows); applied to the directory, ranked_external_pool (hence the per-need pool, its summary
--    and the outreach audience) and count_viable_candidates. The professional is never told (symmetric with
--    T-35): opportunities and applying are unaffected. Known consequence (security review 2026-10-23, Medium-1,
--    owner decision pending): because the block removes one chosen professional from the organization's own
--    pools, blocking and unblocking lets that organization link a directory ref to the same person's
--    per-requirement refs (the pool row that disappears) — the refs themselves stay unlinkable; the linkage
--    needs two audited acts per need. tests/db/directory.test.ts pins this behaviour.

-- ---------------------------------------------------------------------------------------------
-- 1. The salt of the directory pseudonyms (one row). Owner-only: no API role reads it.
-- ---------------------------------------------------------------------------------------------
create table app_private.directory_settings (
  singleton boolean primary key default true check (singleton),
  pseudonym_salt text not null default gen_random_uuid()::text
);
alter table app_private.directory_settings enable row level security; -- no policies: API roles see nothing
revoke all on table app_private.directory_settings from public, anon, authenticated;
insert into app_private.directory_settings default values;

-- ---------------------------------------------------------------------------------------------
-- 2. v2-16 — the professionals an organization hides from its own results. No grant to any API role and no
--    policy: reached only through set_directory_block (write) and the directory / pool functions (read), so the
--    profile id behind a pseudonym never leaves the database. Cascades with the professional and the organization.
-- ---------------------------------------------------------------------------------------------
create table public.organization_candidate_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  technician_profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, technician_profile_id)
);
alter table public.organization_candidate_blocks enable row level security; -- no policies on purpose
create index organization_candidate_blocks_profile_idx
  on public.organization_candidate_blocks (technician_profile_id);
revoke all on table public.organization_candidate_blocks from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The search throttle (T-157): one row per search, pruned by the next search of the organization.
-- ---------------------------------------------------------------------------------------------
create table app_private.directory_search_events (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table app_private.directory_search_events enable row level security; -- no policies
create index directory_search_events_org_idx
  on app_private.directory_search_events (organization_id, created_at);
revoke all on table app_private.directory_search_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Private helpers (no API grant; called inside the DEFINER RPCs only).
-- ---------------------------------------------------------------------------------------------
-- The per-organization pseudonym (T-151). Same shape as the per-requirement ref (`CF-` + 10 hex) so the UI
-- treats both alike; a different value for every organization and every requirement.
create function app_private.directory_ref(p_organization_id uuid, p_profile_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select 'CF-' || upper(left(encode(sha256(convert_to(
           s.pseudonym_salt || ':' || p_organization_id::text || ':' || p_profile_id::text, 'UTF8')), 'hex'), 10))
  from app_private.directory_settings s;
$$;

-- Whom the organization may find: ranked_external_pool's `candidates` predicates without the requirement
-- («≥ 1 required qualification» needs one). The organization's OWN block is applied by the callers, so the
-- blocked list can be read back and a blocked ref still resolves for unblocking.
create function app_private.directory_visible(p_organization_id uuid)
returns table (profile_id uuid)
language sql
stable
security invoker
set search_path = ''
as $$
  select tp.profile_id
  from public.technician_profiles tp
  where (tp.visibility in ('anonymous', 'open')
         -- BR-8 «Empresas verificadas»: only for an organization with a registered review
         or (tp.visibility = 'verified_orgs'
             and exists (select 1 from public.organizations o
                         where o.id = p_organization_id and o.review_status = 'reviewed')))
    and not exists (select 1 from public.organization_members om
                    where om.organization_id = p_organization_id and om.profile_id = tp.profile_id)
    -- N-08 / T-35: the professional blocked this organization.
    and not exists (select 1 from public.technician_organization_blocks b
                    where b.technician_profile_id = tp.profile_id and b.organization_id = p_organization_id);
$$;

-- T-157: at most 60 directory calls per organization per minute. The refused call is not counted (the exception
-- rolls its row back); rows older than an hour of this organization are pruned on the way. Check-then-insert
-- without a lock: two concurrent calls at 59 both pass — a brake, not a security boundary.
create function app_private.directory_throttle(p_organization_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  delete from app_private.directory_search_events e
  where e.organization_id = p_organization_id and e.created_at < v_now - interval '1 hour';
  if (select count(*) from app_private.directory_search_events e
      where e.organization_id = p_organization_id and e.created_at > v_now - interval '1 minute') >= 60 then
    raise exception using errcode = 'CFD01', message = 'directory rate limited';
  end if;
  insert into app_private.directory_search_events (organization_id) values (p_organization_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. The directory search (v2-22 / v2-23). VOLATILE: it records the search for the throttle.
--    22023 for filters outside their domain (the UI validates first; the database is the backstop).
-- ---------------------------------------------------------------------------------------------
create function public.search_candidate_directory(
  p_organization_id uuid,
  p_category text default null,
  p_aircraft text default null,
  p_english_level text default null,
  p_min_years integer default null,
  p_country text default null,
  p_base text default null,
  p_from date default null,
  p_to date default null,
  p_blocked boolean default false,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  candidate_ref text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_declarations jsonb,
  total integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'UTC')::date;
  v_levels constant text[] := array['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
begin
  if v_uid is null
     or not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_limit is null or p_limit not between 1 and 20
     or p_offset is null or p_offset not between 0 and 10000
     or p_blocked is null
     or (p_english_level is not null and p_english_level <> all (v_levels))
     or (p_min_years is not null and p_min_years not between 0 and 60)
     or (p_base is not null and char_length(p_base) > 80)
     or ((p_from is null) <> (p_to is null))
     or (p_from is not null and (p_from < v_today or p_to < p_from or p_to - p_from > 365)) then
    raise exception using errcode = '22023', message = 'invalid directory filters';
  end if;

  perform app_private.directory_throttle(p_organization_id);

  return query
  with visible as (
    select v.profile_id
    from app_private.directory_visible(p_organization_id) v
    -- v2-16: the organization's own block — out of the directory, or exactly the blocked list.
    where exists (select 1 from public.organization_candidate_blocks cb
                  where cb.organization_id = p_organization_id and cb.technician_profile_id = v.profile_id)
          = p_blocked
  ),
  filtered as (
    select tp.profile_id, tp.visibility, tp.base_location, tp.years_experience
    from visible v
    join public.technician_profiles tp on tp.profile_id = v.profile_id
    -- BR-3.7 permit · BR-3.8 category · BR-3.9 aircraft · BR-3.12 minimum years, the matching expressions.
    where app_private.profile_rules_ok(tp.profile_id, p_country, p_category,
            case when p_aircraft is null then '{}'::text[] else array[p_aircraft] end,
            false, '{}'::text[], p_min_years, '{}'::text[], v_today)
      -- v1.8 «Inglés mínimo»: CEFR order; no declared level never meets a minimum.
      and (p_english_level is null
           or array_position(v_levels, tp.english_level) >= array_position(v_levels, p_english_level))
      -- v1.8 «Base habitual» as a substring (the search field), case-insensitive, wildcards escaped.
      and (p_base is null
           or tp.base_location ilike
              '%' || replace(replace(replace(p_base, '\', '\\'), '%', '\%'), '_', '\_') || '%')
      -- v1.8 «Disponibilidad desde/hasta»: every day of the window published as available (BR-4 as a planned
      -- need: `unavailable` and `aog_only` block). The window is whole UTC days.
      and (p_from is null
           or (select e.availability_ok
               from app_private.hard_eligibility_for(
                      p_from::timestamp at time zone 'UTC', (p_to + 1)::timestamp at time zone 'UTC',
                      'planned'::public.requirement_urgency, '{}'::uuid[], tp.profile_id) e))
  )
  select
    app_private.directory_ref(p_organization_id, f.profile_id),
    case when f.visibility = 'open' then pr.display_name end,
    f.base_location,
    f.years_experience,
    -- The passport card (T-85 minimised as for a requirement asking for nothing): never engines, capabilities,
    -- type ratings, restriction text, qualifications, contact, employer, rate, blocks or documents.
    app_private.candidate_declarations(f.profile_id, null)
      || jsonb_build_object('engines', '[]'::jsonb, 'skills', '[]'::jsonb, 'typeRatings', '[]'::jsonb),
    (count(*) over ())::integer
  from filtered f
  join public.profiles pr on pr.id = f.profile_id
  -- Declared experience first (v1.8 «Experiencia declarada»), then the ref: stable and favouring nobody.
  order by f.years_experience desc nulls last, 1
  limit p_limit offset p_offset;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. v2-16 — block or unblock one professional by the ref the organization sees. Returns the resulting state.
--    Idempotent (a second block or unblock changes and audits nothing).
-- ---------------------------------------------------------------------------------------------
create function public.set_directory_block(
  p_organization_id uuid,
  p_candidate_ref text,
  p_blocked boolean,
  p_request_id uuid default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile uuid;
  v_block_id uuid;
begin
  if v_uid is null
     or not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_blocked is null or p_candidate_ref is null or p_candidate_ref !~ '^CF-[0-9A-F]{10}$' then
    raise exception using errcode = '22023', message = 'invalid block request';
  end if;
  -- Same brake as the search (security review Low-1): a no-op unblock answers whether a ref is still visible.
  perform app_private.directory_throttle(p_organization_id);

  -- Only a professional the organization may currently find resolves (a private profile, a member or someone
  -- who blocked the organization never does — the same CFD02 as an unknown ref, no existence oracle). Two
  -- profiles behind one ref (a 40-bit collision) are refused rather than guessed.
  begin
    select v.profile_id into strict v_profile
    from app_private.directory_visible(p_organization_id) v
    where app_private.directory_ref(p_organization_id, v.profile_id) = p_candidate_ref;
  exception
    when no_data_found or too_many_rows then
      raise exception using errcode = 'CFD02', message = 'candidate not found';
  end;

  if p_blocked then
    insert into public.organization_candidate_blocks (organization_id, technician_profile_id, created_by)
    values (p_organization_id, v_profile, v_uid)
    on conflict (organization_id, technician_profile_id) do nothing
    returning id into v_block_id;
    if v_block_id is null then
      return true; -- already blocked
    end if;
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (v_uid, p_organization_id, 'directory.candidate_blocked', 'organization_candidate_block', v_block_id,
            jsonb_build_object('request_id', p_request_id));
    return true;
  end if;

  delete from public.organization_candidate_blocks cb
  where cb.organization_id = p_organization_id and cb.technician_profile_id = v_profile
  returning cb.id into v_block_id;
  if v_block_id is null then
    return false; -- was not blocked
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_organization_id, 'directory.candidate_unblocked', 'organization_candidate_block', v_block_id,
          jsonb_build_object('request_id', p_request_id));
  return false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 7. External pool prefilter: the CURRENT body of 20261023900100 with ONE predicate added in `candidates`
--    (the organization's own block, v2-16). Everything else is unchanged.
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
      -- v2-16 (package directory, 20261024700000): the organization blocked this professional.
      and not exists (select 1 from public.organization_candidate_blocks cb
                      where cb.organization_id = req.organization_id and cb.technician_profile_id = tp.profile_id)
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
-- 8. The builder's live count: the CURRENT body of 20261023900100 with the same ONE predicate added, so the
--    count and the pool keep agreeing (tests/db/directory.test.ts).
-- ---------------------------------------------------------------------------------------------
create or replace function public.count_viable_candidates(
  p_organization_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_urgency public.requirement_urgency,
  p_hard_type_ids uuid[],
  p_country text default null
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
    p_starts_at, p_ends_at, p_urgency, p_hard_type_ids, tp.profile_id, p_country) as e
  where (m.profile_id is not null
         or ((tp.visibility in ('anonymous', 'open')
              or (tp.visibility = 'verified_orgs'
                  and exists (select 1 from public.organizations o
                              where o.id = p_organization_id and o.review_status = 'reviewed')))
             and not exists (select 1 from public.technician_organization_blocks b
                             where b.technician_profile_id = tp.profile_id
                               and b.organization_id = p_organization_id)
             -- v2-16 (package directory): the organization blocked this professional.
             and not exists (select 1 from public.organization_candidate_blocks cb
                             where cb.organization_id = p_organization_id
                               and cb.technician_profile_id = tp.profile_id)))
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
-- 8b. «Red visible» (shell-visual, 20261024600000; T-146): the same count from ONE definition — the directory's
--     visibility helper — minus the organization's own blocks (v2-16), so the home KPI counts exactly the rows
--     the directory lists (tests/db/directory.test.ts). Same signature, volatility and privileges.
-- ---------------------------------------------------------------------------------------------
create or replace function public.count_visible_network(p_organization_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not public.has_org_role(
       p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return (
    select count(*)::integer
    from app_private.directory_visible(p_organization_id) v
    where not exists (select 1 from public.organization_candidate_blocks cb
                      where cb.organization_id = p_organization_id and cb.technician_profile_id = v.profile_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 9. Privileges: helpers private; the two RPCs for signed-in users only (the body decides the role).
-- ---------------------------------------------------------------------------------------------
revoke execute on function
  app_private.directory_ref(uuid, uuid),
  app_private.directory_visible(uuid),
  app_private.directory_throttle(uuid)
from public, anon, authenticated;
revoke execute on function
  public.search_candidate_directory(uuid, text, text, text, integer, text, text, date, date, boolean, integer, integer),
  public.set_directory_block(uuid, text, boolean, uuid)
from public, anon;
grant execute on function
  public.search_candidate_directory(uuid, text, text, text, integer, text, text, date, date, boolean, integer, integer),
  public.set_directory_block(uuid, text, boolean, uuid)
to authenticated;
