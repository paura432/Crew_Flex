-- Crew Flex — package recruiter: requirements on behalf of a represented client (v2-24, ORG-02 #20, ORG-08 #5-#7,
-- MKT-04 #7, HIRE-05 #13; RECRUITER_MODEL §1 «Requirement on behalf of a client»; BUSINESS_RULES BR-27, T-132…T-135).
-- NON-DESTRUCTIVE:
--   * one nullable column `work_requirements.on_behalf_of_client_id` (no INSERT/UPDATE grant: only the RPCs below
--     write it), its index, two trigger functions on `work_requirements` (the rules, the audit) and one on
--     `applications`;
--   * NEW overloads of create_work_requirement / create_work_requirement_idempotent / update_work_requirement with
--     one more argument (`p_on_behalf_of_client_id`). They CALL the 20261023600100 overloads, whose bodies and
--     rules are unchanged; the old signatures stay for the functions already deployed;
--   * list_opportunities (20261024100000, hiring-polish) gains one column, `client_name`, and hides a requirement
--     whose representation is no longer active. PostgreSQL changes a return type only through drop + create (as
--     20261023600000 did): same signature, same body plus the client, same grants re-applied in this transaction.
-- No table, column, policy, grant or data is removed.
--
-- Rules (BEFORE ROW triggers, so they hold for every write path, direct PostgREST included):
--   R1 a client set on a requirement is a representation OF THAT organization and `active` (22023 / CFR02);
--   R2 the client changes only while the requirement is a draft (55000 afterwards; CFA12 once applied to, the M05
--      rule): the client a professional reads on a published requirement is the one who receives the data;
--   R3 a staffing agency publishes (insert as non-draft, draft → open), resumes (paused → open) or keeps published
--      only with a client (CFR01) whose representation is active (CFR02); pausing, closing, archiving and the
--      automatic covered ↔ open are never refused for it (a winding-down agency must be able to stop);
--   R4 while the representation is not active, nobody takes a forward step for that client: no application
--      (received), no shortlist, proposal, acceptance or confirmation (CFR02). Withdraw, reject, cancel and finish
--      stay possible.
-- The representation row is share-locked by every check, so a concurrent revocation waits for the action to commit
-- (and the action, if it comes second, sees the revocation).
-- How the create RPC (SECURITY INVOKER, no grant on the column) hands the client to the INSERT: the transaction-local
-- setting `crewflex.requirement_client`, read and applied by the BEFORE INSERT trigger — the pattern of
-- `crewflex.system_status` (20261022130300): API clients cannot call set_config (pg_catalog is not exposed), and the
-- RPC clears it right after its insert.

alter table public.work_requirements
  add column on_behalf_of_client_id uuid references public.represented_clients (id);
create index work_requirements_client_idx on public.work_requirements (on_behalf_of_client_id)
  where on_behalf_of_client_id is not null;

-- ---------------------------------------------------------------------------------------------
-- R1 + R2 + R3 (BEFORE ROW).
-- ---------------------------------------------------------------------------------------------
create function public.guard_requirement_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client public.represented_clients%rowtype;
  v_handed text;
  v_changed boolean := true; -- an INSERT sets the client
  v_publishes boolean;
begin
  -- No oracle (security review LOW-1): a BEFORE ROW trigger runs before the RLS WITH CHECK, so for an API caller who
  -- may not write this organization's requirements the rules stay silent and RLS gives its usual answer (42501)
  -- whatever the type or the client — the pattern of guard_requirement_with_applications. The owner (no JWT) is
  -- always judged.
  if (select auth.uid()) is not null
     and not public.has_org_role(new.organization_id, array['admin', 'manager']::public.organization_role[]) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    v_handed := nullif(current_setting('crewflex.requirement_client', true), '');
    if v_handed is not null then
      new.on_behalf_of_client_id := v_handed::uuid;
    end if;
    v_publishes := new.status <> 'draft';
  else
    v_changed := new.on_behalf_of_client_id is distinct from old.on_behalf_of_client_id;
    v_publishes := new.status = 'open' and old.status in ('draft', 'paused');
    if v_changed then
      if old.status = 'closed' then
        raise exception 'a closed requirement cannot be changed' using errcode = '55000';
      end if;
      -- The client a professional reads on a published requirement is the one who receives the data: it changes
      -- only while the requirement is a draft (security review LOW-2; T-132).
      if old.status <> 'draft' then
        raise exception 'the client of a published requirement cannot change' using errcode = '55000';
      end if;
      -- The row is locked by this UPDATE, so apply (which locks it too) cannot slip in between.
      if exists (select 1 from public.applications a where a.requirement_id = old.id) then
        raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
      end if;
    end if;
  end if;

  if new.on_behalf_of_client_id is null then
    if (v_publishes or (v_changed and new.status not in ('draft', 'closed', 'cancelled')))
       and exists (select 1 from public.organizations o
                   where o.id = new.organization_id and o.type = 'staffing_agency') then
      raise exception using errcode = 'CFR01', message = 'a staffing agency publishes for a represented client';
    end if;
  elsif v_changed or v_publishes then
    select * into v_client from public.represented_clients rc
    where rc.id = new.on_behalf_of_client_id
    for share;
    if not found or v_client.agency_id <> new.organization_id then
      raise exception using errcode = '22023', message = 'the client is not represented by this organization';
    end if;
    if v_client.status <> 'active' then
      raise exception using errcode = 'CFR02', message = 'the representation of this client is not active';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_requirement_client() from public, anon, authenticated;

-- Sorts after work_requirements_closed_frozen / _status_change, so the existing refusals keep their precedence.
create trigger work_requirements_with_client
  before insert or update of on_behalf_of_client_id, status on public.work_requirements
  for each row execute function public.guard_requirement_client();

-- Every client set or changed is audited `requirement.client_changed {client_id, previous_client_id}` with the agency
-- as organization (RECRUITER_MODEL §2), whatever the path.
create function public.audit_requirement_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), new.organization_id, 'requirement.client_changed', 'work_requirement', new.id,
          jsonb_build_object('client_id', new.on_behalf_of_client_id,
                             'previous_client_id', case when tg_op = 'UPDATE' then old.on_behalf_of_client_id end));
  return null;
end;
$$;
revoke execute on function public.audit_requirement_client() from public, anon, authenticated;

create trigger work_requirements_audit_client_insert
  after insert on public.work_requirements
  for each row when (new.on_behalf_of_client_id is not null)
  execute function public.audit_requirement_client();
create trigger work_requirements_audit_client_update
  after update of on_behalf_of_client_id on public.work_requirements
  for each row when (new.on_behalf_of_client_id is distinct from old.on_behalf_of_client_id)
  execute function public.audit_requirement_client();

-- ---------------------------------------------------------------------------------------------
-- R4: no forward step of an application while the requirement's representation is not active.
-- ---------------------------------------------------------------------------------------------
create function public.guard_application_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.representation_status;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status
       or new.status not in ('shortlisted', 'proposed', 'accepted', 'confirmed') then
      return new;
    end if;
  end if;
  select rc.status into v_status
  from public.work_requirements wr
  join public.represented_clients rc on rc.id = wr.on_behalf_of_client_id
  where wr.id = new.requirement_id
  for share of rc;
  if found and v_status <> 'active' then
    -- A new application: the professional learns only that the requirement takes none (CFA01, as a paused one;
    -- security review LOW-3). A forward step: the agency is told why (CFR02).
    if tg_op = 'INSERT' then
      raise exception using errcode = 'CFA01', message = 'the requirement is not open';
    end if;
    raise exception using errcode = 'CFR02', message = 'the representation of this client is not active';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_application_client() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The organization type is not a way around the rules (security review MEDIUM-1): admins hold UPDATE on `type`
-- (foundation). An organization becomes a staffing agency only while it has no published requirement without a
-- client (otherwise an MRO could publish and then turn into an agency — or an agency flip out, publish, flip back),
-- and stops being one only once it has no live (pending/active) client and no published requirement for a client.
-- Drafts, paused and closed requirements do not block (resuming re-applies CFR01/CFR02). 55000, every write path.
-- ---------------------------------------------------------------------------------------------
create function public.guard_organization_type_clients()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'staffing_agency' and exists (
    select 1 from public.work_requirements wr
    where wr.organization_id = new.id and wr.status in ('open', 'covered') and wr.on_behalf_of_client_id is null
  ) then
    raise exception 'close or pause the published requirements without a client first' using errcode = '55000';
  end if;
  if old.type = 'staffing_agency' and (
    exists (select 1 from public.represented_clients rc where rc.agency_id = new.id and rc.status <> 'revoked')
    or exists (select 1 from public.work_requirements wr
               where wr.organization_id = new.id and wr.status in ('open', 'covered')
                 and wr.on_behalf_of_client_id is not null)
  ) then
    raise exception 'revoke the clients and close their published requirements first' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_organization_type_clients() from public, anon, authenticated;

create trigger organizations_type_clients
  before update of type on public.organizations
  for each row when (old.type is distinct from new.type
                     and (old.type = 'staffing_agency' or new.type = 'staffing_agency'))
  execute function public.guard_organization_type_clients();

create trigger applications_client_active
  before insert or update of status on public.applications
  for each row execute function public.guard_application_client();

-- ---------------------------------------------------------------------------------------------
-- Create with the client (SECURITY INVOKER, as the overload it calls: the insert policy still decides who creates;
-- the triggers above judge the client).
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
  p_on_behalf_of_client_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform set_config('crewflex.requirement_client', coalesce(p_on_behalf_of_client_id::text, ''), true);
  v_id := public.create_work_requirement(p_organization_id, p_title, p_location, p_starts_at, p_ends_at,
    p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions);
  perform set_config('crewflex.requirement_client', '', true);
  return v_id;
end;
$$;

-- Idempotent wrapper (I-1). Without a client the request identity is EXACTLY the one of the 20261023600100 wrapper,
-- so a retry that crosses a deploy keeps its key; with a client, the client is part of it.
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
  p_on_behalf_of_client_id uuid
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
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
            else jsonb_build_object('on_behalf_of_client_id', p_on_behalf_of_client_id) end);
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  v_id := public.create_work_requirement(p_organization_id, p_title, p_location, p_starts_at, p_ends_at,
    p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions, p_on_behalf_of_client_id);
  perform app_private.complete_idempotency_key('work_requirement.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Edit with the client (DEFINER, admin/manager in the body as the overload it calls). Full replacement: NULL = no
-- client. A changed client is checked here as the other fields are (closed 55000, applications CFA12, version
-- CF412) and written FIRST, so publishing a draft sees its new client; then the 20261023600100 overload applies
-- every other rule against the version this transaction just wrote (the row stays locked until commit).
-- `changed` gains `onBehalfOfClientId`.
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
  p_on_behalf_of_client_id uuid
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
  v_client_changed boolean;
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

  v_client_changed := p_on_behalf_of_client_id is distinct from v_req.on_behalf_of_client_id;
  if v_client_changed then
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
    -- R1/R3 are the trigger's (22023, CFR01, CFR02); audited by it too.
    update public.work_requirements wr
    set on_behalf_of_client_id = p_on_behalf_of_client_id
    where wr.id = p_id
    returning wr.updated_at into v_expected;
  end if;

  select * into v_result from public.update_work_requirement(p_id, v_expected, p_title, p_location, p_starts_at,
    p_ends_at, p_shift, p_headcount, p_urgency, p_qualifications, p_status, p_country, p_time_zone, p_description,
    p_shifts, p_conditions);

  return query select v_result.id, v_result.updated_at,
    case when v_client_changed then v_result.changed || 'onBehalfOfClientId'::text else v_result.changed end;
end;
$$;

revoke execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer,
    public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid),
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid),
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid)
from public, anon;
grant execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer,
    public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid),
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid),
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz, public.shift_type,
    integer, public.requirement_urgency, jsonb, public.requirement_status, text, text, text, jsonb, jsonb, uuid)
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- list_opportunities (20261024100000) + `client_name` (MKT-04 #7, ORG-08 #6: «Publicada por {org} para el cliente
-- {cliente}», what the professional must know before consenting — RECRUITER_MODEL §2). A requirement whose
-- representation is not active is not listed (R4: nobody may apply to it). The search also matches the client's
-- name, which the card shows. Everything else — authorization, own organizations hidden (T-90), the qualification
-- search (T-91), order, cap, the 16 other columns — is the hiring-polish body unchanged. Still no ids of people or
-- organizations; never the client's contact e-mail.
-- ---------------------------------------------------------------------------------------------
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

revoke execute on function public.list_opportunities(uuid, public.requirement_urgency, text, integer)
from public, anon;
grant execute on function public.list_opportunities(uuid, public.requirement_urgency, text, integer)
to authenticated;
