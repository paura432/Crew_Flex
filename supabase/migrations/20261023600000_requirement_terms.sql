-- Crew Flex — requirement terms: shifts, country, IANA zone, conditions, description, archive flag
-- (v2 diff area 30: v2-09, v2-10, v2-12, v2-14; SCOPE-2 + DEFAULTS of 2026-10-22, technical defaults T-15…T-19 in
-- docs/integration/crewflex-v13/08-product-decisions.md).
-- NON-DESTRUCTIVE: adds six nullable columns, their CHECK constraints, four private validators, one INSERT column
-- grant; `create or replace` of guard_closed_requirement / guard_requirement_with_applications (same rules, the
-- new columns frozen too) and of the private view app_private.requirement_cards (columns appended). The return
-- type of list_opportunities grows, which PostgreSQL only allows through drop + create of that function (no data,
-- same signature, same grants re-applied in this transaction). No table, column, policy or data is removed.
--
-- What every new column means (all NULL = «not stated», which is what every existing row gets):
--   * country     — the job's country, one of the 27 EU members (v1.8 server/rules.mjs:1, OD-6/D-04 default).
--   * timezone    — the base's IANA zone, from a fixed EU list (v1.8 «Zona IANA de la base»); used only to tell
--                   local dates apart (one shift per local start date). Instants stay UTC (BR-10).
--   * shifts      — v1.8 connected ShiftEditor (src/beta/Account.jsx:77): 1–366 shifts, each ≤ 24 h with its
--                   base hours (0.25–24, never more than the shift lasts), sorted, no overlaps, one per local
--                   start date; the requirement's [starts_at, ends_at) is exactly their envelope. NULL = one
--                   continuous period (every requirement until now). D-06 Q6 is unchanged: an application covers
--                   the requirement's whole period, so eligibility, applications and the confirm re-check keep
--                   using the envelope (T-15).
--   * conditions  — informative terms without real money (v1.8 demo Company2.jsx:114-125, Marketplace.jsx:11-44;
--                   OD-7: no fee, commission or invoice): rates, per diem, hours per shift, contract type, budget
--                   flag, mobilisation, incorporation and logistics (T-17). Validated key by key below.
--   * description — free text ≤ 4000 (v1.8 connected «Descripción y condiciones»).
--   * archived_at — v1.8 «Archivar» (one way): only on a closed requirement (T-19); written by the archive RPC only.
-- Who writes them: the create RPC (SECURITY INVOKER, so `authenticated` gets INSERT on the five business columns)
-- and the edit RPC (DEFINER). There is no UPDATE grant: direct PostgREST writes cannot change them, and the CHECK
-- constraints hold for every write path, the table owner included.

-- ---------------------------------------------------------------------------------------------
-- Validators. Immutable (they read only their arguments) so CHECK constraints can use them. They run with the
-- privileges of whoever writes the row, hence EXECUTE for `authenticated` (app_private is not exposed by PostgREST).
-- ---------------------------------------------------------------------------------------------

-- 1–366 shifts {startsAt, endsAt, baseHours}, canonical ISO UTC with milliseconds (the RPCs normalise them),
-- each 0 < duration ≤ 24 h, 0.25 ≤ baseHours ≤ 24 (two decimals) and ≤ the duration, sorted by start without
-- overlaps (touching is fine, as v1.8 `overlaps`), one per local start date in the zone (UTC when no zone), and
-- the requirement's period = their envelope. Same rules as `shiftIssues` (src/domain/work-requirement.ts).
create function app_private.requirement_shifts_valid(
  p_shifts jsonb,
  p_time_zone text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_iso constant text := '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$';
  v_item jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_hours numeric;
  v_day date;
  v_first timestamptz;
  v_prev_end timestamptz;
  v_prev_day date;
begin
  if p_shifts is null then
    return true;
  end if;
  if jsonb_typeof(p_shifts) <> 'array' or jsonb_array_length(p_shifts) not between 1 and 366 then
    return false;
  end if;
  for v_item in
    select e.value from jsonb_array_elements(p_shifts) with ordinality as e(value, n) order by e.n
  loop
    if jsonb_typeof(v_item) <> 'object'
       or (select count(*) from jsonb_object_keys(v_item)) <> 3
       or jsonb_typeof(v_item -> 'startsAt') is distinct from 'string'
       or jsonb_typeof(v_item -> 'endsAt') is distinct from 'string'
       or jsonb_typeof(v_item -> 'baseHours') is distinct from 'number'
       or (v_item ->> 'startsAt') !~ v_iso
       or (v_item ->> 'endsAt') !~ v_iso then
      return false;
    end if;
    v_start := (v_item ->> 'startsAt')::timestamptz;
    v_end := (v_item ->> 'endsAt')::timestamptz;
    v_hours := (v_item ->> 'baseHours')::numeric;
    if v_end <= v_start
       or v_end - v_start > interval '24 hours'
       or v_hours < 0.25 or v_hours > 24 or v_hours <> round(v_hours, 2)
       or v_hours * 3600 > extract(epoch from v_end - v_start) then
      return false;
    end if;
    v_day := (v_start at time zone coalesce(p_time_zone, 'UTC'))::date;
    if v_prev_end is not null and (v_start < v_prev_end or v_day <= v_prev_day) then
      return false;
    end if;
    v_first := coalesce(v_first, v_start);
    v_prev_end := v_end;
    v_prev_day := v_day;
  end loop;
  return v_first = p_starts_at and v_prev_end = p_ends_at;
exception
  when others then -- an impossible date or an unknown zone: not a valid list
    return false;
end;
$$;

-- Known keys only, each with its v1.8 range (Company2.jsx:114-125; connected rules.mjs `amount`): money in EUR with
-- two decimals and no real payment (OD-7), hours, a contract type, booleans and one short text.
create function app_private.requirement_conditions_valid(p_conditions jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_number numeric;
begin
  if p_conditions is null then
    return true;
  end if;
  if jsonb_typeof(p_conditions) <> 'object' then
    return false;
  end if;
  for v_key, v_value in select e.key, e.value from jsonb_each(p_conditions) as e loop
    if v_key in ('hourlyRate', 'overtimeRate', 'perDiem', 'shiftHours', 'maxMobilizationHours') then
      if jsonb_typeof(v_value) <> 'number' then
        return false;
      end if;
      v_number := (v_value #>> '{}')::numeric;
      if v_number <> round(v_number, 2)
         or (v_key = 'hourlyRate' and (v_number <= 0 or v_number > 2000))
         or (v_key in ('overtimeRate', 'perDiem') and (v_number < 0 or v_number > 2000))
         or (v_key = 'shiftHours' and (v_number < 0.25 or v_number > 24))
         or (v_key = 'maxMobilizationHours' and (v_number <> trunc(v_number) or v_number < 1 or v_number > 168)) then
        return false;
      end if;
    elsif v_key = 'contractType' then
      if jsonb_typeof(v_value) <> 'string'
         or (v_value #>> '{}') not in ('contractor', 'temporary', 'permanent', 'project') then
        return false;
      end if;
    elsif v_key in ('budgetMandatory', 'flights', 'accommodation', 'localTransport', 'meals', 'ownTools') then
      if jsonb_typeof(v_value) <> 'boolean' then
        return false;
      end if;
    elsif v_key = 'arrival' then
      if jsonb_typeof(v_value) <> 'string'
         or char_length(v_value #>> '{}') not between 1 and 160
         or (v_value #>> '{}') <> btrim(v_value #>> '{}') then
        return false;
      end if;
    else
      return false; -- unknown key (no free-form terms, no commission fields: OUT)
    end if;
  end loop;
  return true;
end;
$$;

-- Canonical shifts for storage and request hashes: ISO UTC with milliseconds, base hours rounded to 2 decimals,
-- sorted by start. NULL or an empty list = no shifts. Anything unreadable is 22023 (→ 400); the CHECK above then
-- applies the rules. Stable (reading an instant without an offset would depend on the session zone).
create function app_private.normalize_requirement_shifts(p_shifts jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if p_shifts is null or jsonb_typeof(p_shifts) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_shifts) <> 'array' then
    raise exception using errcode = '22023', message = 'shifts must be a list';
  end if;
  if jsonb_array_length(p_shifts) = 0 then
    return null;
  end if;
  begin
    select jsonb_agg(jsonb_build_object(
             'startsAt', to_char((e ->> 'startsAt')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'endsAt', to_char((e ->> 'endsAt')::timestamptz at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'baseHours', round((e ->> 'baseHours')::numeric, 2))
           order by (e ->> 'startsAt')::timestamptz, (e ->> 'endsAt')::timestamptz)
    into v_out
    from jsonb_array_elements(p_shifts) as e;
  exception
    when others then
      raise exception using errcode = '22023', message = 'invalid shifts';
  end;
  return v_out;
end;
$$;

-- Conditions without nulls; an empty object = not stated (NULL). Not an object → 22023.
create function app_private.normalize_requirement_conditions(p_conditions jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if p_conditions is null or jsonb_typeof(p_conditions) = 'null' then
    return null;
  end if;
  if jsonb_typeof(p_conditions) <> 'object' then
    raise exception using errcode = '22023', message = 'conditions must be an object';
  end if;
  v_out := jsonb_strip_nulls(p_conditions);
  return case when v_out = '{}'::jsonb then null else v_out end;
end;
$$;

revoke execute on function
  app_private.requirement_shifts_valid(jsonb, text, timestamptz, timestamptz),
  app_private.requirement_conditions_valid(jsonb),
  app_private.normalize_requirement_shifts(jsonb),
  app_private.normalize_requirement_conditions(jsonb)
from public, anon;
grant execute on function
  app_private.requirement_shifts_valid(jsonb, text, timestamptz, timestamptz),
  app_private.requirement_conditions_valid(jsonb),
  app_private.normalize_requirement_shifts(jsonb),
  app_private.normalize_requirement_conditions(jsonb)
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Columns and constraints. The two lists are EU_COUNTRIES and REQUIREMENT_TIME_ZONES of
-- src/domain/work-requirement.ts (PGlite suite requirement-builder compares them).
-- ---------------------------------------------------------------------------------------------
alter table public.work_requirements
  add column country text,
  add column timezone text,
  add column description text,
  add column shifts jsonb,
  add column conditions jsonb,
  add column archived_at timestamptz;

alter table public.work_requirements
  add constraint work_requirements_country_eu check (
    country is null or country in (
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
      'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE')),
  add constraint work_requirements_timezone_known check (
    timezone is null or timezone in (
      'UTC', 'Europe/Vienna', 'Europe/Brussels', 'Europe/Sofia', 'Europe/Zagreb', 'Asia/Nicosia',
      'Europe/Prague', 'Europe/Copenhagen', 'Europe/Tallinn', 'Europe/Helsinki', 'Europe/Paris',
      'Europe/Berlin', 'Europe/Athens', 'Europe/Budapest', 'Europe/Dublin', 'Europe/Rome', 'Europe/Riga',
      'Europe/Vilnius', 'Europe/Luxembourg', 'Europe/Malta', 'Europe/Amsterdam', 'Europe/Warsaw',
      'Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores', 'Europe/Bucharest', 'Europe/Bratislava',
      'Europe/Ljubljana', 'Europe/Madrid', 'Atlantic/Canary', 'Africa/Ceuta', 'Europe/Stockholm')),
  add constraint work_requirements_description_length check (
    description is null or char_length(description) between 1 and 4000),
  add constraint work_requirements_shifts_valid check (
    app_private.requirement_shifts_valid(shifts, timezone, starts_at, ends_at)),
  add constraint work_requirements_conditions_valid check (
    app_private.requirement_conditions_valid(conditions)),
  add constraint work_requirements_archived_closed check (archived_at is null or status = 'closed');

-- The create RPC is SECURITY INVOKER (RLS insert policy applies): it needs these columns. No UPDATE grant.
grant insert (country, timezone, description, shifts, conditions) on public.work_requirements to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Freeze guards (bodies of 20261022130300, same rules) with the new business columns: a closed requirement and
-- one that ever received an application keep their terms, shifts and country too. `archived_at` is one way: it
-- may be set on a closed row (archive RPC) and never changed afterwards.
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
        new.conditions)
       is distinct from
       (old.organization_id, old.title, old.location, old.starts_at, old.ends_at, old.shift,
        old.headcount, old.urgency, old.status, old.country, old.timezone, old.description, old.shifts,
        old.conditions)
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
        new.headcount, new.urgency, new.country, new.timezone, new.description, new.shifts, new.conditions)
       is distinct from
       (old.organization_id, old.title, old.location, old.starts_at, old.ends_at, old.shift,
        old.headcount, old.urgency, old.country, old.timezone, old.description, old.shifts, old.conditions)
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

-- ---------------------------------------------------------------------------------------------
-- The one projection professionals see (D-12) and the proposal terms (T-11): the same columns as
-- 20261022130200 plus the new terms, appended; `card` gains them too, so every proposal version written from now
-- on freezes them (R-08). Still no ids of people or organizations, no counts, no `archived_at`.
-- ---------------------------------------------------------------------------------------------
create or replace view app_private.requirement_cards as
select
  wr.id,
  wr.status,
  o.name as organization_name,
  wr.title,
  wr.location,
  wr.starts_at,
  wr.ends_at,
  wr.shift,
  wr.headcount,
  wr.urgency,
  wr.created_at,
  q.qualifications,
  jsonb_build_object(
    'id', wr.id,
    'organizationName', o.name,
    'title', wr.title,
    'location', wr.location,
    'startsAt', to_char(wr.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'endsAt', to_char(wr.ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'shift', wr.shift,
    'headcount', wr.headcount,
    'urgency', wr.urgency,
    'createdAt', to_char(wr.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'status', wr.status,
    'qualifications', q.qualifications,
    'country', wr.country,
    'timeZone', wr.timezone,
    'description', wr.description,
    'shifts', wr.shifts,
    'conditions', wr.conditions
  ) as card,
  wr.country,
  wr.timezone,
  wr.description,
  wr.shifts,
  wr.conditions
from public.work_requirements wr
join public.organizations o on o.id = wr.organization_id
cross join lateral (
  select coalesce(jsonb_agg(jsonb_build_object(
           'qualificationTypeId', qt.id,
           'code', qt.code,
           'name', qt.name,
           'level', wrq.requirement_level
         ) order by wrq.requirement_level, qt.code), '[]'::jsonb) as qualifications
  from public.work_requirement_qualifications wrq
  join public.qualification_types qt on qt.id = wrq.qualification_type_id
  where wrq.work_requirement_id = wr.id
) q;

revoke all on app_private.requirement_cards from public, anon, authenticated;

-- list_opportunities (20261022130200) with the new terms in its fixed projection. Same filters, order, cap and
-- authorization; only the returned columns grow (drop + create: PostgreSQL cannot change a return type in place).
drop function public.list_opportunities(uuid, public.requirement_urgency, text, integer);

create function public.list_opportunities(
  p_id uuid default null,
  p_urgency public.requirement_urgency default null,
  p_q text default null,
  p_limit integer default 200
)
returns table (
  id uuid,
  organization_name text,
  title text,
  location text,
  starts_at timestamptz,
  ends_at timestamptz,
  shift public.shift_type,
  headcount integer,
  urgency public.requirement_urgency,
  created_at timestamptz,
  qualifications jsonb,
  country text,
  time_zone text,
  description text,
  shifts jsonb,
  conditions jsonb,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_q text := lower(left(nullif(btrim(coalesce(p_q, '')), ''), 80));
begin
  if not exists (select 1 from public.technician_profiles tp where tp.profile_id = (select auth.uid())) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  select c.id, c.organization_name, c.title, c.location, c.starts_at, c.ends_at, c.shift, c.headcount,
         c.urgency, c.created_at, c.qualifications, c.country, c.timezone, c.description, c.shifts,
         c.conditions, count(*) over ()
  from app_private.requirement_cards c
  where c.status = 'open'
    and c.ends_at > now()
    and (p_id is null or c.id = p_id)
    and (p_urgency is null or c.urgency = p_urgency)
    and (v_q is null
         or strpos(lower(c.title), v_q) > 0
         or strpos(lower(c.location), v_q) > 0
         or strpos(lower(c.organization_name), v_q) > 0)
  order by c.starts_at, c.id
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
end;
$$;

revoke execute on function public.list_opportunities(uuid, public.requirement_urgency, text, integer)
from public, anon;
grant execute on function public.list_opportunities(uuid, public.requirement_urgency, text, integer)
to authenticated;
