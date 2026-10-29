-- Crew Flex — «Buscar candidatos»: the organization's free candidate directory (package directory; v2 diff 30
-- «Backlog derivado» v2-22, v2-23 and area 10 #6; BUSINESS_RULES BR-28, technical defaults T-150…T-158). v1.8
-- `CandidateDirectory.jsx`, connected `directoryProfile` (`app.mjs:50-58`).
--
-- NON-DESTRUCTIVE: one private settings row, one private throttle table, three private helpers, one new DEFINER RPC
-- and `create or replace` of public.count_visible_network (20261024600000, «Red visible») — same signature, return
-- type and privileges — which now counts the directory's visibility helper, the very predicate it carried inline
-- (one definition). app_private.ranked_external_pool and public.count_viable_candidates are NOT touched: the
-- directory reads nothing a requirement's pool does not. No table, column, policy or data is removed.
--
-- Not ported (security review 2026-10-23): an organization-side block of a professional. v1.8 has no such feature
-- (its `blockEmployer` is the PROFESSIONAL's own block, already public.technician_organization_blocks, N-08/T-35);
-- the full variant is parked under tag `parked/directory-employer-block` pending the owner.
--
-- Security model (S-7, S-10; review focus: a requirement-less search as an enumeration oracle, T-04 linkability):
-- 1. Who may search: an admin or manager of the organization, read from the database in the body (42501
--    otherwise — a plain member, another organization, a professional, a platform admin without membership,
--    anon). PostgREST reaches only the public RPC; the helpers and the tables have no API grant.
-- 2. Whom the organization may find (app_private.directory_visible): the external pool's visibility rules
--    without a requirement — `anonymous` / `open`, `verified_orgs` only for a reviewed organization, never a
--    member of the organization, never a professional who blocked it (technician_organization_blocks). `private`
--    profiles are never read, never counted and never resolvable from a ref: the directory tells nothing
--    about them. Parity with ranked_external_pool: tests/db/directory.test.ts on randomized profiles.
-- 3. What a row carries: a per-ORGANIZATION pseudonym `CF-<10 hex>` (sha256 of a secret salt, the organization
--    and the profile — stable for that organization so it can page and recognise; different for every
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
--    Bounds checked here (22023): the English level, years, the base length, the window, limit and offset.
--    Category, aircraft and country are NOT checked against the catalogs here: they are compared with declared
--    values, so an unknown value matches nobody (the Edge Function's schema refuses it with 400 before the call).
-- 5. Counts: `total` counts the visible rows of the search, the same set the organization pages through — not an
--    oracle beyond the list itself.
-- 6. Throttle (T-157): at most 60 searches per organization per minute, whoever runs them
--    (app_private.directory_throttle over app_private.directory_search_events, self-pruning); the 61st is CFD01 —
--    a bound on probing, not a security boundary. The page is at most 20 rows (the function's page size; the
--    database is the backstop for a direct PostgREST call) and the offset at most 10 000.

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
-- 2. The search throttle (T-157): one row per search, pruned by the next search of the organization.
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
-- 3. Private helpers (no API grant; called inside the DEFINER RPCs only).
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
-- («≥ 1 required qualification» needs one). The directory lists it; count_visible_network counts it.
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

-- T-157: at most 60 searches per organization per minute. The refused call is not counted (the exception rolls
-- its row back); rows older than an hour of this organization are pruned on the way. Check-then-insert without a
-- lock: two concurrent calls at 59 both pass — a brake, not a security boundary.
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
-- 4. The directory search (v2-22 / v2-23). VOLATILE: it records the search for the throttle.
--    22023 for a bound outside its domain (the UI validates first; the database is the backstop).
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
     or (p_english_level is not null and p_english_level <> all (v_levels))
     or (p_min_years is not null and p_min_years not between 0 and 60)
     or (p_base is not null and char_length(p_base) > 80)
     or ((p_from is null) <> (p_to is null))
     or (p_from is not null and (p_from < v_today or p_to < p_from or p_to - p_from > 365)) then
    raise exception using errcode = '22023', message = 'invalid directory filters';
  end if;

  perform app_private.directory_throttle(p_organization_id);

  return query
  with filtered as (
    select tp.profile_id, tp.visibility, tp.base_location, tp.years_experience
    from app_private.directory_visible(p_organization_id) v
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
-- 5. «Red visible» (shell-visual, 20261024600000; T-146): the same count from ONE definition — the directory's
--    visibility helper, which is the predicate the function carried inline — so the home KPI counts exactly the
--    rows the directory lists (tests/db/directory.test.ts; tests/db/shell-visual.test.ts keeps pinning it to
--    isExternallyMatchable). Same signature, volatility and privileges.
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

  return (select count(*)::integer from app_private.directory_visible(p_organization_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 6. Privileges: helpers private; the RPC for signed-in users only (the body decides the role).
-- ---------------------------------------------------------------------------------------------
revoke execute on function
  app_private.directory_ref(uuid, uuid),
  app_private.directory_visible(uuid),
  app_private.directory_throttle(uuid)
from public, anon, authenticated;
revoke execute on function
  public.search_candidate_directory(uuid, text, text, text, integer, text, text, date, date, integer, integer)
from public, anon;
grant execute on function
  public.search_candidate_directory(uuid, text, text, text, integer, text, text, date, date, integer, integer)
to authenticated;
