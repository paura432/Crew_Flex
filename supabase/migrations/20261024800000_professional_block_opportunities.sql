-- Crew Flex — package professional-block (v2 diff area 30 «Backlog derivado» v2-16 «Bloqueo de empleador», MKT-01 #27,
-- MKT-03 #4; BUSINESS_RULES BR-14 / BR-15 / BR-18, technical default T-160). v1.8 `profile.blocked` /
-- `blockEmployer` (`server/app.mjs:50-58,107`; the connected apply throws «Esta organización está bloqueada.»).
--
-- The professional's blocked organizations (`technician_organization_blocks`, written only by the passport save,
-- 20261023100100/100200) already keep the professional out of those organizations' external pools, counts, directory
-- and outreach audience (20261023100300, 20261023600100, 20261023900100, 20261024400200, 20261024600000). This file
-- makes the block symmetric on the professional's side, as v1.8 does:
--   (a) list_opportunities — a blocked organization's needs are not listed (not in «Oportunidades», not in «Ofertas en
--       la red» for a member who blocked it, and the detail by id is absent — the Edge Function answers 404);
--   (b) apply_to_requirement — applying to a blocked organization's need is refused with CFA16 ORGANIZATION_BLOCKED,
--       checked right after the requirement's state (CFA01/CFA02) and before the application history and the
--       eligibility, the v1.8 order (`uo`/«Ya existe una candidatura activa» come after the block there);
--   (c) get_requirement_profile_rules — the professional-side rules follow the same reading rule: a published need of
--       a blocked organization is absent, one the professional already applied to is still readable (that
--       application stays, as every existing one does — the block never touches applications).
-- One predicate for the three: app_private.technician_blocks_organization(profile, organization), a STABLE private
-- helper with no API grant. The three pool bodies keep their inline `not exists` copy on purpose: the directory
-- package (20261024700000, pending integration) re-creates them, and a later file that rewrote them would silently
-- undo it; they can adopt the helper in the package that next touches them.
--
-- NON-DESTRUCTIVE: one private helper and `create or replace` of three existing DEFINER functions with the SAME
-- signatures, return types and privileges — list_opportunities from its current body (20261024500100),
-- apply_to_requirement from 20261024100000, get_requirement_profile_rules from 20261023900100 — each with one
-- predicate added. No table, column, policy, grant or data is removed. Authorization is unchanged: auth.uid() and
-- the role from the database in each body; the block is read for the caller only (nobody can ask about another
-- professional's blocks through these functions).

-- ---------------------------------------------------------------------------------------------
-- 1. The predicate. SECURITY INVOKER: called from the DEFINER bodies below it reads as their owner; a user could
--    read only their own rows anyway (RLS), and the API roles cannot execute it at all (app_private is not exposed).
-- ---------------------------------------------------------------------------------------------
create function app_private.technician_blocks_organization(p_profile_id uuid, p_organization_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.technician_organization_blocks b
    where b.technician_profile_id = p_profile_id and b.organization_id = p_organization_id);
$$;
revoke execute on function app_private.technician_blocks_organization(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. list_opportunities: the 20261024500100 body + «never a need of an organization the caller blocked».
-- ---------------------------------------------------------------------------------------------
create or replace function public.list_opportunities(
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
  client_name text,
  total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_q text := lower(left(nullif(btrim(coalesce(p_q, '')), ''), 80));
begin
  -- Professionals (D-12) and organization members (v2-20); nobody else.
  if v_uid is null or not (
       exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid)
       or exists (select 1 from public.organization_members om where om.profile_id = v_uid)
     ) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  select c.id, c.organization_name, c.title, c.location, c.starts_at, c.ends_at, c.shift, c.headcount,
         c.urgency, c.created_at, c.qualifications, c.country, c.timezone, c.description, c.shifts,
         c.conditions, rc.name, count(*) over ()
  from app_private.requirement_cards c
  join public.work_requirements wr on wr.id = c.id
  left join public.represented_clients rc on rc.id = wr.on_behalf_of_client_id
  where c.status = 'open'
    and c.ends_at > now()
    and (p_id is null or c.id = p_id)
    and (p_urgency is null or c.urgency = p_urgency)
    -- recruiter (R4, T-133): only while the representation is active.
    and (wr.on_behalf_of_client_id is null or rc.status = 'active')
    -- v2-27 (T-90): never a requirement of one of the caller's own organizations.
    and not exists (
      select 1
      from public.work_requirements wr_own
      join public.organization_members om on om.organization_id = wr_own.organization_id
      where wr_own.id = c.id and om.profile_id = v_uid)
    -- v2-16 (T-160): never a requirement of an organization the caller blocked (passport, N-08).
    and not app_private.technician_blocks_organization(v_uid, wr.organization_id)
    and (v_q is null
         or strpos(lower(c.title), v_q) > 0
         or strpos(lower(c.location), v_q) > 0
         or strpos(lower(c.organization_name), v_q) > 0
         or strpos(lower(coalesce(rc.name, '')), v_q) > 0
         -- v2-26 (T-91): the required qualifications' code or name (TR-A320, «Airbus A320 family», …).
         or exists (
           select 1 from jsonb_array_elements(c.qualifications) rq
           where strpos(lower(rq ->> 'code'), v_q) > 0 or strpos(lower(rq ->> 'name'), v_q) > 0))
  order by c.starts_at, c.id
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. apply_to_requirement: the 20261024100000 body + CFA16 ORGANIZATION_BLOCKED after the requirement's state.
--    An idempotent replay still returns its own earlier result (the key is claimed before every check, as before).
-- ---------------------------------------------------------------------------------------------
create or replace function public.apply_to_requirement(
  p_requirement_id uuid,
  p_idempotency_key uuid,
  p_share_consent boolean,
  p_request_id uuid default null
)
returns table (id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_req public.work_requirements%rowtype;
  v_id uuid;
  v_ok record;
begin
  if v_uid is null
     or not exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key is required';
  end if;
  if p_share_consent is distinct from true then
    raise exception using errcode = '22023', message = 'the share consent is required';
  end if;

  select * into v_req from public.work_requirements wr where wr.id = p_requirement_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'requirement not found';
  end if;

  v_id := app_private.claim_idempotency_key('application.create', p_idempotency_key,
    jsonb_build_object('requirement_id', p_requirement_id));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  if v_req.status <> 'open' then
    raise exception using errcode = 'CFA01', message = 'the requirement is not open';
  end if;
  if v_req.starts_at <= now() then
    raise exception using errcode = 'CFA02', message = 'the requirement has started';
  end if;
  -- v2-16 (T-160, v1.8 «Esta organización está bloqueada.»): the applicant blocked this organization. Before the
  -- application history and the eligibility, as v1.8 checks it; the professional's own block, so nothing is revealed.
  if app_private.technician_blocks_organization(v_uid, v_req.organization_id) then
    raise exception using errcode = 'CFA16', message = 'the organization is blocked by the applicant';
  end if;
  if exists (
    select 1 from public.applications a
    where a.requirement_id = v_req.id and a.technician_profile_id = v_uid
      and a.status in ('received', 'shortlisted', 'proposed', 'accepted', 'confirmed')
  ) then
    raise exception using errcode = 'CFA09', message = 'an application is already active';
  end if;
  if exists (
    select 1 from public.applications a
    where a.requirement_id = v_req.id and a.technician_profile_id = v_uid
      and a.status in ('rejected', 'cancelled', 'finished')
  ) then
    raise exception using errcode = 'CFA10', message = 'applying again is not allowed';
  end if;
  select * into v_ok from app_private.hard_eligibility(v_req.id, v_uid);
  if not coalesce(v_ok.qualifications_ok, false) then
    raise exception using errcode = 'CFA03', message = 'a hard qualification is not valid';
  end if;
  if not coalesce(v_ok.availability_ok, false) then
    raise exception using errcode = 'CFA04', message = 'availability does not cover the period';
  end if;
  -- v2-27 (T-90): not to a requirement of the applicant's own organization.
  if exists (
    select 1 from public.organization_members om
    where om.organization_id = v_req.organization_id and om.profile_id = v_uid
  ) then
    raise exception using errcode = 'CFA13', message = 'the requirement belongs to an own organization';
  end if;

  insert into public.applications (requirement_id, technician_profile_id)
  values (v_req.id, v_uid)
  returning id into v_id;
  insert into public.application_events (application_id, seq, from_status, to_status, actor)
  values (v_id, 1, null, 'received', 'technician');
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'application.received', 'application', v_id,
    jsonb_build_object('from', null, 'to', 'received', 'actor', 'technician', 'requirement_id', v_req.id,
                       'proposal_version', null, 'reason_provided', false, 'share_consent', true,
                       'request_id', p_request_id));
  perform app_private.complete_idempotency_key('application.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. get_requirement_profile_rules: the 20261023900100 body; the «published and current» branch also requires that
--    the caller did not block the organization (the same set list_opportunities shows). The «applied to» branch is
--    unchanged: own applications keep their rules (the applications function treats a missing set as an invariant
--    failure).
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_requirement_profile_rules(p_requirement_ids uuid[])
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
    and ((wr.status = 'open' and wr.ends_at > now()
          -- v2-16 (T-160): what list_opportunities shows — never a blocked organization's need.
          and not app_private.technician_blocks_organization(v_uid, wr.organization_id))
         or exists (select 1 from public.applications a
                    where a.requirement_id = wr.id and a.technician_profile_id = v_uid))
  order by wr.id;
end;
$$;

-- `create or replace` keeps the existing privileges; re-stated so this file reads on its own.
revoke execute on function
  public.list_opportunities(uuid, public.requirement_urgency, text, integer),
  public.apply_to_requirement(uuid, uuid, boolean, uuid),
  public.get_requirement_profile_rules(uuid[])
from public, anon;
grant execute on function
  public.list_opportunities(uuid, public.requirement_urgency, text, integer),
  public.apply_to_requirement(uuid, uuid, boolean, uuid),
  public.get_requirement_profile_rules(uuid[])
to authenticated;
