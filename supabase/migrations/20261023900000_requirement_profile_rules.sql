-- Crew Flex — v1.8 profile requirements of a work requirement (package matching-v18, v2 diff 30 v2-11:
-- ORG-02 #11-14, #16, #19; 20 N-02 / N-07). Owner rule DEFAULTS (2026-10-22): v1.8's behaviour as documented
-- technical defaults T-80…T-87 (docs/integration/crewflex-v13/08-product-decisions.md; C-10/D-02/D-03/OD-6).
-- NON-DESTRUCTIVE: adds six columns with defaults/NULL and CHECK constraints, and `create or replace` of the two
-- freeze guards (bodies of 20261023600000, the new columns appended to their tuples). No drop, no data change:
-- every existing row gets «no profile requirement», so its eligibility stays exactly the qualification +
-- availability (+ country, below) verdict it has today (BR-3).
--
-- Names follow v1.8 (`server/rules.mjs` validateJob / `src/business.js` matching): category, aircraft
-- («Aeronaves aceptadas», any of), requires_type_rating (`requiresLicense` / `requireType`), engines (any of),
-- min_years, required_skills (all of). The job's country is the builder's column (20261023600000, EU CHECK,
-- default ES in the form): the work-permit rule (BR-3.7) reads it, no second country column.
--
-- Who writes them: nobody through the API yet. No INSERT/UPDATE grant is added, so a create through the
-- INVOKER RPC gets the defaults; the builder form and its RPCs adopt them in a follow-up. The seed and the
-- owner can write them. Readers: whoever reads the requirement row (RLS unchanged) and professionals through
-- get_requirement_profile_rules (20261023900100). The lists repeat src/domain/passport.ts
-- (tests/db/matching-v18.test.ts proves they agree).

alter table public.work_requirements
  add column category text,
  add column aircraft text[] not null default '{}',
  add column requires_type_rating boolean not null default false,
  add column engines text[] not null default '{}',
  add column min_years integer,
  add column required_skills text[] not null default '{}';

alter table public.work_requirements
  add constraint work_requirements_category_check check (
    category is null or category = any (array['B1.1', 'B1.2', 'B1.3', 'B1.4', 'B2', 'B3', 'CAT-A', 'CAT-C',
                                               'MECHANIC', 'SHEET-METAL', 'NDT', 'HELPER']::text[])),
  add constraint work_requirements_aircraft_check check (
    aircraft <@ array['A320 Family', 'B737 NG', 'B737 MAX', 'ATR 72', 'Embraer E-Jets', 'A330', 'A350',
                      'B787', 'EC135/145', 'Cessna 172', 'Piper PA-28', 'Robinson R44']::text[]
    and cardinality(aircraft) <= 12),
  add constraint work_requirements_engines_check check (
    engines <@ array['CFM56-5B/7B', 'LEAP-1A', 'LEAP-1B', 'PW1100G', 'PW127', 'Trent 700/1000',
                     'GE90']::text[]
    and cardinality(engines) <= 7),
  add constraint work_requirements_min_years_check check (min_years is null or min_years between 0 and 60),
  add constraint work_requirements_required_skills_check check (
    required_skills <@ array['line_maintenance', 'base_maintenance', 'aog_support', 'troubleshooting',
                             'engine_change', 'sheet_metal', 'ndt', 'borescope', 'cabin_systems']::text[]
    and cardinality(required_skills) <= 9),
  -- v1.8 demo «Habilitación: falta definir aeronave» is a configuration error, refused here instead: a
  -- type rating is asked for a licence category (not one of the 4 trades) on at least one aircraft (T-83).
  add constraint work_requirements_type_rating_check check (
    not requires_type_rating
    or (coalesce(category = any (array['B1.1', 'B1.2', 'B1.3', 'B1.4', 'B2', 'B3', 'CAT-A', 'CAT-C']::text[]),
                 false)
        and cardinality(aircraft) >= 1));

-- ---------------------------------------------------------------------------------------------
-- Freeze guards (bodies of 20261023600000, same rules): a closed requirement and one that ever received an
-- application keep their profile requirements too — what an applicant was judged against cannot move.
-- ---------------------------------------------------------------------------------------------
create or replace function public.guard_closed_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status public.requirement_status;
begin
  if tg_table_name = 'work_requirements' then
    if (new.organization_id, new.title, new.location, new.starts_at, new.ends_at, new.shift,
        new.headcount, new.urgency, new.status, new.country, new.timezone, new.description, new.shifts,
        new.conditions, new.category, new.aircraft, new.requires_type_rating, new.engines, new.min_years,
        new.required_skills)
       is distinct from
       (old.organization_id, old.title, old.location, old.starts_at, old.ends_at, old.shift,
        old.headcount, old.urgency, old.status, old.country, old.timezone, old.description, old.shifts,
        old.conditions, old.category, old.aircraft, old.requires_type_rating, old.engines, old.min_years,
        old.required_skills)
       or (old.archived_at is not null and new.archived_at is distinct from old.archived_at) then
      raise exception 'a closed requirement cannot be changed' using errcode = '55000';
    end if;
    return new;
  end if;
  select wr.organization_id, wr.status into v_org, v_status
  from public.work_requirements wr
  where wr.id = coalesce(new.work_requirement_id, old.work_requirement_id);
  if found and v_status = 'closed'
     and ((select auth.uid()) is null
          or public.has_org_role(v_org, array['admin', 'manager']::public.organization_role[])) then
    raise exception 'a closed requirement cannot be changed' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.guard_closed_requirement() from public, anon, authenticated;

create or replace function public.guard_requirement_with_applications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_org uuid;
begin
  if tg_table_name = 'work_requirements' then
    if (new.organization_id, new.title, new.location, new.starts_at, new.ends_at, new.shift,
        new.headcount, new.urgency, new.country, new.timezone, new.description, new.shifts, new.conditions,
        new.category, new.aircraft, new.requires_type_rating, new.engines, new.min_years, new.required_skills)
       is distinct from
       (old.organization_id, old.title, old.location, old.starts_at, old.ends_at, old.shift,
        old.headcount, old.urgency, old.country, old.timezone, old.description, old.shifts, old.conditions,
        old.category, old.aircraft, old.requires_type_rating, old.engines, old.min_years, old.required_skills)
       and exists (select 1 from public.applications a where a.requirement_id = old.id) then
      raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
    end if;
    return new;
  end if;
  foreach v_id in array array_remove(array[new.work_requirement_id, old.work_requirement_id], null) loop
    select wr.organization_id into v_org from public.work_requirements wr where wr.id = v_id;
    continue when not found; -- parent deleted in this transaction (cascade)
    continue when (select auth.uid()) is not null
      and not public.has_org_role(v_org, array['admin', 'manager']::public.organization_role[]);
    perform 1 from public.work_requirements wr where wr.id = v_id for update;
    if exists (select 1 from public.applications a where a.requirement_id = v_id) then
      raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.guard_requirement_with_applications() from public, anon, authenticated;
