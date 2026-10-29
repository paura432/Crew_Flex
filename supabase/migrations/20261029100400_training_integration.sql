-- Crew Flex — Training (ADR-003, batch V19-01). Part 4 of 4: where training meets what exists. LOCAL ONLY.
--   1. In-app notices (V19-031): kind `training` (20261029100000) on `public.notifications` — four nullable
--      subject columns + the status reached, written by triggers on request events (to the other party)
--      and on review decisions (to the provider's admins/managers); `visible_notifications` replaced
--      (same signature) and `get_my_notifications` dropped + created again with the training columns at
--      the END (the earlier columns and their meaning are untouched). Retention, pruning, read marks and
--      role-loss deletion are reused as they are.
--   2. transition_application (V19-028): `create or replace` with the SAME signature and body of
--      20261022130300 plus one check on confirm — the assignment period overlaps a confirmed training
--      session → CFA17 (`OVERLAPPING_TRAINING`, appended at the end of APPLICATION_CONFLICTS).
--   3. Account closure (V19-037): refused while the person has a confirmed seat with a future session
--      (CFT12 `ACTIVE_TRAINING_SEATS`), by a second BEFORE DELETE trigger on profiles (the existing guard
--      20261023400100 is untouched).
-- NON-DESTRUCTIVE: nullable columns, a widened CHECK, triggers, `create or replace` of two functions
-- with their signatures kept, one function dropped and re-created with the same signature and grants.

-- ---------------------------------------------------------------------------------------------
-- 1. Notices
-- ---------------------------------------------------------------------------------------------
alter table public.notifications
  add column training_request_id uuid references public.training_requests (id) on delete cascade,
  add column training_course_id uuid references public.training_courses (id) on delete cascade,
  add column training_edition_id uuid references public.training_editions (id) on delete cascade,
  add column training_organization_id uuid references public.training_providers (organization_id) on delete cascade,
  -- The status reached: a request status, a listing status or a provider status (text: one column).
  add column training_status text check (training_status is null or char_length(training_status) between 1 and 20);

alter table public.notifications drop constraint notifications_subject;
alter table public.notifications add constraint notifications_subject check (
  case when kind = 'training'
       then application_id is null and requirement_id is null and application_status is null
            and requirement_status is null and training_status is not null
            and (training_request_id is not null)::integer + (training_course_id is not null)::integer
                + (training_edition_id is not null)::integer + (training_organization_id is not null)::integer = 1
       else training_request_id is null and training_course_id is null and training_edition_id is null
            and training_organization_id is null and training_status is null
            and ((kind = 'application' and application_id is not null and requirement_id is null
                  and application_status is not null and requirement_status is null)
                 or (kind = 'requirement' and application_id is not null and requirement_id is null
                     and application_status is null and requirement_status in ('open', 'paused', 'closed'))
                 or (kind = 'outreach' and application_id is null and requirement_id is not null
                     and application_status is null and requirement_status is null))
  end);

create index notifications_training_request_idx on public.notifications (training_request_id)
  where training_request_id is not null;

-- One notice per request event for the other party: the professional acted → the provider's
-- admins/managers; the provider or the system acted → the professional. An unread notice about the
-- same request takes the new status instead of a new row (T-73). Membership rows are share-locked, as
-- notify_application_event does.
create function public.notify_training_request_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_professional uuid;
  v_org uuid;
  v_recipients uuid[];
begin
  select r.professional_id, r.organization_id into v_professional, v_org
  from public.training_requests r where r.id = new.request_id;
  if new.actor = 'professional' then
    select coalesce(array_agg(s.profile_id order by s.profile_id), '{}') into v_recipients
    from (
      select m.profile_id from public.organization_members m
      where m.organization_id = v_org and m.role in ('admin', 'manager')
        and m.profile_id <> v_professional and m.profile_id is distinct from v_uid
      for share of m
    ) s;
  else
    v_recipients := array_remove(array[case when v_professional is distinct from v_uid then v_professional end], null);
  end if;
  with merged as (
    update public.notifications n
    set training_status = new.to_status::text, created_at = now()
    where n.recipient_id = any (v_recipients)
      and n.kind = 'training' and n.read_at is null and n.training_request_id = new.request_id
    returning n.recipient_id
  )
  insert into public.notifications (recipient_id, kind, training_request_id, training_status)
  select r, 'training', new.request_id, new.to_status::text
  from unnest(v_recipients) r
  where r not in (select merged.recipient_id from merged);
  perform app_private.prune_notifications(v_recipients);
  return null;
end;
$$;
revoke execute on function public.notify_training_request_event() from public, anon, authenticated;
create trigger training_request_events_notify
  after insert on public.training_request_events
  for each row execute function public.notify_training_request_event();

-- A review decision (provider reviewed/rejected/suspended; course or edition published/changes/
-- rejected/suspended) tells the provider's admins/managers, except the actor. Unread notice about the
-- same subject → updated in place.
create function public.notify_training_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid := new.organization_id;
  v_recipients uuid[];
  v_request uuid := null;
  -- Three tables share this trigger: the row is read as JSON (providers have no `id`).
  v_course uuid := case when tg_table_name = 'training_courses' then (to_jsonb(new) ->> 'id')::uuid end;
  v_edition uuid := case when tg_table_name = 'training_editions' then (to_jsonb(new) ->> 'id')::uuid end;
  v_provider uuid := case when tg_table_name = 'training_providers' then new.organization_id end;
begin
  if new.status::text not in ('reviewed', 'published', 'changes', 'rejected', 'suspended') then
    return null;
  end if;
  select coalesce(array_agg(s.profile_id order by s.profile_id), '{}') into v_recipients
  from (
    select m.profile_id from public.organization_members m
    where m.organization_id = v_org and m.role in ('admin', 'manager') and m.profile_id is distinct from v_uid
    for share of m
  ) s;
  with merged as (
    update public.notifications n
    set training_status = new.status::text, created_at = now()
    where n.recipient_id = any (v_recipients)
      and n.kind = 'training' and n.read_at is null
      and n.training_course_id is not distinct from v_course
      and n.training_edition_id is not distinct from v_edition
      and n.training_organization_id is not distinct from v_provider
      and n.training_request_id is null
    returning n.recipient_id
  )
  insert into public.notifications
    (recipient_id, kind, training_course_id, training_edition_id, training_organization_id, training_status)
  select r, 'training', v_course, v_edition, v_provider, new.status::text
  from unnest(v_recipients) r
  where r not in (select merged.recipient_id from merged);
  perform app_private.prune_notifications(v_recipients);
  return null;
end;
$$;
revoke execute on function public.notify_training_review() from public, anon, authenticated;
create trigger training_providers_notify_review
  after update of status on public.training_providers
  for each row when (old.status is distinct from new.status) execute function public.notify_training_review();
create trigger training_courses_notify_review
  after update of status on public.training_courses
  for each row when (old.status is distinct from new.status) execute function public.notify_training_review();
create trigger training_editions_notify_review
  after update of status on public.training_editions
  for each row when (old.status is distinct from new.status) execute function public.notify_training_review();

-- Who may still read a notice (20261024400200 kept for the three employment kinds). A training notice
-- about a request is the professional's own (`own`) or the provider's (admin/manager now); one about a
-- listing or the provider profile is the organization's admin/manager's.
create or replace function app_private.visible_notifications()
returns table (id uuid, own boolean)
language sql
stable
set search_path = ''
as $$
  select n.id,
         case when n.kind = 'training' then tr.professional_id = n.recipient_id
              else n.kind = 'outreach' or a.technician_profile_id = n.recipient_id end
  from public.notifications n
  left join public.applications a on a.id = n.application_id
  left join public.work_requirements wr on wr.id = coalesce(a.requirement_id, n.requirement_id)
  left join public.training_requests tr on tr.id = n.training_request_id
  where n.recipient_id = (select auth.uid())
    and n.created_at > now() - app_private.notification_retention()
    and case
          when n.kind = 'training' then
            case when tr.id is not null
                 then tr.professional_id = n.recipient_id
                      or public.has_org_role(tr.organization_id, array['admin', 'manager']::public.organization_role[])
                 else public.has_org_role(coalesce(
                        (select c.organization_id from public.training_courses c where c.id = n.training_course_id),
                        (select e.organization_id from public.training_editions e where e.id = n.training_edition_id),
                        n.training_organization_id), array['admin', 'manager']::public.organization_role[])
            end
          when n.kind = 'outreach' then wr.status = 'open' and wr.ends_at > now() and wr.archived_at is null
          else a.technician_profile_id is not null
               and (a.technician_profile_id = n.recipient_id
                    or public.has_org_role(wr.organization_id, array['admin', 'manager']::public.organization_role[]))
        end;
$$;

drop function public.get_my_notifications(uuid, integer, integer);

-- The caller's notices, newest first (20261024400200 for the employment kinds, unchanged). Training
-- columns, at the end: the subject ids, the status reached and a title rendered at read time (course
-- title, or the provider name for a provider review); `training_subject` names which one it is.
create function public.get_my_notifications(
  p_id uuid default null,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  kind public.notification_kind,
  audience text,
  created_at timestamptz,
  read_at timestamptz,
  application_id uuid,
  application_status public.application_status,
  requirement_status public.requirement_status,
  requirement_id uuid,
  requirement_title text,
  organization_name text,
  candidate_name text,
  candidate_ref text,
  total integer,
  outreach_urgency public.requirement_urgency,
  training_subject text,
  training_request_id uuid,
  training_course_id uuid,
  training_edition_id uuid,
  training_organization_id uuid,
  training_status text,
  training_title text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid page';
  end if;
  return query
  select
    n.id, n.kind,
    case when v.own then 'technician' else 'organization' end,
    n.created_at, n.read_at, n.application_id, n.application_status, n.requirement_status,
    wr.id, wr.title,
    case when v.own then coalesce(o.name, tp2.name) end,
    case when not v.own and n.kind <> 'training' and (m.profile_id is not null or tp.visibility = 'open') then pr.display_name end,
    case when not v.own and n.kind <> 'training' and m.profile_id is null and tp.visibility <> 'open'
         then app_private.candidate_pseudonym(wr.id, a.technician_profile_id) end,
    (count(*) over ())::integer,
    case when n.kind = 'outreach' then d.urgency end,
    case when n.kind <> 'training' then null
         when n.training_request_id is not null then 'request'
         when n.training_course_id is not null then 'course'
         when n.training_edition_id is not null then 'edition'
         else 'provider' end,
    n.training_request_id, n.training_course_id, n.training_edition_id, n.training_organization_id,
    n.training_status,
    case when n.kind <> 'training' then null
         else coalesce(tc.title, tp2.name) end
  from app_private.visible_notifications() v
  join public.notifications n on n.id = v.id
  left join public.applications a on a.id = n.application_id
  left join public.work_requirements wr on wr.id = coalesce(a.requirement_id, n.requirement_id)
  left join public.organizations o on o.id = wr.organization_id
  left join public.technician_profiles tp on tp.profile_id = a.technician_profile_id
  left join public.profiles pr on pr.id = a.technician_profile_id
  left join public.organization_members m
    on m.organization_id = wr.organization_id and m.profile_id = a.technician_profile_id
  left join public.outreach_distributions d on d.requirement_id = n.requirement_id
  left join public.training_requests tr on tr.id = n.training_request_id
  left join public.training_editions te on te.id = coalesce(tr.edition_id, n.training_edition_id)
  left join public.training_courses tc on tc.id = coalesce(tr.course_id, n.training_course_id, te.course_id)
  left join public.training_providers tp2
    on tp2.organization_id = coalesce(tr.organization_id, tc.organization_id, n.training_organization_id)
  where p_id is null or n.id = p_id
  order by n.created_at desc, n.id desc
  offset p_offset
  limit p_limit;
end;
$$;

revoke execute on function public.get_my_notifications(uuid, integer, integer) from public, anon;
grant execute on function public.get_my_notifications(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. transition_application: body of 20261022130300, one addition marked «V19-028» (after CFA05).
-- ---------------------------------------------------------------------------------------------
create or replace function public.transition_application(
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
      -- V19-028: a confirmed training session in the period (hour-based; self-paced blocks nothing).
      if app_private.training_overlaps(v_app.technician_profile_id, v_req.starts_at, v_req.ends_at) then
        raise exception using errcode = 'CFA17', message = 'a confirmed training session overlaps';
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
-- 3. Account closure: a person with a confirmed seat whose sessions have not ended (or a self-paced
--    seat whose deadline is ahead) resolves it first — cancel with a reason — before closing (v1.9
--    «Resuelve primero las plazas de formación confirmadas.»). Every deletion path (RPC, Auth Admin API,
--    dashboard) runs it. Requests in other states leave with the account (N-3 default: cascade).
-- ---------------------------------------------------------------------------------------------
create function public.before_account_deleted_training()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.training_requests r
    cross join lateral app_private.training_edition_bounds(r.edition_id) b
    where r.professional_id = old.id and r.status = 'confirmed' and b.ends_at > now()
  ) then
    raise exception 'resolve the confirmed training seats first' using errcode = 'CFT12';
  end if;
  return old;
end;
$$;
revoke execute on function public.before_account_deleted_training() from public, anon, authenticated;
create trigger profiles_before_delete_training
  before delete on public.profiles
  for each row execute function public.before_account_deleted_training();
