-- Crew Flex — Training (ADR-003, batch V19-01). Part 3 of 4: reads and the private export. LOCAL ONLY.
-- NON-DESTRUCTIVE: new functions only. Every read is a SECURITY DEFINER RPC that re-checks the caller
-- (auth.uid(), role from the database) and returns the minimum: the catalog is for signed-in users
-- (N-4 default: no anonymous catalog), providers never receive an e-mail address (N-5), platform admins
-- read requests but never messages (N-6), review notes reach the owner and admins only.

-- ---------------------------------------------------------------------------------------------
-- JSON builders (private)
-- ---------------------------------------------------------------------------------------------
create function app_private.training_iso(p timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$ select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Sessions of an edition, oldest first.
create function app_private.training_sessions_json(p_edition_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id,
           'startsAt', app_private.training_iso(lower(s.span)),
           'endsAt', app_private.training_iso(upper(s.span)),
           'location', s.location,
           'element', s.element) order by lower(s.span)), '[]'::jsonb)
  from public.training_sessions s where s.edition_id = p_edition_id;
$$;

-- One edition. `p_private` adds what only the provider and admins read (review note, cancel reason).
create function app_private.training_edition_json(p_edition_id uuid, p_private boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'courseId', e.course_id, 'mode', e.mode, 'provisional', e.provisional,
    'deadline', app_private.training_iso(e.deadline), 'capacity', e.capacity,
    'remaining', greatest(0, e.capacity - app_private.training_confirmed_seats(e.id)),
    'city', e.city, 'country', e.country, 'currency', e.currency, 'priceUnit', e.price_unit,
    'priceCents', e.price_cents, 'priceIncludes', e.price_includes, 'policy', e.policy,
    'timeZone', e.time_zone, 'status', e.status,
    'startsAt', app_private.training_iso(b.starts_at), 'endsAt', app_private.training_iso(b.ends_at),
    'sessions', app_private.training_sessions_json(e.id),
    'createdAt', app_private.training_iso(e.created_at), 'updatedAt', app_private.training_iso(e.updated_at))
    || case when p_private then jsonb_build_object('reviewNote', e.review_note, 'cancelReason', e.cancel_reason,
                                                   'reviewedAt', app_private.training_iso(e.reviewed_at))
            else '{}'::jsonb end
  from public.training_editions e
  cross join lateral app_private.training_edition_bounds(e.id) b
  where e.id = p_edition_id;
$$;

-- One course with its provider's public card. `p_private` adds the review note.
create function app_private.training_course_json(p_course_id uuid, p_private boolean)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'organizationId', c.organization_id, 'title', c.title, 'family', c.family,
    'description', c.description, 'aircraft', c.aircraft, 'engine', c.engine, 'category', c.category,
    'language', c.language, 'prerequisites', c.prerequisites, 'syllabus', c.syllabus,
    'certificateInfo', c.certificate_info, 'issuer', c.issuer, 'scope', c.scope, 'approvalRef', c.approval_ref,
    'status', c.status, 'providerName', p.name, 'providerStatus', p.status,
    'createdAt', app_private.training_iso(c.created_at), 'updatedAt', app_private.training_iso(c.updated_at))
    || case when p_private then jsonb_build_object('reviewNote', c.review_note,
                                                   'reviewedAt', app_private.training_iso(c.reviewed_at))
            else '{}'::jsonb end
  from public.training_courses c
  join public.training_providers p on p.organization_id = c.organization_id
  where c.id = p_course_id;
$$;

create function app_private.training_offer_json(p_offer_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id, 'version', o.version, 'terms', o.terms, 'totalCents', o.total_cents, 'currency', o.currency,
    'createdAt', app_private.training_iso(o.created_at))
  from public.training_offers o where o.id = p_offer_id;
$$;

create function app_private.training_request_history(p_request_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'from', e.from_status, 'to', e.to_status, 'actor', e.actor,
           'at', app_private.training_iso(e.created_at), 'offerVersion', o.version) order by e.seq), '[]'::jsonb)
  from public.training_request_events e
  left join public.training_offers o on o.id = e.offer_id
  where e.request_id = p_request_id;
$$;

-- One request as both parties read it: ids, status, the public course/edition summary, the current
-- offer and the history. No e-mail, no person id of the other party (the provider sees `applicantName`).
create function app_private.training_request_json(p_request_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'status', r.status, 'courseId', r.course_id, 'editionId', r.edition_id,
    'organizationId', r.organization_id, 'applicantName', r.applicant_name, 'note', r.note, 'units', r.units,
    'reason', r.reason, 'outcome', r.outcome,
    'currentOffer', app_private.training_offer_json(r.current_offer_id),
    'acceptedOfferId', r.accepted_offer_id,
    'history', app_private.training_request_history(r.id),
    'courseTitle', c.title, 'providerName', p.name,
    'edition', case when r.edition_id is null then null else app_private.training_edition_json(r.edition_id, false) end,
    'createdAt', app_private.training_iso(r.created_at), 'updatedAt', app_private.training_iso(r.updated_at))
  from public.training_requests r
  join public.training_courses c on c.id = r.course_id
  join public.training_providers p on p.organization_id = r.organization_id
  where r.id = p_request_id;
$$;

revoke execute on function
  app_private.training_iso(timestamptz),
  app_private.training_sessions_json(uuid),
  app_private.training_edition_json(uuid, boolean),
  app_private.training_course_json(uuid, boolean),
  app_private.training_offer_json(uuid),
  app_private.training_request_history(uuid),
  app_private.training_request_json(uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Catalog (V19-003…007 data; V19-036): published courses of reviewed providers with at least one
-- published edition, one row per course with its published editions. Filters as v1.9 `courseMatches`:
-- every word of `q` in the folded course text or provider name; family; mode / language / country /
-- date range on the editions (a course matches when one edition does; only those editions are listed).
-- 12 per page (p_limit ≤ 50). `total` = matching courses across pages. Signed-in users only.
-- ---------------------------------------------------------------------------------------------
create function public.list_training_catalog(
  p_q text default null,
  p_family public.training_family default null,
  p_mode public.training_mode default null,
  p_language text default null,
  p_country text default null,
  p_from date default null,
  p_to date default null,
  p_offset integer default 0,
  p_limit integer default 12
)
returns table (course jsonb, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_words text[];
begin
  perform app_private.require_training();
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid page';
  end if;
  select coalesce(array_agg(w), '{}') into v_words
  from regexp_split_to_table(app_private.fold_text(left(coalesce(p_q, ''), 80)), '\s+') w where w <> '';
  return query
  with live as (
    select c.id, c.title, c.family, c.search_text, p.name as provider_name
    from public.training_courses c
    join public.training_providers p on p.organization_id = c.organization_id
    where c.status = 'published' and p.status = 'reviewed'
      and (p_family is null or c.family = p_family)
      and not exists (
        select 1 from unnest(v_words) w
        where position(w in c.search_text) = 0 and position(w in app_private.fold_text(p.name)) = 0)
  ),
  editions as (
    select e.id, e.course_id, b.starts_at
    from public.training_editions e
    join live on live.id = e.course_id
    cross join lateral app_private.training_edition_bounds(e.id) b
    where e.status = 'published'
      and (p_mode is null or e.mode = p_mode)
      and (p_country is null or position(app_private.fold_text(p_country) in app_private.fold_text(e.country)) > 0)
      and (p_from is null or (b.starts_at is not null and (b.starts_at at time zone e.time_zone)::date >= p_from))
      and (p_to is null or (b.starts_at is not null and (b.starts_at at time zone e.time_zone)::date <= p_to))
  ),
  matched as (
    select live.id, live.title, live.family, min(ed.starts_at) as first_start
    from live
    join editions ed on ed.course_id = live.id
    join public.training_courses c on c.id = live.id
    where p_language is null or position(app_private.fold_text(p_language) in app_private.fold_text(c.language)) > 0
    group by live.id, live.title, live.family
  )
  select app_private.training_course_json(m.id, false)
         || jsonb_build_object('editions', (
              select jsonb_agg(app_private.training_edition_json(ed.id, false) order by ed.starts_at nulls last, ed.id)
              from editions ed where ed.course_id = m.id)),
         (count(*) over ())::integer
  from matched m
  order by m.first_start nulls last, m.title, m.id
  offset p_offset
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Course detail (V19-005): the catalog view of one live course (published editions + sessions, the
-- caller's favourite flag and own requests); the owning organization's admin/manager and platform
-- admins read it in any state with every edition and the review notes. P0002 otherwise.
-- ---------------------------------------------------------------------------------------------
create function public.get_training_course(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_private boolean;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select c.organization_id into v_org from public.training_courses c where c.id = p_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  v_private := public.has_org_role(v_org, array['admin', 'manager']::public.organization_role[])
               or public.is_platform_admin();
  if not v_private and not app_private.training_course_live(p_id) then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  return app_private.training_course_json(p_id, v_private)
    || jsonb_build_object(
         'editions', coalesce((
           select jsonb_agg(app_private.training_edition_json(e.id, v_private) order by b.starts_at nulls last, e.id)
           from public.training_editions e
           cross join lateral app_private.training_edition_bounds(e.id) b
           where e.course_id = p_id and (v_private or e.status = 'published')), '[]'::jsonb),
         'provider', (select jsonb_build_object('name', p.name, 'description', p.description, 'website', p.website)
                      from public.training_providers p where p.organization_id = v_org),
         'favorite', exists (select 1 from public.training_favorites f where f.profile_id = v_uid and f.course_id = p_id),
         'myRequests', coalesce((
           select jsonb_agg(jsonb_build_object('id', r.id, 'kind', r.kind, 'status', r.status, 'editionId', r.edition_id)
                            order by r.created_at)
           from public.training_requests r where r.course_id = p_id and r.professional_id = v_uid), '[]'::jsonb));
end;
$$;

-- The professional's saved courses (V19-018), live ones only.
create function public.get_my_training_favorites()
returns table (course jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select app_private.training_course_json(f.course_id, false)
  from public.training_favorites f
  where f.profile_id = v_uid and app_private.training_course_live(f.course_id)
  order by f.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- My requests (V19-021): the professional's own, newest first, with the current offer and history.
-- ---------------------------------------------------------------------------------------------
create function public.get_my_training_requests()
returns table (request jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  perform app_private.require_training();
  if v_uid is null or not exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select app_private.training_request_json(r.id)
  from public.training_requests r
  where r.professional_id = v_uid
  order by r.created_at desc, r.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Provider inbox (V19-022): the organization's requests (admin/manager), optionally one status,
-- newest first, paginated. The applicant is the name they typed: no e-mail (N-5), no profile id.
-- ---------------------------------------------------------------------------------------------
create function public.get_training_inbox(
  p_organization_id uuid,
  p_status public.training_request_status default null,
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (request jsonb, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform app_private.require_training();
  if not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid page';
  end if;
  return query
  select app_private.training_request_json(r.id), (count(*) over ())::integer
  from public.training_requests r
  where r.organization_id = p_organization_id and (p_status is null or r.status = p_status)
  order by r.created_at desc, r.id
  offset p_offset
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Provider workspace (V19-008/010/012): the organization's provider profile, courses and editions in
-- every state, with review notes (admin/manager). `provider` is null until the profile is saved.
-- ---------------------------------------------------------------------------------------------
create function public.get_training_workspace(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform app_private.require_training();
  if not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return jsonb_build_object(
    'provider', (
      select jsonb_build_object(
        'organizationId', p.organization_id, 'name', p.name, 'description', p.description, 'website', p.website,
        'status', p.status, 'reviewNote', p.review_note, 'reviewedAt', app_private.training_iso(p.reviewed_at),
        'createdAt', app_private.training_iso(p.created_at), 'updatedAt', app_private.training_iso(p.updated_at))
      from public.training_providers p where p.organization_id = p_organization_id),
    'courses', coalesce((
      select jsonb_agg(app_private.training_course_json(c.id, true)
               || jsonb_build_object('editions', coalesce((
                    select jsonb_agg(app_private.training_edition_json(e.id, true) order by e.created_at, e.id)
                    from public.training_editions e where e.course_id = c.id), '[]'::jsonb))
               order by c.created_at desc, c.id)
      from public.training_courses c where c.organization_id = p_organization_id), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin review queue (V19-009/011/015): providers pending, courses and editions submitted — minus
-- the caller's own organizations (they cannot review them). Oldest first. Platform admins only.
-- ---------------------------------------------------------------------------------------------
create function public.get_training_review_queue(p_offset integer default 0, p_limit integer default 20)
returns table (item jsonb, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
begin
  perform app_private.require_training();
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_offset is null or p_offset not between 0 and 10000 or p_limit is null or p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'invalid page';
  end if;
  return query
  with items as (
    select p.organization_id as id, 'provider'::text as kind, p.organization_id, p.updated_at, p.created_at,
           jsonb_build_object('name', p.name, 'description', p.description, 'website', p.website, 'status', p.status) as body
    from public.training_providers p where p.status = 'pending'
    union all
    select c.id, 'course', c.organization_id, c.updated_at, c.created_at, app_private.training_course_json(c.id, true)
    from public.training_courses c where c.status = 'submitted'
    union all
    select e.id, 'edition', e.organization_id, e.updated_at, e.created_at,
           app_private.training_edition_json(e.id, true)
             || jsonb_build_object('courseTitle', c.title, 'courseStatus', c.status)
    from public.training_editions e join public.training_courses c on c.id = e.course_id
    where e.status = 'submitted'
  )
  select jsonb_build_object('id', i.id, 'kind', i.kind, 'organizationId', i.organization_id,
                            'organizationName', o.name, 'updatedAt', app_private.training_iso(i.updated_at),
                            'submittedAt', app_private.training_iso(i.created_at), 'item', i.body),
         (count(*) over ())::integer
  from items i
  join public.organizations o on o.id = i.organization_id
  where not exists (select 1 from public.organization_members m where m.organization_id = i.organization_id and m.profile_id = v_uid)
  order by i.updated_at, i.id
  offset p_offset
  limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Messages (V19-027): the conversation of one request, oldest first, for its two participants only.
-- A platform admin is not a participant (N-6): P0002, the same as a stranger.
-- ---------------------------------------------------------------------------------------------
create function public.get_training_messages(p_request_id uuid)
returns table (id uuid, sender_side text, mine boolean, body text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_req public.training_requests%rowtype;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_req from public.training_requests r where r.id = p_request_id;
  if not found
     or not (v_req.professional_id = v_uid
             or public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[])) then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;
  return query
  select m.id, m.sender_side, m.sender_id = v_uid, m.body, m.created_at
  from public.training_messages m
  where m.request_id = p_request_id
  order by m.created_at, m.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- My confirmed sessions (V19-029/030): the live sessions of the caller's confirmed and finished
-- seats within [p_from, p_to) — the calendar «F» marker and the private iCalendar export. Own data
-- only; never writes availability.
-- ---------------------------------------------------------------------------------------------
create function public.get_my_training_sessions(p_from timestamptz, p_to timestamptz)
returns table (
  request_id uuid,
  edition_id uuid,
  session_id uuid,
  course_title text,
  provider_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  time_zone text,
  location text,
  element public.training_session_element,
  mode public.training_mode,
  city text,
  status public.training_request_status
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
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception using errcode = '22023', message = 'invalid range';
  end if;
  return query
  select r.id, e.id, s.id, c.title, p.name, lower(s.span), upper(s.span), e.time_zone, s.location, s.element,
         e.mode, e.city, r.status
  from public.training_requests r
  join public.training_editions e on e.id = r.edition_id
  join public.training_courses c on c.id = r.course_id
  join public.training_providers p on p.organization_id = r.organization_id
  join public.training_sessions s on s.edition_id = e.id
  where r.professional_id = v_uid
    and r.status in ('confirmed', 'finished')
    and s.span && tstzrange(p_from, p_to, '[)')
  order by lower(s.span), s.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Private export (V19-037): the caller's own training rows — requests with offers, history and the
-- messages of those requests, favourites. Organization-side rows belong to the organization and are
-- not a person's data. Empty objects for accounts without a technician profile.
-- ---------------------------------------------------------------------------------------------
create function public.export_my_training()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return jsonb_build_object(
    'requests', coalesce((
      select jsonb_agg(app_private.training_request_json(r.id)
               || jsonb_build_object(
                    'offers', coalesce((select jsonb_agg(app_private.training_offer_json(o.id) order by o.version)
                                        from public.training_offers o where o.request_id = r.id), '[]'::jsonb),
                    'messages', coalesce((
                      select jsonb_agg(jsonb_build_object('senderSide', m.sender_side, 'mine', m.sender_id = v_uid,
                                                          'body', m.body, 'createdAt', app_private.training_iso(m.created_at))
                                       order by m.created_at)
                      from public.training_messages m where m.request_id = r.id), '[]'::jsonb))
               order by r.created_at)
      from public.training_requests r where r.professional_id = v_uid), '[]'::jsonb),
    'favorites', coalesce((
      select jsonb_agg(jsonb_build_object('courseId', f.course_id, 'createdAt', app_private.training_iso(f.created_at))
                       order by f.created_at)
      from public.training_favorites f where f.profile_id = v_uid), '[]'::jsonb));
end;
$$;

revoke execute on function
  public.list_training_catalog(text, public.training_family, public.training_mode, text, text, date, date, integer, integer),
  public.get_training_course(uuid),
  public.get_my_training_favorites(),
  public.get_my_training_requests(),
  public.get_training_inbox(uuid, public.training_request_status, integer, integer),
  public.get_training_workspace(uuid),
  public.get_training_review_queue(integer, integer),
  public.get_training_messages(uuid),
  public.get_my_training_sessions(timestamptz, timestamptz),
  public.export_my_training()
from public, anon;
grant execute on function
  public.list_training_catalog(text, public.training_family, public.training_mode, text, text, date, date, integer, integer),
  public.get_training_course(uuid),
  public.get_my_training_favorites(),
  public.get_my_training_requests(),
  public.get_training_inbox(uuid, public.training_request_status, integer, integer),
  public.get_training_workspace(uuid),
  public.get_training_review_queue(integer, integer),
  public.get_training_messages(uuid),
  public.get_my_training_sessions(timestamptz, timestamptz),
  public.export_my_training()
to authenticated;
