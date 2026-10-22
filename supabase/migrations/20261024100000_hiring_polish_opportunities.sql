-- Crew Flex — package hiring-polish (v2 diff area 30: v2-20, v2-26, v2-27; owner rule DEFAULTS 2026-10-22).
-- NON-DESTRUCTIVE: `create or replace` of two existing DEFINER functions with the SAME signatures and
-- return types, starting from their current definitions (list_opportunities: 20261023600000, the
-- requirement-builder projection; apply_to_requirement: 20261022130300). No table, column, policy or grant
-- changes beyond re-stating the existing grants.
--
-- 1. list_opportunities (was 20261023600000):
--    * v2-20 «Ofertas en la red» (v1.8 `Marketplace.jsx:43` without the commission): callers that are a
--      member of an organization may list too — the SAME fixed projection professionals see (organization
--      name, no ids of people or organizations, no counts). Eligibility is not computed for them (the
--      Edge Function's `view=network`). Anyone with neither a technician profile nor a membership: 42501.
--    * v2-27 (T-90, conservative default): the caller's own organizations' requirements are never listed
--      — not as an opportunity (a member does not apply to its own organization) and not in the network
--      view (they are in «Ofertas y cobertura»).
--    * v2-26 (T-91): the literal search also matches the required qualifications' code and name (the
--      placeholder promises «Aeronave»: type ratings such as TR-A320 are qualifications).
-- 2. apply_to_requirement (was 20261022130300): every rule kept; v2-27 adds CFA13 OWN_ORGANIZATION,
--    raised after every existing check, for a member (any role) of the requirement's organization.

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
         c.conditions, count(*) over ()
  from app_private.requirement_cards c
  where c.status = 'open'
    and c.ends_at > now()
    and (p_id is null or c.id = p_id)
    and (p_urgency is null or c.urgency = p_urgency)
    -- v2-27 (T-90): never a requirement of one of the caller's own organizations.
    and not exists (
      select 1
      from public.work_requirements wr_own
      join public.organization_members om on om.organization_id = wr_own.organization_id
      where wr_own.id = c.id and om.profile_id = v_uid)
    and (v_q is null
         or strpos(lower(c.title), v_q) > 0
         or strpos(lower(c.location), v_q) > 0
         or strpos(lower(c.organization_name), v_q) > 0
         -- v2-26 (T-91): the required qualifications' code or name (TR-A320, «Airbus A320 family», …).
         or exists (
           select 1 from jsonb_array_elements(c.qualifications) rq
           where strpos(lower(rq ->> 'code'), v_q) > 0 or strpos(lower(rq ->> 'name'), v_q) > 0))
  order by c.starts_at, c.id
  limit least(greatest(coalesce(p_limit, 200), 1), 200);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Apply (∅ → received), unchanged from 20261022130300 except the last check (CFA13, v2-27/T-90): a
-- member of the requirement's organization — whatever their role — does not apply to it. v1.8 has no
-- such case (its technicians are not organization members); the conservative default refuses it, and
-- list_opportunities no longer offers the requirement. Checked after every existing reason so those
-- keep their precedence; an idempotent replay still returns its own earlier result.
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

-- `create or replace` keeps the existing privileges; re-stated so this file reads on its own.
revoke execute on function
  public.list_opportunities(uuid, public.requirement_urgency, text, integer),
  public.apply_to_requirement(uuid, uuid, boolean, uuid)
from public, anon;
grant execute on function
  public.list_opportunities(uuid, public.requirement_urgency, text, integer),
  public.apply_to_requirement(uuid, uuid, boolean, uuid)
to authenticated;
