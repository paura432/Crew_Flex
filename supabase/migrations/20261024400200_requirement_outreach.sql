-- Crew Flex — «Distribuir aviso Urgente / AOG» (package outreach, v2 diff 30 v2-17: ORG-06 #1, #5, #8–#11,
-- ORG-02 #29; SCOPE-2 LATER, local only; technical defaults T-124…T-129, BUSINESS_RULES BR-26).
-- v1.8 connected `job.outreach` (`server/app.mjs:89-105`, button `src/beta/Account.jsx:69`): on a published
-- job, one in-app notice «{modo}: {título}» for every profile that is visible, without restrictions, not
-- blocking the company, outside its quiet hours, opted in for that mode, with a declared mobilization the
-- start respects, eligible and available, and not notified before; the company is told only how many.
-- Ported with the declared urgency (C-8: never deduced from the start date, ORG-06 #12), without the
-- demo's recipient list (it showed private and blocking profiles: ORG-06 #4, a privacy leak), once per
-- requirement, and through the in-app notices of 20261023800000. E-mail, SMS and push stay OUT.
--
-- NON-DESTRUCTIVE: `notifications` gets a nullable column, its `application_id` becomes nullable (an
-- outreach notice is about a requirement, not an application) and its subject CHECK is rebuilt to admit
-- the new kind (every existing row satisfies it); one new table (RLS on in this file); private helpers;
-- one DEFINER RPC. `app_private.visible_notifications` is replaced with the same signature (left join for
-- the new kind; an application notice whose technician closed the account — 20261023400100 — is no longer
-- counted, as the list already skipped it); `get_my_notifications` is dropped and created again because
-- `create or replace` cannot add the one output column it needs (42P13) — same parameters, body and
-- grants plus that column and the left joins. No data change; count_my_unread_notifications,
-- mark_notifications_read, the event triggers, retention and role-loss deletion are untouched (they keep
-- working for the new rows: an outreach notice is the recipient's own, technician side).
--
-- Privacy (S-7, S-9): the organization never learns WHO was notified — not in the response, not in
-- `outreach_distributions`, not in the audit trail (the count only) — and the audience reads the
-- professionals' preferences, blocks, restrictions and availability inside this one DEFINER function.

-- ---------------------------------------------------------------------------------------------
-- 1. The notice of the new kind: about a requirement, one per recipient and requirement.
-- ---------------------------------------------------------------------------------------------
alter table public.notifications
  alter column application_id drop not null,
  add column requirement_id uuid references public.work_requirements (id) on delete cascade;

alter table public.notifications drop constraint notifications_subject;
alter table public.notifications add constraint notifications_subject check (
  (kind = 'application' and application_id is not null and requirement_id is null
   and application_status is not null and requirement_status is null)
  or (kind = 'requirement' and application_id is not null and requirement_id is null
      and application_status is null and requirement_status in ('open', 'paused', 'closed'))
  or (kind = 'outreach' and application_id is null and requirement_id is not null
      and application_status is null and requirement_status is null));

-- «Not already notified for that requirement» (v1.8 `app.mjs:103`), also as a backstop for the RPC.
create unique index notifications_outreach_once
  on public.notifications (requirement_id, recipient_id) where kind = 'outreach';

-- ---------------------------------------------------------------------------------------------
-- 2. One distribution per requirement (T-125): who may see it and what it says — the urgency it was sent
-- for and how many notices it created. No recipient, no actor (the audit row has the actor).
-- `notified_count` is NULL when fewer than 5 professionals of the external pool were eligible for the need
-- (T-128, security review MEDIUM-1): with so few, the number would tell the organization which of them
-- opted in, declared what mobilization or sleeps when — the exact count is never stored then.
-- Requirements cannot be deleted through the API, so every distribution stays counted for the daily limit.
-- ---------------------------------------------------------------------------------------------
create table public.outreach_distributions (
  requirement_id uuid primary key references public.work_requirements (id) on delete cascade,
  urgency public.requirement_urgency not null check (urgency in ('urgent', 'aog')),
  notified_count integer check (notified_count >= 0),
  created_at timestamptz not null default now()
);
create index outreach_distributions_created_idx on public.outreach_distributions (created_at);
alter table public.outreach_distributions enable row level security;

-- Read-only for the requirement's admins/managers (and platform admins, support); nobody writes it
-- through the API: requirement_outreach() is its only writer.
revoke all on table public.outreach_distributions from anon, authenticated;
grant select on table public.outreach_distributions to authenticated;
create policy outreach_distributions_select on public.outreach_distributions for select to authenticated
  using (
    exists (select 1 from public.work_requirements wr
            where wr.id = outreach_distributions.requirement_id
              and public.has_org_role(wr.organization_id, array['admin', 'manager']::public.organization_role[]))
    or public.is_platform_admin()
  );

-- ---------------------------------------------------------------------------------------------
-- 3. Private helpers (no grants).
-- ---------------------------------------------------------------------------------------------

-- v1.8 `quietNow` (`server/rules.mjs:24`) on a local wall-clock time: [start, end) when start < end,
-- otherwise the span crosses midnight. No quiet hours declared → never quiet.
create function app_private.in_quiet_hours(p_start time, p_end time, p_local time)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_start is null or p_end is null then false
    when p_start < p_end then p_local >= p_start and p_local < p_end
    else p_local >= p_start or p_local < p_end
  end;
$$;

-- T-124: the declared type ratings a requirement asks for — the aircraft of its HARD type-rating
-- qualifications (catalog TR-* code → passport aircraft, 20261009120100 ↔ 20261023100100) and its hard
-- licence codes. A declared rating with restrictions on one of those aircraft (for one of those
-- licences, when the requirement names any) keeps the professional out of the outreach.
create function app_private.outreach_required_ratings(p_requirement_id uuid)
returns table (aircraft text[], licences text[])
language sql
stable
set search_path = ''
as $$
  select
    coalesce(array_agg(distinct m.aircraft) filter (where m.aircraft is not null), '{}'::text[]),
    coalesce(array_agg(distinct qt.code) filter (where qt.category = 'LICENSE'), '{}'::text[])
  from public.work_requirement_qualifications wrq
  join public.qualification_types qt on qt.id = wrq.qualification_type_id
  left join (values
    ('TR-A320', 'A320 Family'), ('TR-A330', 'A330'), ('TR-A350', 'A350'), ('TR-B737', 'B737 NG'),
    ('TR-B737', 'B737 MAX'), ('TR-B787', 'B787'), ('TR-ATR72', 'ATR 72')
  ) m (code, aircraft) on m.code = qt.code
  where wrq.work_requirement_id = p_requirement_id
    and wrq.requirement_level = 'hard';
$$;

revoke execute on function
  app_private.in_quiet_hours(time, time, time),
  app_private.outreach_required_ratings(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. The distribution (v1.8 `job.outreach`). One transaction:
--   1. signed-in caller (42501); admin/manager of the requirement's organization from the database, or
--      the same 42501 as a missing id (no existence oracle); then a transaction lock per ORGANIZATION
--      (every distribution of one organization runs one at a time, so the daily limit and the flood bound
--      hold under concurrency — security review LOW-1; nothing else takes it, so it cannot deadlock),
--      then the requirement row FOR UPDATE (two admins clicking at once: the second finds the
--      distribution, CFO03) and the role read again on the locked row;
--   2. CFO03 already distributed · CFO02 planned urgency (the button is not offered) · CFO01 not open
--      (draft, paused, covered, closed or archived: v1.8 «Publica o reanuda la oferta primero.») · CFO04
--      started · CFO05 the organization already distributed 10 needs in the last 24 h (T-128: bounds
--      how often the count can be read);
--   3. the audience (BR-26), every rule in SQL, read as the owner:
--      in the requirement's external candidate pool (app_private.ranked_external_pool, called: visibility
--      not `private`, `verified_orgs` only for a reviewed organization, BR-8; not a member of the
--      organization; not blocking it, N-08) · no general restriction and no restricted rating the
--      requirement asks for (T-124) · opted in for THIS urgency (urgent vs AOG) · mobilization declared,
--      the start at least that many hours away and, when the requirement states one, within its
--      `conditions.maxMobilizationHours` (ORG-02 #29) · outside their quiet hours in their time zone (an
--      unknown zone = no notice) · no application to it that is not withdrawn (T-126) · eligible by
--      app_private.hard_eligibility (called, not copied: qualifications valid for the period and
--      availability covering it) · not already notified for it, and fewer than 3 outreach notices from
--      this organization in the last 24 h (T-126). No filter on bookings with OTHER organizations (v1.8
--      skipped overlapping confirmed assignments: the count would reveal them; CFA05 still refuses the
--      confirmation);
--   4. one notice per recipient, the recipients' retention pruned, the distribution row (the PK is the
--      backstop) and the audit `requirement.outreach_distributed` (S-9: count, urgency, request id).
-- Returns { notified, distributed_at, urgency }; `notified` is NULL when fewer than 5 professionals of the
-- external pool are eligible for the need (that base the organization can already count through matching;
-- T-128) — the notices are still created.
-- ---------------------------------------------------------------------------------------------
create function public.requirement_outreach(p_requirement_id uuid, p_request_id uuid default null)
returns table (notified integer, distributed_at timestamptz, urgency public.requirement_urgency)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_now timestamptz := now();
  v_req public.work_requirements%rowtype;
  v_max_mobilization numeric;
  v_aircraft text[];
  v_licences text[];
  v_recipients uuid[];
  v_base integer;
  v_count integer;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- The role first, without a lock: a caller who may not distribute never holds the requirement row.
  select * into v_req from public.work_requirements wr where wr.id = p_requirement_id;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('outreach:' || v_req.organization_id::text, 0));
  select * into v_req from public.work_requirements wr where wr.id = p_requirement_id for update;
  -- Demoted or removed while waiting for the locks: the same answer as before.
  if not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if exists (select 1 from public.outreach_distributions d where d.requirement_id = v_req.id) then
    raise exception using errcode = 'CFO03', message = 'the requirement was already distributed';
  end if;
  if v_req.urgency not in ('urgent', 'aog') then
    raise exception using errcode = 'CFO02', message = 'only urgent and AOG requirements are distributed';
  end if;
  -- Published = `open` (never a draft, paused, covered or closed one; archived ones are closed, T-64).
  if v_req.status <> 'open' or v_req.archived_at is not null then
    raise exception using errcode = 'CFO01', message = 'the requirement is not open';
  end if;
  if v_req.starts_at <= v_now then
    raise exception using errcode = 'CFO04', message = 'the requirement has started';
  end if;
  if (select count(*) from public.outreach_distributions d
      join public.work_requirements o on o.id = d.requirement_id
      where o.organization_id = v_req.organization_id
        and d.created_at > v_now - interval '24 hours') >= 10 then
    raise exception using errcode = 'CFO05', message = 'the organization reached its daily distributions';
  end if;

  v_max_mobilization := (v_req.conditions ->> 'maxMobilizationHours')::numeric;
  select r.aircraft, r.licences into v_aircraft, v_licences
  from app_private.outreach_required_ratings(v_req.id) r;

  -- The base: who this organization may reach outside itself, as its external candidate pool decides it
  -- (one definition, BR-7/BR-8/N-08: visibility not `private`, `verified_orgs` only for a reviewed
  -- organization, not a member, not blocking it), eligible for the need. The organization can already
  -- count this set (matching, the builder's live count); everything filtered after it is private.
  with base as (
    select pool.profile_id
    from app_private.ranked_external_pool(v_req.id) pool
    cross join lateral app_private.hard_eligibility(v_req.id, pool.profile_id) e
    where coalesce(e.qualifications_ok, false) and coalesce(e.availability_ok, false)
  ),
  audience as (
    select tp.profile_id
    from base
    join public.technician_profiles tp on tp.profile_id = base.profile_id
    join public.technician_notice_preferences p on p.profile_id = tp.profile_id
    -- the zone as the database knows it now; an unknown one leaves the professional out (fail closed)
    join pg_catalog.pg_timezone_names z on z.name = p.time_zone
    where case v_req.urgency when 'aog' then p.aog_opt_in else p.urgent_opt_in end
      and p.mobilization_hours is not null
      and v_req.starts_at - v_now >= make_interval(hours => p.mobilization_hours)
      -- ORG-02 #29 (requirement-builder `conditions.maxMobilizationHours`, v1.8 demo `aogAudience`)
      and (v_max_mobilization is null or p.mobilization_hours <= v_max_mobilization)
      and not app_private.in_quiet_hours(p.quiet_start, p.quiet_end,
                                         ((v_now at time zone 'UTC') + z.utc_offset)::time)
      and tp.general_restrictions is null
      and not exists (select 1 from public.technician_type_ratings r
                      where r.technician_profile_id = tp.profile_id
                        and r.restrictions is not null
                        and r.aircraft = any (v_aircraft)
                        and (cardinality(v_licences) = 0 or r.category = any (v_licences)))
      and not exists (select 1 from public.applications a
                      where a.requirement_id = v_req.id and a.technician_profile_id = tp.profile_id
                        and a.status <> 'withdrawn')
      and not exists (select 1 from public.notifications n
                      where n.kind = 'outreach' and n.requirement_id = v_req.id
                        and n.recipient_id = tp.profile_id)
      -- Flood bound (T-126): at most 3 outreach notices from one organization to one professional per
      -- 24 h, so a stream of needs never pushes the professional's other notices out of the 200 kept.
      and (select count(*) from public.notifications n
           join public.work_requirements o on o.id = n.requirement_id
           where n.kind = 'outreach' and n.recipient_id = tp.profile_id
             and o.organization_id = v_req.organization_id
             and n.created_at > v_now - interval '24 hours') < 3
  )
  select (select count(*)::integer from base),
         coalesce((select array_agg(a.profile_id order by a.profile_id) from audience a), '{}')
  into v_base, v_recipients;

  insert into public.notifications (recipient_id, kind, requirement_id)
  select r, 'outreach', v_req.id from unnest(v_recipients) r;
  v_count := cardinality(v_recipients);
  perform app_private.prune_notifications(v_recipients);

  -- T-128: below 5 eligible professionals the number is not reported (nor stored, nor audited).
  if v_base < 5 then
    v_count := null;
  end if;

  insert into public.outreach_distributions (requirement_id, urgency, notified_count, created_at)
  values (v_req.id, v_req.urgency, v_count, v_now);
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_req.organization_id, 'requirement.outreach_distributed', 'work_requirement', v_req.id,
          jsonb_build_object('notified', v_count, 'withheld', v_count is null, 'urgency', v_req.urgency,
                             'request_id', p_request_id));

  return query select v_count, v_now, v_req.urgency;
end;
$$;

revoke execute on function public.requirement_outreach(uuid, uuid) from public, anon;
grant execute on function public.requirement_outreach(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Reading the new kind. Same rules as 20261023800000 for the two application kinds; an outreach
-- notice is the recipient's own (technician side) and is listed only while its requirement is
-- published and current — `open` and not ended, the opportunities' rule (D-12) — so it never points at
-- something the professional can no longer open.
-- ---------------------------------------------------------------------------------------------
create or replace function app_private.visible_notifications()
returns table (id uuid, own boolean)
language sql
stable
set search_path = ''
as $$
  select n.id, n.kind = 'outreach' or a.technician_profile_id = n.recipient_id
  from public.notifications n
  left join public.applications a on a.id = n.application_id
  join public.work_requirements wr on wr.id = coalesce(a.requirement_id, n.requirement_id)
  where n.recipient_id = (select auth.uid())
    and n.created_at > now() - app_private.notification_retention()
    and case
          when n.kind = 'outreach' then wr.status = 'open' and wr.ends_at > now() and wr.archived_at is null
          -- An application whose technician closed the account (20261023400100: technician → NULL) is
          -- not listed (the list joins the technician): neither counted, so the bell and the list agree.
          else a.technician_profile_id is not null
               and (a.technician_profile_id = n.recipient_id
                    or public.has_org_role(wr.organization_id,
                                           array['admin', 'manager']::public.organization_role[]))
        end;
$$;

drop function public.get_my_notifications(uuid, integer, integer);

-- The caller's notices, newest first, rendered from the ids at read time (20261023800000, unchanged for
-- the application kinds). `outreach_urgency`: for an outreach notice, the urgency it was sent for
-- («Urgente» / «AOG», from its distribution); null otherwise.
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
  outreach_urgency public.requirement_urgency
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
    (count(*) over ())::integer,
    case when n.kind = 'outreach' then d.urgency end
  from app_private.visible_notifications() v
  join public.notifications n on n.id = v.id
  left join public.applications a on a.id = n.application_id
  join public.work_requirements wr on wr.id = coalesce(a.requirement_id, n.requirement_id)
  join public.organizations o on o.id = wr.organization_id
  left join public.technician_profiles tp on tp.profile_id = a.technician_profile_id
  left join public.profiles pr on pr.id = a.technician_profile_id
  left join public.organization_members m
    on m.organization_id = wr.organization_id and m.profile_id = a.technician_profile_id
  left join public.outreach_distributions d on d.requirement_id = n.requirement_id
  where p_id is null or n.id = p_id
  order by n.created_at desc, n.id desc
  offset p_offset
  limit p_limit;
end;
$$;

revoke execute on function public.get_my_notifications(uuid, integer, integer) from public, anon;
grant execute on function public.get_my_notifications(uuid, integer, integer) to authenticated;
