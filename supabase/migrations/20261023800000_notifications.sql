-- Crew Flex — in-app notices («Avisos internos», v2 diff v2-18 / shell #1 / N-11; SCOPE-2 LATER, local only).
-- v1.8 connected writes one notice per application transition for the other party
-- (`server/app.mjs:135`) and shows them in «Avisos internos» (`src/beta/Account.jsx:54`). Ported here with
-- three corrections: the organization is also told about a NEW application (v1.8 ✗ HIRE-07 #7), the
-- active applicants are told when the requirement is paused, resumed or closed, and the text is never
-- stored — it is rendered at read time from the kind and the ids (no raw status codes, v1.8 ✗ SH-06 #14).
-- E-mail, SMS, push and WhatsApp stay OUT. Technical defaults T-70…T-73.
--
-- NON-DESTRUCTIVE: one enum, one table (RLS on in this migration), private helpers, three triggers and
-- three RPCs. No existing function, table, grant or data is changed; the applied migrations
-- 20261022130200/130300 are untouched (the notices are written by triggers on their tables, in the
-- same transaction as the event that causes them).
--
-- What a notice holds: recipient, kind, the application it is about and the status reached — ids and
-- enums only, never free text and never another person's id (an organization's row names the
-- application, not the applicant). Who reads what:
--   * nobody reads or writes the table through the API (no grant; the owner-only policies are a second
--     layer). The recipient reads through get_my_notifications(), which re-checks access and retention
--     at read time: a technician reads notices about their own applications; an organization recipient
--     must still be admin/manager of the requirement's organization, and sees the applicant under the
--     candidate pool's rules (T-04 pseudonym `CF-…` unless an internal member; the name only for
--     internal members or `open` visibility — the visibility of today, not of the day of the notice);
--   * the recipient marks read through mark_notifications_read() (own rows, `read_at` only).
-- Retention and volume (T-71, T-73): 180 days and at most 200 notices per recipient, pruned whenever
-- the recipient gets a notice or marks one read (no scheduler) and never listed beyond that; while a
-- notice is unread, the next event about the same technician and requirement updates it instead of
-- adding a row (pause/resume toggles, apply/withdraw loops: security review MEDIUM-1, LOW-4). Deleted
-- with the application, the requirement or the recipient's account; an organization recipient's notices
-- of that organization are deleted when they lose admin/manager.

create type public.notification_kind as enum ('application', 'requirement');

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  -- Every notice is about one application (for `requirement`: the recipient's active application).
  application_id uuid not null references public.applications (id) on delete cascade,
  -- `application`: the status the application reached (`received` = a new application).
  application_status public.application_status,
  -- `requirement`: paused, resumed (open) or closed.
  requirement_status public.requirement_status,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notifications_subject check (
    (kind = 'application' and application_status is not null and requirement_status is null)
    or (kind = 'requirement' and application_status is null
        and requirement_status in ('open', 'paused', 'closed'))),
  constraint notifications_read_after_created check (read_at is null or read_at >= created_at)
);
alter table public.notifications enable row level security;

create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_application_idx on public.notifications (application_id);

-- Supabase grants ALL to the API roles by default: revoke everything. Reads and marks go through the
-- RPCs below (security review LOW-1: a direct SELECT skipped the read-time access and retention checks).
revoke all on table public.notifications from anon, authenticated;

-- Second layer only (no grant uses them today): a recipient sees and touches nothing but their own rows.
create policy notifications_select_own on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- Private helpers (no grants; used by the DEFINER functions below as their owner).
-- ---------------------------------------------------------------------------------------------

-- T-71: how long a notice is kept and listed.
create function app_private.notification_retention()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '180 days' $$;

-- T-04: the per-requirement pseudonym, the same expression as the candidate pool and
-- get_requirement_applications (rls suite «notices» proves they agree).
create function app_private.candidate_pseudonym(p_requirement_id uuid, p_profile_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'CF-' || upper(left(encode(sha256(convert_to(
           p_requirement_id::text || ':' || p_profile_id::text, 'UTF8')), 'hex'), 10));
$$;

-- Lazy retention and volume cap (T-71, T-73): drops the given recipients' notices older than the
-- retention period and everything beyond their newest 200, so a flood by the other party never makes
-- a recipient's reads grow without bound.
create function app_private.prune_notifications(p_recipients uuid[])
returns void
language sql
set search_path = ''
as $$
  delete from public.notifications n
  where n.recipient_id = any (p_recipients)
    and n.created_at <= now() - app_private.notification_retention();
  delete from public.notifications n
  using (
    select x.id
    from unnest(p_recipients) as r (id)
    cross join lateral (
      select y.id from public.notifications y
      where y.recipient_id = r.id
      order by y.created_at desc, y.id desc
      offset 200
    ) x
  ) extra
  where n.id = extra.id;
$$;

-- The caller's notices they may still read, with their side: `own` = about the caller's own
-- application (technician side); otherwise the caller must be admin/manager of the requirement's
-- organization now. One definition for the list and the unread count (≤ 200 rows per caller, T-73).
create function app_private.visible_notifications()
returns table (id uuid, own boolean)
language sql
stable
set search_path = ''
as $$
  select n.id, a.technician_profile_id = n.recipient_id
  from public.notifications n
  join public.applications a on a.id = n.application_id
  join public.work_requirements wr on wr.id = a.requirement_id
  where n.recipient_id = (select auth.uid())
    and n.created_at > now() - app_private.notification_retention()
    and (a.technician_profile_id = n.recipient_id
         or public.has_org_role(wr.organization_id, array['admin', 'manager']::public.organization_role[]));
$$;

revoke execute on function
  app_private.notification_retention(),
  app_private.candidate_pseudonym(uuid, uuid),
  app_private.prune_notifications(uuid[]),
  app_private.visible_notifications()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Writers: triggers, so every path that records the event also records its notices, in the same
-- transaction (apply_to_requirement / transition_application insert the event; the requirement
-- status changes through PostgREST under RLS). DEFINER: API roles cannot insert notices nor read the
-- organization's members. The actor is never notified of their own act.
-- ---------------------------------------------------------------------------------------------

-- One notice per application event for the other party (v1.8 `app.mjs:135`): the organization acted
-- → the applicant; the technician acted (applied, accepted, withdrew, cancelled) → every admin/manager
-- of the requirement's organization except the applicant (T-70/T-71; plain members never see
-- applications). The membership rows are share-locked (security review LOW-1): a concurrent demotion
-- waits for this transaction, so its trigger then sees and deletes the notice; a demotion that
-- committed first is seen here (the role is re-checked on the locked row) and gets none. This relies on
-- READ COMMITTED (PostgREST's default) in the demoting transaction: its trigger's DELETE takes a new
-- snapshot. T-73 (security review LOW-4): while a recipient has an unread notice about the same
-- technician's application to the same requirement, that notice takes this event (status, application —
-- a new one after withdrawing — and time) instead of a new row, so an apply/withdraw loop never pushes
-- the recipient's other notices out of the 200 kept.
create function public.notify_application_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_technician uuid;
  v_requirement uuid;
  v_org uuid;
  v_recipients uuid[];
begin
  select a.technician_profile_id, a.requirement_id, wr.organization_id
  into v_technician, v_requirement, v_org
  from public.applications a
  join public.work_requirements wr on wr.id = a.requirement_id
  where a.id = new.application_id;

  if new.actor = 'organization' then
    v_recipients := array_remove(array[
      case when v_technician is distinct from v_uid then v_technician end], null);
  else
    select coalesce(array_agg(s.profile_id order by s.profile_id), '{}') into v_recipients
    from (
      select m.profile_id
      from public.organization_members m
      where m.organization_id = v_org
        and m.role in ('admin', 'manager')
        and m.profile_id <> v_technician
        and m.profile_id is distinct from v_uid
      for share of m
    ) s;
  end if;

  with merged as (
    update public.notifications n
    set application_id = new.application_id, application_status = new.to_status, created_at = now()
    from public.applications a
    where n.recipient_id = any (v_recipients)
      and n.kind = 'application'
      and n.read_at is null
      and a.id = n.application_id
      and a.requirement_id = v_requirement
      and a.technician_profile_id = v_technician
    returning n.recipient_id
  )
  insert into public.notifications (recipient_id, kind, application_id, application_status)
  select r, 'application', new.application_id, new.to_status
  from unnest(v_recipients) r
  where r not in (select merged.recipient_id from merged);
  perform app_private.prune_notifications(v_recipients);
  return null;
end;
$$;

create trigger application_events_notify
  after insert on public.application_events
  for each row execute function public.notify_application_event();

-- The requirement was paused, resumed (paused → open) or closed: one notice per ACTIVE application
-- (received … confirmed) for its technician. An unread requirement notice of the same application
-- takes the new status instead of a new row (T-73: pause/resume toggles do not pile up). covered ↔ open
-- follow the seats and are not notified (each confirmation or cancellation already notifies its own
-- application).
create function public.notify_requirement_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_recipients uuid[];
begin
  if not (new.status in ('paused', 'closed') or (old.status = 'paused' and new.status = 'open')) then
    return null;
  end if;
  with active as (
    select a.id, a.technician_profile_id
    from public.applications a
    where a.requirement_id = new.id
      and a.status in ('received', 'shortlisted', 'proposed', 'accepted', 'confirmed')
      and a.technician_profile_id is distinct from v_uid
  ),
  merged as (
    update public.notifications n
    set requirement_status = new.status, created_at = now()
    from active
    where n.application_id = active.id
      and n.recipient_id = active.technician_profile_id
      and n.kind = 'requirement'
      and n.read_at is null
    returning n.application_id
  ),
  inserted as (
    insert into public.notifications (recipient_id, kind, application_id, requirement_status)
    select active.technician_profile_id, 'requirement', active.id, new.status
    from active
    where active.id not in (select merged.application_id from merged)
    returning recipient_id
  )
  select coalesce(array_agg(distinct inserted.recipient_id), '{}') into v_recipients from inserted;
  perform app_private.prune_notifications(v_recipients);
  return null;
end;
$$;

create trigger work_requirements_notify_status
  after update of status on public.work_requirements
  for each row when (old.status is distinct from new.status)
  execute function public.notify_requirement_status();

-- Minimisation: a member who stops being admin/manager of an organization (demoted, removed) loses
-- the notices about that organization's applicants at once — not only from the list.
create function public.drop_notifications_on_role_loss()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role not in ('admin', 'manager') then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.role in ('admin', 'manager')
     and new.organization_id = old.organization_id and new.profile_id = old.profile_id then
    return null;
  end if;
  delete from public.notifications n
  using public.applications a, public.work_requirements wr
  where n.recipient_id = old.profile_id
    and a.id = n.application_id
    and a.technician_profile_id <> old.profile_id
    and wr.id = a.requirement_id
    and wr.organization_id = old.organization_id;
  return null;
end;
$$;

create trigger organization_members_drop_notifications
  after update or delete on public.organization_members
  for each row execute function public.drop_notifications_on_role_loss();

revoke execute on function
  public.notify_application_event(),
  public.notify_requirement_status(),
  public.drop_notifications_on_role_loss()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Reads and the one write the recipient makes.
-- ---------------------------------------------------------------------------------------------

-- The caller's notices, newest first, rendered from the ids at read time: requirement title (and,
-- technician side, the organization name — what «Mis candidaturas» already shows), the status reached
-- and, organization side, the applicant under the pool's rules. `p_id` = one notice. `total` = the
-- caller's visible notices across pages. Signed-in callers only (42501 otherwise).
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
  total integer
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
    case when v.own then o.name end,
    -- the candidate pool's rules (get_requirement_applications, S-7): name for internal or `open`…
    case when not v.own and (m.profile_id is not null or tp.visibility = 'open') then pr.display_name end,
    -- …otherwise the pseudonym (one label per applicant)
    case when not v.own and m.profile_id is null and tp.visibility <> 'open'
         then app_private.candidate_pseudonym(wr.id, a.technician_profile_id) end,
    (count(*) over ())::integer
  from app_private.visible_notifications() v
  join public.notifications n on n.id = v.id
  join public.applications a on a.id = n.application_id
  join public.work_requirements wr on wr.id = a.requirement_id
  join public.organizations o on o.id = wr.organization_id
  join public.technician_profiles tp on tp.profile_id = a.technician_profile_id
  join public.profiles pr on pr.id = a.technician_profile_id
  left join public.organization_members m
    on m.organization_id = wr.organization_id and m.profile_id = a.technician_profile_id
  where p_id is null or n.id = p_id
  order by n.created_at desc, n.id desc
  offset p_offset
  limit p_limit;
end;
$$;

-- The bell: the caller's unread notices they may still read (same filter as the list).
create function public.count_my_unread_notifications()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return (
    select count(*)::integer
    from app_private.visible_notifications() v
    join public.notifications n on n.id = v.id
    where n.read_at is null);
end;
$$;

-- Mark one notice (p_id) or every unread one (null) as read, at the database's clock, on the caller's
-- own rows only; then prune the caller's expired ones. Returns the rows matched: one notice → 0 or 1
-- (an already-read notice keeps its first read time; another person's id = a random one = 0); all →
-- how many were unread.
create function public.mark_notifications_read(p_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  update public.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.recipient_id = v_uid
    and ((p_id is null and n.read_at is null) or n.id = p_id);
  get diagnostics v_count = row_count;
  perform app_private.prune_notifications(array[v_uid]);
  return v_count;
end;
$$;

revoke execute on function
  public.get_my_notifications(uuid, integer, integer),
  public.count_my_unread_notifications(),
  public.mark_notifications_read(uuid)
from public, anon;
grant execute on function
  public.get_my_notifications(uuid, integer, integer),
  public.count_my_unread_notifications(),
  public.mark_notifications_read(uuid)
to authenticated;
