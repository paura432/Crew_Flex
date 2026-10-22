-- Crew Flex — applications (M08, D-06 ratified 2026-10-22: Q2–Q6, Q7 = no accepted → rejected, R-08)
-- and the requirement edit (M05: only while it never received an application).
-- NON-DESTRUCTIVE: new enum, three tables (RLS on in this migration), one private table, private
-- helpers, RPCs and triggers; `create or replace` of guard_requirement_status (same signature, every
-- rule of 20261022130100 kept); the idempotency operation CHECK is widened (drop + add, as
-- 20261019160000 did). No DROP of tables, columns or data; existing grants unchanged.
--
-- Contract: docs/product/APPLICATIONS_STATE_MACHINE.md, src/domain/applications.ts (transition table,
-- APPLICATION_CONFLICTS = SQLSTATE CFA01…CFA12 in that order), owner technical defaults T-08…T-14
-- (docs/integration/crewflex-v13/08-product-decisions.md).
--
-- Who reads what:
--   * the technician reads their own applications (RLS) and, through get_my_applications(), the
--     requirement card, current proposal and history;
--   * organizations NEVER read these tables: get_requirement_applications() (admin/manager of the
--     requirement's organization) returns each applicant under the candidate pool's rules — internal
--     members by id and name, everyone else as the per-requirement pseudonym `CF-…` (T-04), the name
--     only for `open` visibility. A `private` professional who applies becomes visible to THAT
--     organization, for THAT requirement, under those rules (S-7, owner D-12/D-06);
--   * platform admins read the rows (support, read-only);
--   * nobody writes them directly: apply_to_requirement() and transition_application() only.
-- Global lock order (deadlock-free): requirement row → application row → technician advisory lock
-- (`availability:<uuid>`, the key availability writes use, 20261019130000).

create type public.application_status as enum (
  'received', 'shortlisted', 'proposed', 'accepted', 'confirmed', 'finished', 'rejected', 'withdrawn', 'cancelled'
);

-- One application = one technician × one requirement × the requirement's single period (Q6).
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.work_requirements (id) on delete cascade,
  technician_profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  status public.application_status not null default 'received',
  current_proposal_id uuid,
  accepted_proposal_id uuid,
  -- Reject/cancel reason (T-10: visible to both parties; never copied into the audit trail).
  reason text check (reason is null or char_length(reason) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_reason_on_reject_or_cancel
    check ((status in ('rejected', 'cancelled')) = (reason is not null)),
  constraint applications_proposal_when_proposed
    check (status not in ('proposed', 'accepted', 'confirmed', 'finished') or current_proposal_id is not null),
  constraint applications_accepted_proposal
    check (status not in ('accepted', 'confirmed', 'finished') or accepted_proposal_id is not null)
);
alter table public.applications enable row level security;

-- Q5 + T-09: one application per technician and requirement, except withdrawn ones (re-applying is
-- allowed only after `withdrawn`; rejected, cancelled and finished keep the door closed).
create unique index applications_one_per_technician
  on public.applications (requirement_id, technician_profile_id) where status <> 'withdrawn';
create index applications_requirement_status_idx on public.applications (requirement_id, status);
create index applications_technician_status_idx on public.applications (technician_profile_id, status);

-- R-08: proposal version n of an application, immutable once written (trigger below). `terms` is the
-- frozen requirement card (T-11: the published terms; no free-text note).
create table public.application_proposals (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  version integer not null check (version >= 1),
  terms jsonb not null check (jsonb_typeof(terms) = 'object'),
  created_at timestamptz not null default now(),
  unique (application_id, version),
  unique (application_id, id)
);
alter table public.application_proposals enable row level security;

-- A proposal always belongs to its own application (deferred: the RPC inserts the proposal and
-- points the application at it in one transaction).
alter table public.applications
  add constraint applications_current_proposal_fk foreign key (id, current_proposal_id)
    references public.application_proposals (application_id, id) deferrable initially deferred,
  add constraint applications_accepted_proposal_fk foreign key (id, accepted_proposal_id)
    references public.application_proposals (application_id, id) deferrable initially deferred;

-- The timeline both parties read (no state is ever deleted). `seq` orders it; no person ids, no text.
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  seq integer not null check (seq >= 1),
  from_status public.application_status,
  to_status public.application_status not null,
  actor text not null check (actor in ('technician', 'organization')),
  proposal_id uuid,
  created_at timestamptz not null default now(),
  unique (application_id, seq),
  foreign key (application_id, proposal_id)
    references public.application_proposals (application_id, id) on delete cascade
);
alter table public.application_events enable row level security;

create trigger applications_set_updated_at before update on public.applications
  for each row execute function public.set_updated_at();

create function public.refuse_application_history_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '55000';
end;
$$;
create trigger application_proposals_immutable before update on public.application_proposals
  for each row execute function public.refuse_application_history_update();
create trigger application_events_immutable before update on public.application_events
  for each row execute function public.refuse_application_history_update();

-- ---------------------------------------------------------------------------------------------
-- RLS and grants. Supabase grants ALL to the API roles by default: revoke, then grant SELECT only.
-- ---------------------------------------------------------------------------------------------
revoke all on table public.applications, public.application_proposals, public.application_events
  from anon, authenticated;
grant select on table public.applications, public.application_proposals, public.application_events
  to authenticated;

create policy applications_select on public.applications for select to authenticated
  using (technician_profile_id = (select auth.uid()) or public.is_platform_admin());
-- Proposals and events inherit the visibility of their application (the subquery runs under RLS).
create policy application_proposals_select on public.application_proposals for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_proposals.application_id));
create policy application_events_select on public.application_events for select to authenticated
  using (exists (select 1 from public.applications a where a.id = application_events.application_id));

-- ---------------------------------------------------------------------------------------------
-- The transition table = APPLICATION_TRANSITIONS (src/domain/applications.ts; rls suite V T1).
-- ---------------------------------------------------------------------------------------------
create table app_private.application_transitions (
  from_status public.application_status not null,
  to_status public.application_status not null,
  actor text not null check (actor in ('technician', 'organization')),
  reason_required boolean not null,
  primary key (from_status, to_status, actor)
);
alter table app_private.application_transitions enable row level security; -- no policy, no grant
revoke all on table app_private.application_transitions from public, anon, authenticated;

insert into app_private.application_transitions (from_status, to_status, actor, reason_required) values
  ('received', 'shortlisted', 'organization', false),
  ('received', 'rejected', 'organization', true),
  ('received', 'withdrawn', 'technician', false),
  ('shortlisted', 'proposed', 'organization', false),
  ('shortlisted', 'rejected', 'organization', true),
  ('shortlisted', 'withdrawn', 'technician', false),
  ('proposed', 'accepted', 'technician', false),
  ('proposed', 'rejected', 'organization', true),
  ('proposed', 'withdrawn', 'technician', false),
  ('accepted', 'proposed', 'organization', false),   -- R-08: a new proposal version
  ('accepted', 'confirmed', 'organization', false),
  ('accepted', 'withdrawn', 'technician', false),
  ('accepted', 'cancelled', 'organization', true),    -- Q2 (Q7: never accepted → rejected)
  ('confirmed', 'finished', 'organization', false),   -- Q4: explicit, after the period
  ('confirmed', 'cancelled', 'organization', true),   -- Q3
  ('confirmed', 'cancelled', 'technician', true);     -- Q3, no penalties

alter table app_private.idempotency_keys
  drop constraint idempotency_keys_operation_check;
alter table app_private.idempotency_keys
  add constraint idempotency_keys_operation_check
  check (operation in ('work_requirement.create', 'availability_window.create', 'qualification.declare',
                       'availability_days.replace', 'document.create',
                       'application.create', 'application.transition'));

-- ---------------------------------------------------------------------------------------------
-- Private helpers (no grants; called by the DEFINER functions below as their owner).
-- ---------------------------------------------------------------------------------------------

-- BR-2/BR-3/BR-4.8 hard filters for ONE professional, the same expressions as
-- app_private.ranked_external_pool (20261019150100), which is deliberately left untouched: rls suite W
-- proves this function, ranked_external_pool.hard_eligible and evaluateMatch().eligible agree.
create function app_private.hard_eligibility(p_requirement_id uuid, p_profile_id uuid)
returns table (qualifications_ok boolean, availability_ok boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  with req as (
    select wr.id, wr.starts_at, wr.ends_at, wr.urgency,
           -- BR-2: valid for the period ⇔ no expiry or expiry on/after the period's last UTC day
           ((wr.ends_at - interval '1 millisecond') at time zone 'UTC')::date as last_day
    from public.work_requirements wr where wr.id = p_requirement_id
  )
  select
    -- every hard type: active, verified, valid for the whole period
    not exists (
      select 1 from public.work_requirement_qualifications rt
      where rt.work_requirement_id = req.id
        and rt.requirement_level = 'hard'
        and not exists (
          select 1 from public.technician_qualifications tq
          where tq.technician_profile_id = p_profile_id
            and tq.qualification_type_id = rt.qualification_type_id
            and tq.status = 'active'
            and tq.verification_status = 'verified'
            and (tq.expires_at is null or tq.expires_at >= req.last_day))),
    -- BR-4 / BR-4.8: (available ∪ aog_only if AOG) − (unavailable ∪ aog_only if not AOG) covers 100 %
    coalesce((
      select coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (
                        where aw.status = 'available'
                           or (aw.status = 'aog_only' and req.urgency = 'aog')),
                      '{}'::tstzmultirange)
           - coalesce(range_agg(tstzrange(aw.starts_at, aw.ends_at)) filter (
                        where aw.status = 'unavailable'
                           or (aw.status = 'aog_only' and req.urgency <> 'aog')),
                      '{}'::tstzmultirange)
      from public.availability_windows aw
      where aw.technician_profile_id = p_profile_id
        and aw.starts_at < req.ends_at and aw.ends_at > req.starts_at
    ) @> tstzrange(req.starts_at, req.ends_at), false)
  from req;
$$;

-- { id, version, createdAt, terms } of one proposal, or NULL.
create function app_private.proposal_json(p_proposal_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'version', p.version,
    'createdAt', to_char(p.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'terms', p.terms)
  from public.application_proposals p where p.id = p_proposal_id;
$$;

-- The application's timeline, oldest first: [{ from, to, actor, at, proposalVersion }].
create function app_private.application_history(p_application_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'from', e.from_status,
           'to', e.to_status,
           'actor', e.actor,
           'at', to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'proposalVersion', p.version
         ) order by e.seq), '[]'::jsonb)
  from public.application_events e
  left join public.application_proposals p on p.id = e.proposal_id
  where e.application_id = p_application_id;
$$;

revoke execute on function
  app_private.hard_eligibility(uuid, uuid),
  app_private.proposal_json(uuid),
  app_private.application_history(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Requirement status with applications (replaces the body of 20261022130100; same rules plus):
--   * open → covered and covered → open happen ONLY inside transition_application(), which sets the
--     transaction-local flag `crewflex.system_status` (API clients cannot call set_config), and only
--     when they match the seats taken (confirmed + finished vs headcount);
--   * closing is refused while any application is accepted or confirmed (T-12, v1.8 «Resuelve antes
--     las asignaciones activas»): CFA11;
--   * system changes are audited without an actor (the actor may be the technician, whose id the
--     organization's audit trail must not carry — T-04).
-- ---------------------------------------------------------------------------------------------
create or replace function public.guard_requirement_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_system boolean := current_setting('crewflex.system_status', true) is not distinct from 'on';
  v_seats integer;
begin
  if old.status = 'closed' then
    raise exception 'a closed requirement cannot be reopened' using errcode = '55000';
  end if;
  if (old.status = 'open' and new.status = 'covered') or (old.status = 'covered' and new.status = 'open') then
    if not v_system then
      raise exception 'requirement status % → % is not allowed', old.status, new.status
        using errcode = '55000';
    end if;
    select count(*) into v_seats from public.applications a
    where a.requirement_id = new.id and a.status in ('confirmed', 'finished');
    if (new.status = 'covered') <> (v_seats >= new.headcount) then
      raise exception 'requirement status % → % does not match its confirmed applications', old.status, new.status
        using errcode = '55000';
    end if;
  elsif not (
    new.status = 'closed'
    or (old.status = 'open' and new.status = 'paused')
    or (old.status = 'paused' and new.status = 'open')
    or (old.status = 'draft' and new.status = 'open')
  ) then
    raise exception 'requirement status % → % is not allowed', old.status, new.status
      using errcode = '55000';
  end if;
  if new.status = 'closed' and exists (
    select 1 from public.applications a
    where a.requirement_id = new.id and a.status in ('accepted', 'confirmed')
  ) then
    raise exception 'resolve the accepted and confirmed applications before closing' using errcode = 'CFA11';
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    case when v_system then null else (select auth.uid()) end, new.organization_id,
    'requirement.status_changed', 'work_requirement', new.id,
    jsonb_build_object('from', old.status, 'to', new.status)
      || case when v_system then jsonb_build_object('system', true) else '{}'::jsonb end
  );
  return new;
end;
$$;
revoke execute on function public.guard_requirement_status() from public, anon, authenticated;

-- M05: a requirement that ever received an application (withdrawn included) is frozen for its
-- business columns and qualifications — direct PostgREST writes included (CFA12). Status changes stay
-- possible. The parent is locked before the check (serialises with apply, which locks it too); a
-- parent deleted in the same transaction (organization deletion cascade) is not found, so the cascade
-- still runs. Fires after the closed-requirement guard (trigger names sort after `…_closed_frozen`).
create function public.guard_requirement_with_applications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if tg_table_name = 'work_requirements' then
    if (new.organization_id, new.title, new.location, new.starts_at, new.ends_at, new.shift,
        new.headcount, new.urgency)
       is distinct from
       (old.organization_id, old.title, old.location, old.starts_at, old.ends_at, old.shift,
        old.headcount, old.urgency)
       and exists (select 1 from public.applications a where a.requirement_id = old.id) then
      raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
    end if;
    return new;
  end if;
  foreach v_id in array array_remove(array[new.work_requirement_id, old.work_requirement_id], null) loop
    perform 1 from public.work_requirements wr where wr.id = v_id for update;
    if found and exists (select 1 from public.applications a where a.requirement_id = v_id) then
      raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
    end if;
  end loop;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.guard_requirement_with_applications() from public, anon, authenticated;
revoke execute on function public.refuse_application_history_update() from public, anon, authenticated;

create trigger work_requirements_with_applications_frozen
  before update on public.work_requirements
  for each row execute function public.guard_requirement_with_applications();
create trigger work_requirement_qualifications_with_applications_frozen
  before insert or update or delete on public.work_requirement_qualifications
  for each row execute function public.guard_requirement_with_applications();

-- ---------------------------------------------------------------------------------------------
-- M05 edit: admin/manager of the requirement's organization, the creation validations, optimistic
-- version (ms precision, CF412), refused once the requirement received any application (CFA12) and
-- when closed (55000). A request that changes nothing is a no-op (a replayed PUT answers the same).
-- Audited `requirement.updated` with the changed field names only. DEFINER: API roles cannot write
-- the audit trail (S-9) nor read applications.
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
  p_qualifications jsonb
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
  v_quals jsonb;
  v_changed text[] := '{}';
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- Payload checks as create_work_requirement (BR-1.4), plus well-formed and distinct items.
  if jsonb_typeof(p_qualifications) is distinct from 'array'
     or jsonb_array_length(p_qualifications) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'qualifications must contain 1-20 items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_qualifications) q
    where jsonb_typeof(q) <> 'object'
       or q ->> 'qualification_type_id' is null
       or coalesce(q ->> 'requirement_level', '') not in ('hard', 'soft')
  ) then
    raise exception using errcode = '22023', message = 'invalid qualification item';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_qualifications) q where q ->> 'requirement_level' = 'hard'
  ) then
    raise exception using errcode = '22023', message = 'at least one hard qualification is required';
  end if;
  select jsonb_agg(jsonb_build_object(
           'qualification_type_id', (q ->> 'qualification_type_id')::uuid,
           'requirement_level', q ->> 'requirement_level'
         ) order by (q ->> 'qualification_type_id')::uuid)
  into v_quals
  from jsonb_array_elements(p_qualifications) q;
  if (select count(distinct q ->> 'qualification_type_id') from jsonb_array_elements(v_quals) q)
     <> jsonb_array_length(v_quals) then
    raise exception using errcode = '22023', message = 'qualifications must be distinct';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'the version the client loaded is required';
  end if;

  select * into v_req from public.work_requirements wr where wr.id = p_id for update;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if v_req.status = 'closed' then
    raise exception 'a closed requirement cannot be changed' using errcode = '55000';
  end if;

  if p_title is distinct from v_req.title then v_changed := v_changed || 'title'::text; end if;
  if p_location is distinct from v_req.location then v_changed := v_changed || 'location'::text; end if;
  -- Instants compare at the API's precision (ms): a client echoing what it read changes nothing.
  if date_trunc('milliseconds', p_starts_at) is distinct from date_trunc('milliseconds', v_req.starts_at) then
    v_changed := v_changed || 'startsAt'::text;
  end if;
  if date_trunc('milliseconds', p_ends_at) is distinct from date_trunc('milliseconds', v_req.ends_at) then
    v_changed := v_changed || 'endsAt'::text;
  end if;
  if p_shift is distinct from v_req.shift then v_changed := v_changed || 'shift'::text; end if;
  if p_headcount is distinct from v_req.headcount then v_changed := v_changed || 'headcount'::text; end if;
  if p_urgency is distinct from v_req.urgency then v_changed := v_changed || 'urgency'::text; end if;
  if v_quals is distinct from (
    select jsonb_agg(jsonb_build_object(
             'qualification_type_id', wrq.qualification_type_id,
             'requirement_level', wrq.requirement_level
           ) order by wrq.qualification_type_id)
    from public.work_requirement_qualifications wrq where wrq.work_requirement_id = p_id
  ) then
    v_changed := v_changed || 'qualifications'::text;
  end if;

  if cardinality(v_changed) = 0 then
    return query select v_req.id, v_req.updated_at, v_changed;
    return;
  end if;
  if exists (select 1 from public.applications a where a.requirement_id = p_id) then
    raise exception 'a requirement that received applications cannot be edited' using errcode = 'CFA12';
  end if;
  if date_trunc('milliseconds', v_req.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'requirement was modified by another session';
  end if;

  update public.work_requirements wr
  set title = p_title, location = p_location,
      starts_at = case when 'startsAt' = any (v_changed) then p_starts_at else wr.starts_at end,
      ends_at = case when 'endsAt' = any (v_changed) then p_ends_at else wr.ends_at end,
      shift = p_shift, headcount = p_headcount, urgency = p_urgency
  where wr.id = p_id;

  if 'qualifications' = any (v_changed) then
    delete from public.work_requirement_qualifications wrq
    where wrq.work_requirement_id = p_id
      and wrq.qualification_type_id not in (
        select (q ->> 'qualification_type_id')::uuid from jsonb_array_elements(v_quals) q);
    insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
    select p_id, (q ->> 'qualification_type_id')::uuid, (q ->> 'requirement_level')::public.requirement_level
    from jsonb_array_elements(v_quals) q
    on conflict (work_requirement_id, qualification_type_id)
      do update set requirement_level = excluded.requirement_level;
  end if;

  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_req.organization_id, 'requirement.updated', 'work_requirement', p_id,
          jsonb_build_object('fields', to_jsonb(v_changed)));

  return query select wr.id, wr.updated_at, v_changed from public.work_requirements wr where wr.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Apply (∅ → received). Technician accounts only. Order: lock the requirement, claim the key (a
-- replay returns its own result whatever happened since), then: open (CFA01), not started (CFA02),
-- no application that is not withdrawn — active → CFA09, rejected/cancelled/finished → CFA10 (Q5,
-- T-09) — and eligible now (T-08: CFA03 qualifications, CFA04 availability). The unique index is the
-- backstop. Audit `application.received` without an organization id (the actor is the technician:
-- their profile id must not reach the organization's audit trail, T-04).
-- ---------------------------------------------------------------------------------------------
create function public.apply_to_requirement(
  p_requirement_id uuid,
  p_idempotency_key uuid,
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

  insert into public.applications (requirement_id, technician_profile_id)
  values (v_req.id, v_uid)
  returning id into v_id;
  insert into public.application_events (application_id, seq, from_status, to_status, actor)
  values (v_id, 1, null, 'received', 'technician');
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'application.received', 'application', v_id,
    jsonb_build_object('from', null, 'to', 'received', 'actor', 'technician', 'requirement_id', v_req.id,
                       'proposal_version', null, 'reason_provided', false, 'request_id', p_request_id));
  perform app_private.complete_idempotency_key('application.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- One generic transition (all of APPLICATION_TRANSITIONS). One transaction:
--   1. lock the requirement, then the application (FOR UPDATE);
--   2. the caller's side from the database: technician = the applicant; organization = admin/manager
--      of the requirement's organization who is not the applicant (no self-dealing); neither → P0002,
--      the same answer as a missing id (no existence oracle);
--   3. claim the Idempotency-Key BEFORE the state and version checks, so a replay returns its own
--      result (T6) and the same key with another payload is CF409 (T7);
--   4. the pair exists only for the other side → 42501; not at all → 55000 (T2/T3);
--      reason exactly for rejected/cancelled, 1–1000 chars (22023, T10); a proposal id only to accept;
--   5. optimistic version: application updated_at (ms) = p_expected_updated_at, else CF412 (T8);
--   6. target checks: shortlisted/proposed need the requirement open (CFA01), proposed not started
--      (CFA02) and writes proposal version n+1 = the frozen card (R-08); accepted needs the CURRENT
--      proposal id (CFA07) and a requirement that is not closed (CFA01); confirmed re-checks EVERYTHING
--      at commit — covered (CFA06), open (CFA01), not started (CFA02), the technician's advisory lock, hard
--      qualifications (CFA03), availability (CFA04), no overlapping confirmed assignment (CFA05),
--      seats (confirmed + finished) < headcount under the requirement lock (CFA06); finished only once
--      the period ended (CFA08); rejected/withdrawn/cancelled are always possible from their rows;
--   7. the requirement follows: the last seat → covered; cancelling a confirmed seat of a covered one
--      → open (both through the system flag of guard_requirement_status);
--   8. event row + audit `application.<to>` (ids and flags only; no organization id when the actor
--      is the technician) + key completion, all in this transaction (T11).
-- ---------------------------------------------------------------------------------------------
create function public.transition_application(
  p_application_id uuid,
  p_to public.application_status,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_reason text default null,
  p_proposal_id uuid default null,
  p_request_id uuid default null
)
returns table (
  application_id uuid,
  status public.application_status,
  event_id uuid,
  proposal_id uuid,
  updated_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_req_id uuid;
  v_req public.work_requirements%rowtype;
  v_app public.applications%rowtype;
  v_side text;
  v_reason_required boolean;
  v_event_id uuid;
  v_proposal_id uuid;
  v_proposal_version integer;
  v_seq integer;
  v_seats integer;
  v_ok record;
  v_now timestamptz := now();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_to is null or p_to = 'received' then
    raise exception using errcode = '22023', message = 'invalid target status';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key is required';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'the version the client loaded is required';
  end if;

  select a.requirement_id into v_req_id from public.applications a where a.id = p_application_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'application not found';
  end if;
  select * into v_req from public.work_requirements wr where wr.id = v_req_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'application not found';
  end if;
  select * into v_app from public.applications a where a.id = p_application_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'application not found';
  end if;

  if v_app.technician_profile_id = v_uid then
    v_side := 'technician';
  elsif public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    v_side := 'organization';
  else
    raise exception using errcode = 'P0002', message = 'application not found';
  end if;

  v_event_id := app_private.claim_idempotency_key('application.transition', p_idempotency_key,
    jsonb_build_object(
      'application_id', p_application_id, 'to', p_to,
      'expected_updated_at', date_trunc('milliseconds', p_expected_updated_at) at time zone 'UTC',
      'reason', v_reason, 'proposal_id', p_proposal_id));
  if v_event_id is not null then
    return query
    select e.application_id, e.to_status, e.id, e.proposal_id, e.created_at, true
    from public.application_events e where e.id = v_event_id;
    return;
  end if;

  select t.reason_required into v_reason_required
  from app_private.application_transitions t
  where t.from_status = v_app.status and t.to_status = p_to and t.actor = v_side;
  if not found then
    if exists (select 1 from app_private.application_transitions t
               where t.from_status = v_app.status and t.to_status = p_to) then
      raise exception using errcode = '42501', message = 'this action belongs to the other party';
    end if;
    raise exception 'application status % → % is not allowed', v_app.status, p_to using errcode = '55000';
  end if;
  if v_reason_required then
    if v_reason is null or char_length(v_reason) > 1000 then
      raise exception using errcode = '22023', message = 'a reason of 1-1000 characters is required';
    end if;
  elsif p_reason is not null then
    raise exception using errcode = '22023', message = 'this transition takes no reason';
  end if;
  if p_to = 'accepted' then
    if p_proposal_id is null then
      raise exception using errcode = '22023', message = 'the accepted proposal is required';
    end if;
  elsif p_proposal_id is not null then
    raise exception using errcode = '22023', message = 'only an acceptance names a proposal';
  end if;

  if date_trunc('milliseconds', v_app.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'application changed since it was loaded';
  end if;

  case p_to
    when 'shortlisted' then
      if v_req.status <> 'open' then
        raise exception using errcode = 'CFA01', message = 'the requirement is not open';
      end if;
    when 'proposed' then
      if v_req.status <> 'open' then
        raise exception using errcode = 'CFA01', message = 'the requirement is not open';
      end if;
      if v_req.starts_at <= v_now then
        raise exception using errcode = 'CFA02', message = 'the requirement has started';
      end if;
      select coalesce(max(p.version), 0) + 1 into v_proposal_version
      from public.application_proposals p where p.application_id = v_app.id;
      insert into public.application_proposals (application_id, version, terms)
      select v_app.id, v_proposal_version, c.card - 'id' - 'createdAt' - 'status'
      from app_private.requirement_cards c where c.id = v_req.id
      returning id into v_proposal_id;
    when 'accepted' then
      if v_req.status = 'closed' then
        raise exception using errcode = 'CFA01', message = 'the requirement is closed';
      end if;
      if p_proposal_id is distinct from v_app.current_proposal_id then
        raise exception using errcode = 'CFA07', message = 'the proposal is not the current version';
      end if;
      v_proposal_id := p_proposal_id;
      select p.version into v_proposal_version from public.application_proposals p where p.id = v_proposal_id;
    when 'confirmed' then
      -- A covered requirement has every seat confirmed (guard_requirement_status keeps it so).
      if v_req.status = 'covered' then
        raise exception using errcode = 'CFA06', message = 'every seat is confirmed';
      end if;
      if v_req.status <> 'open' then
        raise exception using errcode = 'CFA01', message = 'the requirement is not open';
      end if;
      if v_req.starts_at <= v_now then
        raise exception using errcode = 'CFA02', message = 'the requirement has started';
      end if;
      -- Availability writes of this technician wait (and so do other confirmations of them).
      perform pg_advisory_xact_lock(hashtextextended('availability:' || v_app.technician_profile_id::text, 0));
      select * into v_ok from app_private.hard_eligibility(v_req.id, v_app.technician_profile_id);
      if not coalesce(v_ok.qualifications_ok, false) then
        raise exception using errcode = 'CFA03', message = 'a hard qualification is not valid';
      end if;
      if not coalesce(v_ok.availability_ok, false) then
        raise exception using errcode = 'CFA04', message = 'availability does not cover the period';
      end if;
      if exists (
        select 1 from public.applications o
        join public.work_requirements r on r.id = o.requirement_id
        where o.technician_profile_id = v_app.technician_profile_id
          and o.status = 'confirmed' and o.id <> v_app.id
          and r.starts_at < v_req.ends_at and r.ends_at > v_req.starts_at
      ) then
        raise exception using errcode = 'CFA05', message = 'another confirmed assignment overlaps';
      end if;
      select count(*) into v_seats from public.applications o
      where o.requirement_id = v_req.id and o.status in ('confirmed', 'finished');
      if v_seats >= v_req.headcount then
        raise exception using errcode = 'CFA06', message = 'every seat is confirmed';
      end if;
    when 'finished' then
      if v_req.ends_at > v_now then
        raise exception using errcode = 'CFA08', message = 'the period has not ended';
      end if;
    else
      null; -- rejected, withdrawn, cancelled: possible whenever their row allows them
  end case;

  update public.applications a
  set status = p_to,
      reason = case when v_reason_required then v_reason end,
      current_proposal_id = case when p_to = 'proposed' then v_proposal_id else a.current_proposal_id end,
      accepted_proposal_id = case when p_to = 'accepted' then v_proposal_id else a.accepted_proposal_id end
  where a.id = v_app.id;

  if p_to = 'confirmed' and v_seats + 1 >= v_req.headcount then
    perform set_config('crewflex.system_status', 'on', true);
    update public.work_requirements wr set status = 'covered' where wr.id = v_req.id;
    perform set_config('crewflex.system_status', 'off', true);
  elsif p_to = 'cancelled' and v_app.status = 'confirmed' and v_req.status = 'covered' then
    select count(*) into v_seats from public.applications o
    where o.requirement_id = v_req.id and o.status in ('confirmed', 'finished');
    if v_seats < v_req.headcount then
      perform set_config('crewflex.system_status', 'on', true);
      update public.work_requirements wr set status = 'open' where wr.id = v_req.id;
      perform set_config('crewflex.system_status', 'off', true);
    end if;
  end if;

  select coalesce(max(e.seq), 0) + 1 into v_seq from public.application_events e where e.application_id = v_app.id;
  insert into public.application_events (application_id, seq, from_status, to_status, actor, proposal_id)
  values (v_app.id, v_seq, v_app.status, p_to, v_side, v_proposal_id)
  returning id into v_event_id;

  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when v_side = 'organization' then v_req.organization_id end,
    'application.' || p_to::text, 'application', v_app.id,
    jsonb_build_object('from', v_app.status, 'to', p_to, 'actor', v_side, 'requirement_id', v_req.id,
                       'proposal_version', v_proposal_version, 'reason_provided', v_reason is not null,
                       'request_id', p_request_id));

  perform app_private.complete_idempotency_key('application.transition', p_idempotency_key, v_event_id);
  return query select v_app.id, p_to, v_event_id, v_proposal_id, v_now, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Reads.
-- ---------------------------------------------------------------------------------------------

-- The organization's view of one requirement's applications (admin/manager; missing and not allowed
-- raise the same 42501, as the candidate pool). Applicant columns = get_requirement_candidate_pool's
-- (pseudonym `CF-…` unless an internal member; name for internal members or `open` visibility only;
-- qualifications relevant to the requirement; windows overlapping its period). No contact data, no
-- documents (D-07 not activated).
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
  candidate_availability jsonb
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
    ), '[]'::jsonb)
  from public.applications a
  join public.technician_profiles tp on tp.profile_id = a.technician_profile_id
  join public.profiles pr on pr.id = a.technician_profile_id
  left join public.organization_members m
    on m.organization_id = v_req.organization_id and m.profile_id = a.technician_profile_id
  where a.requirement_id = v_req.id
  order by a.created_at, a.id;
end;
$$;

-- The technician's own applications with the requirement card (whatever its status now), the
-- current proposal and the history. Technician accounts only.
create function public.get_my_applications()
returns table (
  application_id uuid,
  requirement_id uuid,
  status public.application_status,
  created_at timestamptz,
  updated_at timestamptz,
  reason text,
  current_proposal jsonb,
  accepted_proposal_id uuid,
  history jsonb,
  requirement jsonb
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
  return query
  select a.id, a.requirement_id, a.status, a.created_at, a.updated_at, a.reason,
         app_private.proposal_json(a.current_proposal_id), a.accepted_proposal_id,
         app_private.application_history(a.id), c.card
  from public.applications a
  join app_private.requirement_cards c on c.id = a.requirement_id
  where a.technician_profile_id = v_uid
  order by a.created_at desc, a.id;
end;
$$;

-- Dashboard counters: applications per status over one organization's requirements (admin/manager).
create function public.get_application_counts(p_organization_id uuid)
returns table (status public.application_status, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select a.status, count(*)::integer
  from public.applications a
  join public.work_requirements wr on wr.id = a.requirement_id
  where wr.organization_id = p_organization_id
  group by a.status
  order by a.status;
end;
$$;

revoke execute on function
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz,
    public.shift_type, integer, public.requirement_urgency, jsonb),
  public.apply_to_requirement(uuid, uuid, uuid),
  public.transition_application(uuid, public.application_status, timestamptz, uuid, text, uuid, uuid),
  public.get_requirement_applications(uuid),
  public.get_my_applications(),
  public.get_application_counts(uuid)
from public, anon;
grant execute on function
  public.update_work_requirement(uuid, timestamptz, text, text, timestamptz, timestamptz,
    public.shift_type, integer, public.requirement_urgency, jsonb),
  public.apply_to_requirement(uuid, uuid, uuid),
  public.transition_application(uuid, public.application_status, timestamptz, uuid, text, uuid, uuid),
  public.get_requirement_applications(uuid),
  public.get_my_applications(),
  public.get_application_counts(uuid)
to authenticated;
