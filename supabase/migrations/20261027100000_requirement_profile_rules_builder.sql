-- Crew Flex — F3 P10 «Needs and matching»: the requirement builder writes the v1.8 profile requirements
-- (inventory 30 ORG-02 #11 «Categoría», #12 «Aeronaves aceptadas», #13 «Exigir habilitación de tipo», #14 «Motores»,
-- #16 «Capacidades obligatorias», #19 «Experiencia mínima»; ORG-03 #19). The six columns and their CHECKs exist
-- since 20261023900000 (matching-v18, T-80…T-87) and the engine already applies them (BR-3.7–3.13, SQL mirror
-- app_private.profile_rules_ok); until now «nobody through the API» could set them (BR-3 note, T-86).
-- NON-DESTRUCTIVE:
--   * one normalisation helper (app_private.normalize_text_array) and one BEFORE INSERT trigger that applies the rules
--     an INVOKER create hands over through the transaction-local setting `crewflex.requirement_profile_rules` — the
--     pattern of `crewflex.requirement_client` (20261024500100): API clients cannot call set_config (pg_catalog is not
--     exposed) and the RPC clears it right after its insert. The columns keep having NO INSERT/UPDATE grant: direct
--     PostgREST writes still cannot touch them;
--   * NEW overloads of create_work_requirement / create_work_requirement_idempotent / update_work_requirement with six
--     more arguments (`p_category, p_aircraft, p_requires_type_rating, p_engines, p_min_years, p_required_skills`,
--     full replacement: NULL / empty = «not required», exactly the column defaults). They CALL the 20261024500100
--     overloads, whose bodies and rules are unchanged; the old signatures stay for the functions already deployed.
-- No table, column, policy, grant or data is removed. Every existing row keeps «no profile requirement».
--
-- Rules that already hold and are NOT repeated here: the CHECK constraints of 20261023900000 (12 categories, 12
-- aircraft, 7 engines, 9 capabilities, 0–60 years, a type rating only for a licence category with ≥ 1 aircraft —
-- T-83); both freeze guards (closed: 55000; after the first application: CFA12) cover the six columns. The live count
-- (count_viable_candidates, T-66) keeps taking the country only (T-86: adding the other rules needs the minimum-count
-- floor of the security review, MEDIUM-1 / LOW-2); the form says so next to the number.

-- ---------------------------------------------------------------------------------------------
-- Helper: a text[] as the columns store it — distinct values, sorted, never NULL.
-- ---------------------------------------------------------------------------------------------
create function app_private.normalize_text_array(p_values text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(select distinct v from unnest(p_values) v where v is not null order by v), '{}'::text[]);
$$;
-- Pure and side-effect free: executable by the API role, as the normalise helpers of 20261023600000 (the INVOKER
-- create and the trigger run as the caller).
revoke execute on function app_private.normalize_text_array(text[]) from public, anon;
grant execute on function app_private.normalize_text_array(text[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- BEFORE INSERT: apply the rules the INVOKER create handed over (nothing handed → the defaults, as before).
-- ---------------------------------------------------------------------------------------------
create function public.apply_requirement_profile_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_handed jsonb;
begin
  v_handed := nullif(current_setting('crewflex.requirement_profile_rules', true), '')::jsonb;
  if v_handed is null then
    return new;
  end if;
  new.category := nullif(v_handed ->> 'category', '');
  new.aircraft := app_private.normalize_text_array(
    array(select jsonb_array_elements_text(coalesce(v_handed -> 'aircraft', '[]'::jsonb))));
  new.requires_type_rating := coalesce((v_handed ->> 'requires_type_rating')::boolean, false);
  new.engines := app_private.normalize_text_array(
    array(select jsonb_array_elements_text(coalesce(v_handed -> 'engines', '[]'::jsonb))));
  new.min_years := (v_handed ->> 'min_years')::integer;
  new.required_skills := app_private.normalize_text_array(
    array(select jsonb_array_elements_text(coalesce(v_handed -> 'required_skills', '[]'::jsonb))));
  return new;
end;
$$;
revoke execute on function public.apply_requirement_profile_rules() from public, anon, authenticated;

create trigger work_requirements_apply_profile_rules
  before insert on public.work_requirements
  for each row execute function public.apply_requirement_profile_rules();

-- ---------------------------------------------------------------------------------------------
-- Create with the rules (INVOKER: RLS and the 20261024500100 overload decide everything else).
-- ---------------------------------------------------------------------------------------------
create function public.create_work_requirement(
  p_organization_id uuid,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb,
  p_status public.requirement_status,
  p_country text,
  p_time_zone text,
  p_description text,
  p_shifts jsonb,
  p_conditions jsonb,
  p_on_behalf_of_client_id uuid,
  p_category text,
  p_aircraft text[],
  p_requires_type_rating boolean,
  p_engines text[],
  p_min_years integer,
  p_required_skills text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform set_config('crewflex.requirement_profile_rules', jsonb_build_object(
    'category', nullif(btrim(coalesce(p_category, '')), ''),
    'aircraft', to_jsonb(app_private.normalize_text_array(p_aircraft)),
    'requires_type_rating', coalesce(p_requires_type_rating, false),
    'engines', to_jsonb(app_private.normalize_text_array(p_engines)),
    'min_years', p_min_years,
    'required_skills', to_jsonb(app_private.normalize_text_array(p_required_skills)))::text, true);
  v_id := public.create_work_requirement(p_organization_id, p_title, p_location, p_starts_at, p_ends_at,
    p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions, p_on_behalf_of_client_id);
  perform set_config('crewflex.requirement_profile_rules', '', true);
  return v_id;
end;
$$;

-- Idempotent wrapper (I-1). Without any rule the request identity is EXACTLY the one of the 20261024500100 wrapper,
-- so a retry that crosses a deploy keeps its key; with rules, the rules (normalised) are part of it.
create function public.create_work_requirement_idempotent(
  p_idempotency_key uuid,
  p_organization_id uuid,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb,
  p_status public.requirement_status,
  p_country text,
  p_time_zone text,
  p_description text,
  p_shifts jsonb,
  p_conditions jsonb,
  p_on_behalf_of_client_id uuid,
  p_category text,
  p_aircraft text[],
  p_requires_type_rating boolean,
  p_engines text[],
  p_min_years integer,
  p_required_skills text[]
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
  v_aircraft text[] := app_private.normalize_text_array(p_aircraft);
  v_type_rating boolean := coalesce(p_requires_type_rating, false);
  v_engines text[] := app_private.normalize_text_array(p_engines);
  v_skills text[] := app_private.normalize_text_array(p_required_skills);
  v_rules jsonb := '{}'::jsonb;
begin
  if v_category is not null or cardinality(v_aircraft) > 0 or v_type_rating or cardinality(v_engines) > 0
     or p_min_years is not null or cardinality(v_skills) > 0 then
    v_rules := jsonb_build_object('profile_rules', jsonb_build_object(
      'category', v_category, 'aircraft', to_jsonb(v_aircraft), 'requires_type_rating', v_type_rating,
      'engines', to_jsonb(v_engines), 'min_years', p_min_years, 'required_skills', to_jsonb(v_skills)));
  end if;
  v_id := app_private.claim_idempotency_key('work_requirement.create', p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id, 'title', p_title, 'location', p_location,
      'starts_at', p_starts_at at time zone 'UTC', 'ends_at', p_ends_at at time zone 'UTC',
      'shift', p_shift, 'headcount', p_headcount, 'urgency', p_urgency,
      'qualifications', (
        select coalesce(jsonb_agg(q order by q ->> 'qualification_type_id'), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(p_qualifications) = 'array'
                                       then p_qualifications else '[]'::jsonb end) q),
      'status', p_status, 'country', p_country, 'time_zone', p_time_zone,
      'description', nullif(btrim(coalesce(p_description, '')), ''),
      'shifts', app_private.normalize_requirement_shifts(p_shifts),
      'conditions', app_private.normalize_requirement_conditions(p_conditions))
    || case when p_on_behalf_of_client_id is null then '{}'::jsonb
            else jsonb_build_object('on_behalf_of_client_id', p_on_behalf_of_client_id) end
    || v_rules);
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  v_id := public.create_work_requirement(p_organization_id, p_title, p_location, p_starts_at, p_ends_at,
    p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions, p_on_behalf_of_client_id, v_category, v_aircraft, v_type_rating, v_engines,
    p_min_years, v_skills);
  perform app_private.complete_idempotency_key('work_requirement.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Edit with the rules (DEFINER, admin/manager in the body as the overload it calls). Full replacement. Changed
-- rules are checked here as the client is (closed 55000, applications CFA12, version CF412) and written FIRST, so
-- the CHECK of the type rating sees the new category and aircraft together; then the 20261024500100 overload
-- applies every other rule against the version this transaction just wrote (the row stays locked until commit).
-- `changed` gains the rule fields by their API names; the audit row `requirement.updated` lists them too.
-- ---------------------------------------------------------------------------------------------
create function public.update_work_requirement(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb,
  p_status public.requirement_status,
  p_country text,
  p_time_zone text,
  p_description text,
  p_shifts jsonb,
  p_conditions jsonb,
  p_on_behalf_of_client_id uuid,
  p_category text,
  p_aircraft text[],
  p_requires_type_rating boolean,
  p_engines text[],
  p_min_years integer,
  p_required_skills text[]
)
returns table (id uuid, updated_at timestamptz, changed text[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_req public.work_requirements%rowtype;
  v_expected timestamptz := p_expected_updated_at;
  v_category text := nullif(btrim(coalesce(p_category, '')), '');
  v_aircraft text[] := app_private.normalize_text_array(p_aircraft);
  v_type_rating boolean := coalesce(p_requires_type_rating, false);
  v_engines text[] := app_private.normalize_text_array(p_engines);
  v_skills text[] := app_private.normalize_text_array(p_required_skills);
  v_rule_changes text[] := '{}';
  v_result record;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- The role first, then the lock (security review LOW-1).
  if not public.has_org_role(
       (select wr.organization_id from public.work_requirements wr where wr.id = p_id),
       array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_req from public.work_requirements wr where wr.id = p_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  if v_category is distinct from v_req.category then v_rule_changes := v_rule_changes || 'category'::text; end if;
  if v_aircraft is distinct from app_private.normalize_text_array(v_req.aircraft) then
    v_rule_changes := v_rule_changes || 'aircraft'::text;
  end if;
  if v_type_rating is distinct from v_req.requires_type_rating then
    v_rule_changes := v_rule_changes || 'requiresTypeRating'::text;
  end if;
  if v_engines is distinct from app_private.normalize_text_array(v_req.engines) then
    v_rule_changes := v_rule_changes || 'engines'::text;
  end if;
  if p_min_years is distinct from v_req.min_years then v_rule_changes := v_rule_changes || 'minYears'::text; end if;
  if v_skills is distinct from app_private.normalize_text_array(v_req.required_skills) then
    v_rule_changes := v_rule_changes || 'requiredSkills'::text;
  end if;

  if cardinality(v_rule_changes) > 0 then
    if v_req.status = 'closed' then
      raise exception 'a closed requirement cannot be changed' using errcode = '55000';
    end if;
    if exists (select 1 from public.applications a where a.requirement_id = p_id) then
      raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
    end if;
    if p_expected_updated_at is null
       or date_trunc('milliseconds', v_req.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
      raise exception using errcode = 'CF412', message = 'requirement was modified by another session';
    end if;
    -- The CHECK constraints of 20261023900000 judge the values (23514 → 400).
    update public.work_requirements wr
    set category = v_category, aircraft = v_aircraft, requires_type_rating = v_type_rating,
        engines = v_engines, min_years = p_min_years, required_skills = v_skills
    where wr.id = p_id
    returning wr.updated_at into v_expected;
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (v_uid, v_req.organization_id, 'requirement.updated', 'work_requirement', p_id,
            jsonb_build_object('fields', to_jsonb(v_rule_changes)));
  end if;

  select * into v_result from public.update_work_requirement(p_id, v_expected, p_title, p_location, p_starts_at,
    p_ends_at, p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions, p_on_behalf_of_client_id);

  return query select v_result.id, v_result.updated_at, v_result.changed || v_rule_changes;
end;
$$;

revoke execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer,
    public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid,
    text, text[], boolean, text[], integer, text[]),
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid,
    text, text[], boolean, text[], integer, text[]),
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid,
    text, text[], boolean, text[], integer, text[])
from public, anon;
grant execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer,
    public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid,
    text, text[], boolean, text[], integer, text[]),
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid,
    text, text[], boolean, text[], integer, text[]),
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid,
    text, text[], boolean, text[], integer, text[])
to authenticated;
