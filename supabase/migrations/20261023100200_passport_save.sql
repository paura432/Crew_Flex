-- Crew Flex — atomic save of the whole v1.8 passport (package passport; extends I-3).
-- NON-DESTRUCTIVE: adds two functions and their EXECUTE grants. update_professional_profile
-- (20261015130100) is kept unchanged for the deployed `professional-profile` until it is redeployed.
--
-- save_professional_passport(p_passport, p_expected_updated_at) writes, in ONE transaction, the
-- caller's profiles.display_name, technician_profiles (V0 columns + declarations), the private row,
-- the blocked organizations and the declared type ratings — full replacement, like the form.
-- Optimistic concurrency as before: technician_profiles.updated_at must equal p_expected_updated_at
-- (milliseconds) or nothing is written (CF412 → 409). Every save updates technician_profiles, so the
-- version moves even when only a child row changed.
--
-- SECURITY DEFINER (S-10) because the new columns and tables have NO write grant: this function is
-- their only writer. The body therefore is the authorization: the caller must be signed in and own a
-- technician profile (42501 otherwise), and every statement is keyed by auth.uid() — no id from the
-- payload selects a row. The payload is the Edge Function's validated input (strict Zod,
-- src/lib/validation/professional.ts `passportPayload`); this body re-checks what the CHECKs cannot:
-- the exact key set, duplicates, the 40 / 200 caps and that a rating uses a declared aircraft and
-- category (22023). Organization ids only need to exist (FK, 23503). The blocked organization is not
-- told (no event, no row it can read); it can still infer a block from its own pool (residual risk,
-- SECURITY_PRIVACY T9). `p_expected_updated_at` NULL skips the version check, as before (own rows only).

create function public.save_professional_passport(
  p_passport jsonb,
  p_expected_updated_at timestamptz default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_keys constant text[] := array[
    'displayName', 'baseLocation', 'mobility', 'yearsExperience', 'currentStatus', 'visibility',
    'primaryCategory', 'categories', 'aircraft', 'engines', 'skills', 'englishLevel', 'ownTools',
    'baseCountry', 'workPermits', 'generalRestrictions', 'typeRatings',
    'phone', 'currentEmployerId', 'minRate', 'rateUnit', 'blockedOrganizationIds'];
  v_rating_keys constant text[] := array['aircraft', 'category', 'expiresAt', 'restrictions'];
  v_current timestamptz;
  v_updated timestamptz;
  v_categories text[];
  v_aircraft text[];
  v_engines text[];
  v_skills text[];
  v_permits text[];
  v_blocks uuid[];
  v_ratings jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if jsonb_typeof(p_passport) is distinct from 'object'
     or not (p_passport ?& v_keys)
     or exists (select 1 from jsonb_object_keys(p_passport) k where k <> all (v_keys)) then
    raise exception using errcode = '22023', message = 'the passport must carry exactly its fields';
  end if;

  -- Own rows only, locked for the rest of the transaction. Not a professional → no row.
  select tp.updated_at into v_current
  from public.technician_profiles tp
  join public.profiles p on p.id = tp.profile_id
  where tp.profile_id = v_uid
  for update of tp, p;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_expected_updated_at is not null
     and date_trunc('milliseconds', v_current) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'profile was modified by another session';
  end if;

  -- Lists: a JSON array of strings (anything else raises 22023), kept in the given order, no repeats.
  v_categories := array(select jsonb_array_elements_text(p_passport -> 'categories'));
  v_aircraft := array(select jsonb_array_elements_text(p_passport -> 'aircraft'));
  v_engines := array(select jsonb_array_elements_text(p_passport -> 'engines'));
  v_skills := array(select jsonb_array_elements_text(p_passport -> 'skills'));
  v_permits := array(select jsonb_array_elements_text(p_passport -> 'workPermits'));
  v_blocks := array(select x::uuid from jsonb_array_elements_text(p_passport -> 'blockedOrganizationIds') x);
  v_ratings := p_passport -> 'typeRatings';
  if jsonb_typeof(v_ratings) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'typeRatings must be a list';
  end if;
  if exists (
       select 1 from (values (v_categories), (v_aircraft), (v_engines), (v_skills), (v_permits)) l(v)
       where cardinality(l.v) <> (select count(distinct x) from unnest(l.v) x))
     or cardinality(v_blocks) <> (select count(distinct x) from unnest(v_blocks) x) then
    raise exception using errcode = '22023', message = 'a list repeats a value';
  end if;
  if cardinality(v_blocks) > 200 or jsonb_array_length(v_ratings) > 40 then
    raise exception using errcode = '22023', message = 'too many blocked organizations or ratings';
  end if;
  if exists (
       select 1 from jsonb_array_elements(v_ratings) e
       where jsonb_typeof(e) is distinct from 'object'
          or not (e ?& v_rating_keys)
          or exists (select 1 from jsonb_object_keys(e) k where k <> all (v_rating_keys))
          or not (e ->> 'aircraft' = any (v_aircraft))
          or not (e ->> 'category' = any (v_categories)))
     or (select count(*) from jsonb_array_elements(v_ratings))
        <> (select count(distinct (e ->> 'aircraft', e ->> 'category')) from jsonb_array_elements(v_ratings) e) then
    raise exception using errcode = '22023', message = 'a rating needs a declared aircraft and category, once';
  end if;

  update public.profiles
  set display_name = btrim(p_passport ->> 'displayName')
  where id = v_uid;

  update public.technician_profiles
  set base_location = nullif(btrim(p_passport ->> 'baseLocation'), ''),
      mobility = (p_passport ->> 'mobility')::public.mobility,
      years_experience = (p_passport ->> 'yearsExperience')::integer,
      current_status = (p_passport ->> 'currentStatus')::public.technician_status,
      visibility = (p_passport ->> 'visibility')::public.profile_visibility,
      primary_category = p_passport ->> 'primaryCategory',
      categories = v_categories,
      aircraft = v_aircraft,
      engines = v_engines,
      skills = v_skills,
      english_level = p_passport ->> 'englishLevel',
      own_tools = (p_passport -> 'ownTools')::boolean,
      base_country = p_passport ->> 'baseCountry',
      work_permits = v_permits,
      general_restrictions = nullif(btrim(p_passport ->> 'generalRestrictions'), '')
  where profile_id = v_uid
  returning updated_at into v_updated;

  insert into public.technician_private_details as d
    (profile_id, phone, current_employer_id, min_rate, rate_unit)
  values (
    v_uid,
    nullif(btrim(p_passport ->> 'phone'), ''),
    (p_passport ->> 'currentEmployerId')::uuid,
    (p_passport ->> 'minRate')::numeric,
    p_passport ->> 'rateUnit')
  on conflict (profile_id) do update
  set phone = excluded.phone,
      current_employer_id = excluded.current_employer_id,
      min_rate = excluded.min_rate,
      rate_unit = excluded.rate_unit;

  delete from public.technician_organization_blocks b
  where b.technician_profile_id = v_uid and b.organization_id <> all (v_blocks);
  insert into public.technician_organization_blocks (technician_profile_id, organization_id)
  select v_uid, x from unnest(v_blocks) x
  on conflict do nothing;

  delete from public.technician_type_ratings r
  where r.technician_profile_id = v_uid
    and not exists (
      select 1 from jsonb_array_elements(v_ratings) e
      where e ->> 'aircraft' = r.aircraft and e ->> 'category' = r.category);
  insert into public.technician_type_ratings as r
    (technician_profile_id, aircraft, category, expires_at, restrictions)
  select v_uid, e ->> 'aircraft', e ->> 'category', (e ->> 'expiresAt')::date,
         nullif(btrim(e ->> 'restrictions'), '')
  from jsonb_array_elements(v_ratings) e
  on conflict (technician_profile_id, aircraft, category) do update
  set expires_at = excluded.expires_at,
      restrictions = excluded.restrictions;

  return v_updated;
end;
$$;

-- The organizations a professional can tick in «Organizaciones bloqueadas» / «Empresa actual».
-- Professionals only (a technician profile exists), 42501 otherwise. Minimal output: id and name.
-- NOT the whole directory (v1.8 connected lists every organization; security review MEDIUM-1: anyone
-- can sign up as a professional): only organizations that have published a requirement at least once
-- (status other than `draft` — the ones that can ever run matching on the professional and whose name
-- the network has seen through the opportunities), the caller's own memberships, and whatever the
-- caller already blocked or named as employer. Those last two come first, so the cap can never hide
-- (and a full-replacement save silently drop) one the professional chose. Organization ids are exposed
-- for that subset only; they open nothing without membership (RLS). T-35.
-- ponytail: at most 500 rows; search instead of a list when the network outgrows it.
create function public.list_blockable_organizations()
returns table (id uuid, name text)
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
  return query
  with chosen as (
    select b.organization_id as id from public.technician_organization_blocks b
    where b.technician_profile_id = v_uid
    union
    select d.current_employer_id from public.technician_private_details d
    where d.profile_id = v_uid and d.current_employer_id is not null
  )
  select o.id, o.name
  from public.organizations o
  where o.id in (select c.id from chosen c)
     or exists (select 1 from public.organization_members om
                where om.organization_id = o.id and om.profile_id = v_uid)
     or exists (select 1 from public.work_requirements wr
                where wr.organization_id = o.id and wr.status <> 'draft')
  order by (o.id in (select c.id from chosen c)) desc, o.name, o.id
  limit 500;
end;
$$;

revoke execute on function
  public.save_professional_passport(jsonb, timestamptz),
  public.list_blockable_organizations()
from public, anon;
grant execute on function
  public.save_professional_passport(jsonb, timestamptz),
  public.list_blockable_organizations()
to authenticated;
