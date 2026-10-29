-- Crew Flex — Training (ADR-003, batch V19-01). Part 2 of 4: the write RPCs. LOCAL ONLY.
-- NON-DESTRUCTIVE: new SECURITY DEFINER functions only (`set search_path = ''`, actor = auth.uid(),
-- revoked from public/anon, granted to authenticated). Every one refuses while the `training` flag is
-- off (0A000 → 404). Business refusals use SQLSTATE `CFT01`…`CFT13` = TRAINING_CONFLICTS in
-- src/domain/training.ts, in that order (never 40001); the generic family: 42501 the other party's
-- action / not allowed, P0002 not a party (= missing id, no oracle), 55000 not allowed from this state,
-- CF412 changed since loaded, CF409 key reused with another payload, 22023 invalid value.
--
-- Rules reproduced from v1.9 `server/training.mjs` (`act`): provider.save, course.save/submit,
-- edition.save/submit/cancel, provider/course/edition.review, saved.toggle, request.create,
-- request.offer/accept/confirm/waitlist/reject/close/withdraw/cancel/complete, request.message.

-- ---------------------------------------------------------------------------------------------
-- Provider profile (V19-008): admin/manager of the organization; every save resubmits (→ pending).
-- ---------------------------------------------------------------------------------------------
create function public.save_training_provider(
  p_organization_id uuid,
  p_name text,
  p_description text,
  p_website text default null,
  p_expected_updated_at timestamptz default null
)
returns table (organization_id uuid, status public.training_provider_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_old public.training_providers%rowtype;
  v_website text := nullif(btrim(coalesce(p_website, '')), '');
begin
  perform app_private.require_training();
  if v_uid is null
     or not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if v_website is not null and v_website !~* '^https://' then
    raise exception using errcode = '22023', message = 'the website must start with https://';
  end if;
  perform 1 from public.organizations o where o.id = p_organization_id for update;
  select * into v_old from public.training_providers p where p.organization_id = p_organization_id for update;
  if found then
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'the version the client loaded is required';
    end if;
    if date_trunc('milliseconds', v_old.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
      raise exception using errcode = 'CF412', message = 'provider changed since it was loaded';
    end if;
    update public.training_providers p
    set name = btrim(p_name), description = btrim(p_description), website = v_website,
        status = 'pending', review_note = null, reviewed_at = null
    where p.organization_id = p_organization_id;
  else
    insert into public.training_providers (organization_id, name, description, website)
    values (p_organization_id, btrim(p_name), btrim(p_description), v_website);
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_organization_id, 'training.provider_saved', 'training_provider', p_organization_id,
          jsonb_build_object('resubmitted', v_old.organization_id is not null));
  return query select p.organization_id, p.status, p.updated_at
  from public.training_providers p where p.organization_id = p_organization_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Courses (V19-010/011): save (new or own, back to draft) and submit (draft/changes/rejected → submitted).
-- ---------------------------------------------------------------------------------------------
create function public.save_training_course(
  p_organization_id uuid,
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_family public.training_family,
  p_description text,
  p_language text,
  p_certificate_info text,
  p_issuer text,
  p_scope public.training_scope default 'general',
  p_approval_ref text default null,
  p_aircraft text default null,
  p_engine text default null,
  p_category text default null,
  p_prerequisites text default null,
  p_syllabus text default null
)
returns table (id uuid, status public.training_listing_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_old public.training_courses%rowtype;
  v_id uuid;
begin
  perform app_private.require_training();
  if v_uid is null
     or not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if not exists (select 1 from public.training_providers p where p.organization_id = p_organization_id) then
    raise exception using errcode = '55000', message = 'create the provider profile first';
  end if;
  if p_scope <> 'general' and nullif(btrim(coalesce(p_approval_ref, '')), '') is null then
    raise exception using errcode = '22023', message = 'the scope reference is required';
  end if;
  if p_id is not null then
    select * into v_old from public.training_courses c where c.id = p_id for update;
    if not found or v_old.organization_id <> p_organization_id then
      raise exception using errcode = 'P0002', message = 'course not found';
    end if;
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'the version the client loaded is required';
    end if;
    if date_trunc('milliseconds', v_old.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
      raise exception using errcode = 'CF412', message = 'course changed since it was loaded';
    end if;
    update public.training_courses c
    set title = btrim(p_title), family = p_family, description = btrim(p_description),
        aircraft = nullif(btrim(coalesce(p_aircraft, '')), ''), engine = nullif(btrim(coalesce(p_engine, '')), ''),
        category = nullif(btrim(coalesce(p_category, '')), ''), language = btrim(p_language),
        prerequisites = nullif(btrim(coalesce(p_prerequisites, '')), ''),
        syllabus = nullif(btrim(coalesce(p_syllabus, '')), ''),
        certificate_info = btrim(p_certificate_info), issuer = btrim(p_issuer), scope = p_scope,
        approval_ref = case when p_scope = 'general' then null else btrim(p_approval_ref) end,
        status = 'draft', review_note = null, reviewed_at = null
    where c.id = p_id;
    v_id := p_id;
  else
    insert into public.training_courses
      (organization_id, title, family, description, aircraft, engine, category, language, prerequisites,
       syllabus, certificate_info, issuer, scope, approval_ref)
    values
      (p_organization_id, btrim(p_title), p_family, btrim(p_description),
       nullif(btrim(coalesce(p_aircraft, '')), ''), nullif(btrim(coalesce(p_engine, '')), ''),
       nullif(btrim(coalesce(p_category, '')), ''), btrim(p_language),
       nullif(btrim(coalesce(p_prerequisites, '')), ''), nullif(btrim(coalesce(p_syllabus, '')), ''),
       btrim(p_certificate_info), btrim(p_issuer), p_scope,
       case when p_scope = 'general' then null else btrim(p_approval_ref) end)
    returning training_courses.id into v_id;
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_organization_id, 'training.course_saved', 'training_course', v_id,
          jsonb_build_object('created', p_id is null));
  return query select c.id, c.status, c.updated_at from public.training_courses c where c.id = v_id;
end;
$$;

create function public.submit_training_course(p_id uuid, p_expected_updated_at timestamptz)
returns table (id uuid, status public.training_listing_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_course public.training_courses%rowtype;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_course from public.training_courses c where c.id = p_id for update;
  if not found
     or not public.has_org_role(v_course.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  if p_expected_updated_at is null
     or date_trunc('milliseconds', v_course.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'course changed since it was loaded';
  end if;
  if v_course.status not in ('draft', 'changes', 'rejected') then
    raise exception 'course status % → submitted is not allowed', v_course.status using errcode = '55000';
  end if;
  update public.training_courses c set status = 'submitted' where c.id = p_id;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_course.organization_id, 'training.course_submitted', 'training_course', p_id,
          jsonb_build_object('from', v_course.status, 'to', 'submitted'));
  return query select c.id, c.status, c.updated_at from public.training_courses c where c.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Editions (V19-012…015): save with sessions (back to draft; refused with confirmed seats CFT10 and
-- once cancelled), submit, cancel with a reason (active requests → cancelled by `system`, notified).
-- ---------------------------------------------------------------------------------------------
create function public.save_training_edition(
  p_course_id uuid,
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_mode public.training_mode,
  p_provisional boolean,
  p_capacity integer,
  p_price_unit public.training_price_unit,
  p_price_cents bigint,
  p_currency text,
  p_price_includes text,
  p_policy text,
  p_time_zone text,
  p_sessions jsonb,
  p_deadline timestamptz default null,
  p_city text default null,
  p_country text default null
)
returns table (id uuid, status public.training_listing_status, updated_at timestamptz, session_count integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_course public.training_courses%rowtype;
  v_old public.training_editions%rowtype;
  v_id uuid;
  v_sessions integer;
  v_price bigint := case when p_price_unit = 'quote' then null else p_price_cents end;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_course from public.training_courses c where c.id = p_course_id for update;
  if not found
     or not public.has_org_role(v_course.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  if p_price_unit <> 'quote' and p_price_cents is null then
    raise exception using errcode = '22023', message = 'a price is required for this unit';
  end if;
  if p_mode = 'selfpaced' and not coalesce(p_provisional, false) and p_deadline is null then
    raise exception using errcode = '22023', message = 'self-paced editions need a deadline';
  end if;
  if p_deadline is not null and p_deadline <= now() then
    raise exception using errcode = '22023', message = 'the deadline must be in the future';
  end if;
  if p_id is not null then
    select * into v_old from public.training_editions e where e.id = p_id for update;
    if not found or v_old.course_id <> p_course_id then
      raise exception using errcode = 'P0002', message = 'edition not found';
    end if;
    if p_expected_updated_at is null then
      raise exception using errcode = '22023', message = 'the version the client loaded is required';
    end if;
    if date_trunc('milliseconds', v_old.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
      raise exception using errcode = 'CF412', message = 'edition changed since it was loaded';
    end if;
    if v_old.status = 'cancelled' then
      raise exception using errcode = '55000', message = 'create another edition for new dates';
    end if;
    if app_private.training_confirmed_seats(p_id) > 0 then
      raise exception using errcode = 'CFT10', message = 'the edition has confirmed seats';
    end if;
    update public.training_editions e
    set mode = p_mode, provisional = coalesce(p_provisional, false), deadline = p_deadline, capacity = p_capacity,
        city = nullif(btrim(coalesce(p_city, '')), ''), country = nullif(btrim(coalesce(p_country, '')), ''),
        currency = coalesce(p_currency, 'EUR'), price_unit = p_price_unit, price_cents = v_price,
        price_includes = btrim(p_price_includes), policy = btrim(p_policy), time_zone = btrim(p_time_zone),
        status = 'draft', review_note = null, reviewed_at = null
    where e.id = p_id;
    v_id := p_id;
  else
    insert into public.training_editions
      (course_id, organization_id, mode, provisional, deadline, capacity, city, country, currency, price_unit,
       price_cents, price_includes, policy, time_zone)
    values
      (p_course_id, v_course.organization_id, p_mode, coalesce(p_provisional, false), p_deadline, p_capacity,
       nullif(btrim(coalesce(p_city, '')), ''), nullif(btrim(coalesce(p_country, '')), ''),
       coalesce(p_currency, 'EUR'), p_price_unit, v_price, btrim(p_price_includes), btrim(p_policy),
       btrim(p_time_zone))
    returning training_editions.id into v_id;
  end if;
  v_sessions := app_private.replace_training_sessions(v_id, p_mode, coalesce(p_provisional, false), p_sessions);
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_course.organization_id, 'training.edition_saved', 'training_edition', v_id,
          jsonb_build_object('created', p_id is null, 'course_id', p_course_id, 'sessions', v_sessions));
  return query select e.id, e.status, e.updated_at, v_sessions from public.training_editions e where e.id = v_id;
end;
$$;

create function public.submit_training_edition(p_id uuid, p_expected_updated_at timestamptz)
returns table (id uuid, status public.training_listing_status, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_edition public.training_editions%rowtype;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_edition from public.training_editions e where e.id = p_id for update;
  if not found
     or not public.has_org_role(v_edition.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = 'P0002', message = 'edition not found';
  end if;
  if p_expected_updated_at is null
     or date_trunc('milliseconds', v_edition.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'edition changed since it was loaded';
  end if;
  if v_edition.status not in ('draft', 'changes', 'rejected') then
    raise exception 'edition status % → submitted is not allowed', v_edition.status using errcode = '55000';
  end if;
  -- The dates must still be ahead (v1.9 re-normalises on submit).
  if exists (select 1 from public.training_sessions s where s.edition_id = p_id and lower(s.span) <= now())
     or (v_edition.deadline is not null and v_edition.deadline <= now()) then
    raise exception using errcode = '22023', message = 'the edition dates must be in the future';
  end if;
  update public.training_editions e set status = 'submitted' where e.id = p_id;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_edition.organization_id, 'training.edition_submitted', 'training_edition', p_id,
          jsonb_build_object('from', v_edition.status, 'to', 'submitted'));
  return query select e.id, e.status, e.updated_at from public.training_editions e where e.id = p_id;
end;
$$;

create function public.cancel_training_edition(p_id uuid, p_expected_updated_at timestamptz, p_reason text)
returns table (id uuid, status public.training_listing_status, updated_at timestamptz, requests_cancelled integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_edition public.training_editions%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_req record;
  v_count integer := 0;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_edition from public.training_editions e where e.id = p_id for update;
  if not found
     or not (public.has_org_role(v_edition.organization_id, array['admin', 'manager']::public.organization_role[])
             or public.is_platform_admin()) then
    raise exception using errcode = 'P0002', message = 'edition not found';
  end if;
  if v_reason is null or char_length(v_reason) > 2000 then
    raise exception using errcode = '22023', message = 'a reason of 1-2000 characters is required';
  end if;
  if p_expected_updated_at is null
     or date_trunc('milliseconds', v_edition.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'edition changed since it was loaded';
  end if;
  if v_edition.status = 'cancelled' then
    raise exception using errcode = '55000', message = 'the edition is already cancelled';
  end if;
  update public.training_editions e set status = 'cancelled', cancel_reason = v_reason where e.id = p_id;
  for v_req in
    select r.id, r.status from public.training_requests r
    where r.edition_id = p_id and r.status in ('received', 'waitlisted', 'offered', 'accepted', 'confirmed')
    order by r.id
    for update
  loop
    update public.training_requests r set status = 'cancelled', reason = v_reason where r.id = v_req.id;
    insert into public.training_request_events (request_id, seq, from_status, to_status, actor)
    select v_req.id, coalesce(max(e.seq), 0) + 1, v_req.status, 'cancelled', 'system'
    from public.training_request_events e where e.request_id = v_req.id;
    v_count := v_count + 1;
  end loop;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_edition.organization_id, 'training.edition_cancelled', 'training_edition', p_id,
          jsonb_build_object('from', v_edition.status, 'requests_cancelled', v_count,
                             'by_platform_admin', not public.has_org_role(v_edition.organization_id,
                                                      array['admin', 'manager']::public.organization_role[])));
  return query select e.id, e.status, e.updated_at, v_count from public.training_editions e where e.id = p_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Admin review (V19-009/011/015; N-1/N-2 defaults): platform admins only, never for an organization
-- they belong to (S-16). Provider: reviewed | rejected | suspended. Course / edition: published |
-- changes | rejected | suspended (from any reviewable state: not draft, not cancelled). A note of
-- 1–2000 characters is required except to publish / review favourably. Publishing a course needs a
-- reviewed provider; publishing an edition needs a published course (CFT11). Audited.
-- ---------------------------------------------------------------------------------------------
create function public.review_training(
  p_kind text,
  p_id uuid,
  p_decision text,
  p_expected_updated_at timestamptz,
  p_note text default null
)
returns table (id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_org uuid;
  v_from text;
  v_updated timestamptz;
  v_course uuid;
  v_favourable boolean;
begin
  perform app_private.require_training();
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_kind not in ('provider', 'course', 'edition') then
    raise exception using errcode = '22023', message = 'invalid kind';
  end if;
  if v_note is not null and char_length(v_note) > 2000 then
    raise exception using errcode = '22023', message = 'the note has at most 2000 characters';
  end if;
  if p_kind = 'provider' then
    if p_decision not in ('reviewed', 'rejected', 'suspended') then
      raise exception using errcode = '22023', message = 'invalid decision';
    end if;
    select p.organization_id, p.status::text, p.updated_at into v_org, v_from, v_updated
    from public.training_providers p where p.organization_id = p_id for update;
  else
    if p_decision not in ('published', 'changes', 'rejected', 'suspended') then
      raise exception using errcode = '22023', message = 'invalid decision';
    end if;
    if p_kind = 'course' then
      select c.organization_id, c.status::text, c.updated_at into v_org, v_from, v_updated
      from public.training_courses c where c.id = p_id for update;
    else
      select e.organization_id, e.status::text, e.updated_at, e.course_id into v_org, v_from, v_updated, v_course
      from public.training_editions e where e.id = p_id for update;
    end if;
  end if;
  if v_org is null then
    raise exception using errcode = 'P0002', message = 'not found';
  end if;
  -- S-16: an admin never reviews their own organization (any membership counts).
  if exists (select 1 from public.organization_members m where m.organization_id = v_org and m.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'an admin does not review their own organization';
  end if;
  v_favourable := p_decision in ('reviewed', 'published');
  if not v_favourable and v_note is null then
    raise exception using errcode = '22023', message = 'a reason of 1-2000 characters is required';
  end if;
  if p_expected_updated_at is null
     or date_trunc('milliseconds', v_updated) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'changed since it was loaded';
  end if;
  if p_kind <> 'provider' and v_from in ('draft', 'cancelled') then
    raise exception 'status % cannot be reviewed', v_from using errcode = '55000';
  end if;
  if p_kind = 'course' and p_decision = 'published'
     and not exists (select 1 from public.training_providers p where p.organization_id = v_org and p.status = 'reviewed') then
    raise exception using errcode = 'CFT11', message = 'review the provider first';
  end if;
  if p_kind = 'edition' and p_decision = 'published' then
    if not app_private.training_course_live(v_course) then
      raise exception using errcode = 'CFT11', message = 'publish the course first';
    end if;
    if exists (select 1 from public.training_sessions s where s.edition_id = p_id and lower(s.span) <= now())
       or exists (select 1 from public.training_editions e where e.id = p_id and e.deadline is not null and e.deadline <= now()) then
      raise exception using errcode = '22023', message = 'the edition dates must be in the future';
    end if;
  end if;

  if p_kind = 'provider' then
    update public.training_providers p
    set status = p_decision::public.training_provider_status, review_note = v_note, reviewed_at = now()
    where p.organization_id = p_id;
  elsif p_kind = 'course' then
    update public.training_courses c
    set status = p_decision::public.training_listing_status, review_note = v_note, reviewed_at = now()
    where c.id = p_id;
  else
    update public.training_editions e
    set status = p_decision::public.training_listing_status, review_note = v_note, reviewed_at = now()
    where e.id = p_id;
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_org, 'training.' || p_kind || '_reviewed', 'training_' || p_kind, p_id,
          jsonb_build_object('from', v_from, 'to', p_decision, 'note_provided', v_note is not null));
  if p_kind = 'provider' then
    return query select p.organization_id, p.status::text, p.updated_at from public.training_providers p where p.organization_id = p_id;
  elsif p_kind = 'course' then
    return query select c.id, c.status::text, c.updated_at from public.training_courses c where c.id = p_id;
  else
    return query select e.id, e.status::text, e.updated_at from public.training_editions e where e.id = p_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Favourites (V19-018): professionals, published courses only; returns the new state.
-- ---------------------------------------------------------------------------------------------
create function public.toggle_training_favorite(p_course_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  perform app_private.require_training();
  if v_uid is null or not exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if not app_private.training_course_live(p_course_id) then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  delete from public.training_favorites f where f.profile_id = v_uid and f.course_id = p_course_id;
  if found then
    return false;
  end if;
  insert into public.training_favorites (profile_id, course_id) values (v_uid, p_course_id);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Request (V19-019/020): an inquiry (any published course; provisional editions admit nothing else)
-- or a seat (a published, non-provisional edition with future dates). Professionals only, never
-- for an organization they belong to (CFT04); one active request per edition (CFT03). Lock the
-- edition, claim the key, then the checks (a replay returns its own result).
-- ---------------------------------------------------------------------------------------------
create function public.create_training_request(
  p_idempotency_key uuid,
  p_course_id uuid,
  p_edition_id uuid,
  p_kind public.training_request_kind,
  p_applicant_name text,
  p_note text default null,
  p_units integer default 1,
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
  v_course public.training_courses%rowtype;
  v_edition public.training_editions%rowtype;
  v_units integer := coalesce(p_units, 1);
  v_name text := nullif(btrim(coalesce(p_applicant_name, '')), '');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
  v_ends timestamptz;
begin
  perform app_private.require_training();
  if v_uid is null or not exists (select 1 from public.technician_profiles tp where tp.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key is required';
  end if;
  if v_name is null or char_length(v_name) > 180 then
    raise exception using errcode = '22023', message = 'a contact name of 1-180 characters is required';
  end if;
  if v_note is not null and char_length(v_note) > 3000 then
    raise exception using errcode = '22023', message = 'the note has at most 3000 characters';
  end if;
  if v_units not between 1 and 50 then
    raise exception using errcode = '22023', message = 'units must be between 1 and 50';
  end if;
  if p_kind = 'seat' and p_edition_id is null then
    raise exception using errcode = '22023', message = 'a seat request names an edition';
  end if;

  select * into v_course from public.training_courses c where c.id = p_course_id;
  if not found or not app_private.training_course_live(p_course_id) then
    raise exception using errcode = 'P0002', message = 'course not found';
  end if;
  if p_edition_id is not null then
    select * into v_edition from public.training_editions e where e.id = p_edition_id for update;
    if not found or v_edition.course_id <> p_course_id then
      raise exception using errcode = 'P0002', message = 'edition not found';
    end if;
  end if;

  v_id := app_private.claim_idempotency_key('training_request.create', p_idempotency_key,
    jsonb_build_object('course_id', p_course_id, 'edition_id', p_edition_id, 'kind', p_kind,
                       'applicant_name', v_name, 'note', v_note, 'units', v_units));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  if exists (select 1 from public.organization_members m where m.organization_id = v_course.organization_id and m.profile_id = v_uid) then
    raise exception using errcode = 'CFT04', message = 'you cannot request a course of your own organization';
  end if;
  if p_edition_id is not null then
    if v_edition.status <> 'published' then
      raise exception using errcode = 'CFT01', message = 'the edition admits no new requests';
    end if;
    if p_kind = 'seat' then
      if v_edition.provisional then
        raise exception using errcode = 'CFT02', message = 'provisional dates admit inquiries only';
      end if;
      select b.ends_at into v_ends from app_private.training_edition_bounds(p_edition_id) b;
      if v_ends is null or v_ends <= now() then
        raise exception using errcode = 'CFT01', message = 'the edition admits no new requests';
      end if;
    end if;
    if exists (
      select 1 from public.training_requests r
      where r.edition_id = p_edition_id and r.professional_id = v_uid
        and r.status in ('received', 'waitlisted', 'offered', 'accepted', 'confirmed')
    ) then
      raise exception using errcode = 'CFT03', message = 'a request for this edition is already active';
    end if;
    if v_edition.price_unit = 'person' then
      v_units := 1;
    end if;
  else
    v_units := 1;
  end if;

  insert into public.training_requests
    (course_id, edition_id, organization_id, professional_id, kind, applicant_name, note, units)
  values (p_course_id, p_edition_id, v_course.organization_id, v_uid, p_kind, v_name, v_note, v_units)
  returning training_requests.id into v_id;
  insert into public.training_request_events (request_id, seq, from_status, to_status, actor)
  values (v_id, 1, null, 'received', 'professional');
  -- The actor is the professional: no organization id in their audit row (T-04).
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'training.request_received', 'training_request', v_id,
          jsonb_build_object('kind', p_kind, 'course_id', p_course_id, 'edition_id', p_edition_id,
                             'request_id', p_request_id));
  perform app_private.complete_idempotency_key('training_request.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- One generic transition (TRAINING_TRANSITIONS). One transaction:
--   1. lock the edition (if any), then the request;
--   2. the caller's side from the database: professional = the requester; provider = admin/manager of
--      the provider organization (a member who is also the requester cannot exist: CFT04); neither →
--      P0002 (= a missing id);
--   3. claim the Idempotency-Key BEFORE the state checks (a replay returns its own result);
--   4. the pair exists for the other side only → 42501; not at all → 55000; inquiries may only be
--      closed / rejected / withdrawn; seats are never `closed`; reason exactly for rejected/cancelled;
--      outcome exactly for finished; the offer id and the acceptance exactly for accepted; a quote total
--      exactly when offering a `quote` edition;
--   5. optimistic version (CF412);
--   6. targets: offered → the edition must be live and not provisional (CFT01/CFT02) and writes offer
--      version n+1 (frozen terms, price in cents); accepted → the CURRENT offer (CFT05); confirmed →
--      the edition still live (CFT01), the offer built from the current course and edition versions
--      (CFT06), the professional's advisory lock, no overlap with confirmed employment or training
--      (CFT08), seats < capacity under the edition lock (CFT07); finished → the last session ended
--      (CFT09; self-paced: whenever);
--   7. event row + audit + key completion. Notices follow by trigger (20261029100400).
-- ---------------------------------------------------------------------------------------------
create function public.transition_training_request(
  p_request_id uuid,
  p_to public.training_request_status,
  p_expected_updated_at timestamptz,
  p_idempotency_key uuid,
  p_reason text default null,
  p_offer_id uuid default null,
  p_accept_terms boolean default null,
  p_outcome public.training_outcome default null,
  p_quote_total_cents bigint default null,
  p_trace_id uuid default null
)
returns table (
  request_id uuid,
  status public.training_request_status,
  event_id uuid,
  offer_id uuid,
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
  v_req public.training_requests%rowtype;
  v_edition public.training_editions%rowtype;
  v_course public.training_courses%rowtype;
  v_provider public.training_providers%rowtype;
  v_side text;
  v_reason_required boolean;
  v_event_id uuid;
  v_offer_id uuid;
  v_version integer;
  v_seq integer;
  v_total bigint;
  v_ends timestamptz;
  v_now timestamptz := now();
begin
  perform app_private.require_training();
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

  select r.edition_id into v_edition.id from public.training_requests r where r.id = p_request_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;
  if v_edition.id is not null then
    select * into v_edition from public.training_editions e where e.id = v_edition.id for update;
  end if;
  select * into v_req from public.training_requests r where r.id = p_request_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;

  if v_req.professional_id = v_uid then
    v_side := 'professional';
  elsif public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    v_side := 'provider';
  else
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;

  v_event_id := app_private.claim_idempotency_key('training_request.transition', p_idempotency_key,
    jsonb_build_object(
      'request_id', p_request_id, 'to', p_to,
      'expected_updated_at', date_trunc('milliseconds', p_expected_updated_at) at time zone 'UTC',
      'reason', v_reason, 'offer_id', p_offer_id, 'accept_terms', p_accept_terms, 'outcome', p_outcome,
      'quote_total_cents', p_quote_total_cents));
  if v_event_id is not null then
    return query
    select e.request_id, e.to_status, e.id, e.offer_id, e.created_at, true
    from public.training_request_events e where e.id = v_event_id;
    return;
  end if;

  select t.reason_required into v_reason_required
  from app_private.training_transitions t
  where t.from_status = v_req.status and t.to_status = p_to and t.actor = v_side;
  if not found then
    if exists (select 1 from app_private.training_transitions t
               where t.from_status = v_req.status and t.to_status = p_to and t.actor <> 'system') then
      raise exception using errcode = '42501', message = 'this action belongs to the other party';
    end if;
    raise exception 'request status % → % is not allowed', v_req.status, p_to using errcode = '55000';
  end if;
  if v_req.kind = 'inquiry' and p_to not in ('closed', 'rejected', 'withdrawn') then
    raise exception 'an inquiry cannot become %', p_to using errcode = '55000';
  end if;
  if v_req.kind = 'seat' and p_to = 'closed' then
    raise exception using errcode = '55000', message = 'a seat request is not closed; reject or withdraw it';
  end if;
  if v_reason_required then
    if v_reason is null or char_length(v_reason) > 2000 then
      raise exception using errcode = '22023', message = 'a reason of 1-2000 characters is required';
    end if;
  elsif p_reason is not null then
    raise exception using errcode = '22023', message = 'this transition takes no reason';
  end if;
  if p_to = 'accepted' then
    if p_offer_id is null then
      raise exception using errcode = '22023', message = 'the accepted offer is required';
    end if;
    if p_accept_terms is distinct from true then
      raise exception using errcode = '22023', message = 'the explicit acceptance of the terms is required';
    end if;
  elsif p_offer_id is not null or p_accept_terms is not null then
    raise exception using errcode = '22023', message = 'only an acceptance names an offer';
  end if;
  if (p_to = 'finished') <> (p_outcome is not null) then
    raise exception using errcode = '22023', message = 'the outcome is recorded exactly when finishing';
  end if;
  if p_quote_total_cents is not null and (p_to <> 'offered' or p_quote_total_cents not between 0 and 500000000) then
    raise exception using errcode = '22023', message = 'a quote total belongs to an offer only';
  end if;

  if date_trunc('milliseconds', v_req.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'request changed since it was loaded';
  end if;

  case p_to
    when 'offered' then
      if v_edition.status <> 'published' or not app_private.training_course_live(v_req.course_id) then
        raise exception using errcode = 'CFT01', message = 'the edition admits no new offers';
      end if;
      if v_edition.provisional then
        raise exception using errcode = 'CFT02', message = 'confirm the edition dates first';
      end if;
      select * into v_course from public.training_courses c where c.id = v_req.course_id;
      select * into v_provider from public.training_providers p where p.organization_id = v_req.organization_id;
      if v_edition.price_unit = 'quote' then
        if p_quote_total_cents is null then
          raise exception using errcode = '22023', message = 'the agreed total is required for a quote';
        end if;
        v_total := p_quote_total_cents;
      else
        v_total := v_edition.price_cents * v_req.units;
      end if;
      select coalesce(max(o.version), 0) + 1 into v_version from public.training_offers o where o.request_id = v_req.id;
      insert into public.training_offers
        (request_id, version, terms, total_cents, currency, course_updated_at, edition_updated_at)
      values (v_req.id, v_version, jsonb_build_object(
          'title', v_course.title, 'provider', v_provider.name, 'issuer', v_course.issuer,
          'certificateInfo', v_course.certificate_info, 'prerequisites', v_course.prerequisites,
          'mode', v_edition.mode, 'timeZone', v_edition.time_zone, 'deadline', v_edition.deadline,
          'city', v_edition.city, 'country', v_edition.country,
          'policy', v_edition.policy, 'priceIncludes', v_edition.price_includes,
          'currency', v_edition.currency, 'priceUnit', v_edition.price_unit, 'units', v_req.units,
          'totalCents', v_total,
          'sessions', coalesce((
            select jsonb_agg(jsonb_build_object(
                     'startsAt', to_char(lower(s.span) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                     'endsAt', to_char(upper(s.span) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                     'location', s.location, 'element', s.element) order by lower(s.span))
            from public.training_sessions s where s.edition_id = v_edition.id), '[]'::jsonb)),
        v_total, v_edition.currency, v_course.updated_at, v_edition.updated_at)
      returning id into v_offer_id;
    when 'accepted' then
      if p_offer_id is distinct from v_req.current_offer_id then
        raise exception using errcode = 'CFT05', message = 'the offer is not the current version';
      end if;
      v_offer_id := p_offer_id;
    when 'confirmed' then
      if v_edition.status <> 'published' or not app_private.training_course_live(v_req.course_id) then
        raise exception using errcode = 'CFT01', message = 'the edition admits no confirmation';
      end if;
      if exists (
        select 1 from public.training_offers o
        join public.training_courses c on c.id = v_req.course_id
        where o.id = v_req.accepted_offer_id
          and (o.course_updated_at <> c.updated_at or o.edition_updated_at <> v_edition.updated_at)
      ) then
        raise exception using errcode = 'CFT06', message = 'the terms changed: send them again';
      end if;
      -- Employment confirmations and availability writes of this professional wait here (one key).
      perform pg_advisory_xact_lock(hashtextextended('availability:' || v_req.professional_id::text, 0));
      if app_private.training_edition_conflicts(v_edition.id, v_req.professional_id, v_req.id) then
        raise exception using errcode = 'CFT08', message = 'the sessions overlap confirmed work or training';
      end if;
      if app_private.training_confirmed_seats(v_edition.id) >= v_edition.capacity then
        raise exception using errcode = 'CFT07', message = 'no seats left: use the waiting list';
      end if;
    when 'finished' then
      if v_edition.mode <> 'selfpaced' then
        select b.ends_at into v_ends from app_private.training_edition_bounds(v_edition.id) b;
        if v_ends is null or v_ends > v_now then
          raise exception using errcode = 'CFT09', message = 'the last session has not ended';
        end if;
      end if;
    else
      null; -- waitlisted, rejected, closed, withdrawn, cancelled: possible whenever their row allows them
  end case;

  update public.training_requests r
  set status = p_to,
      reason = case when v_reason_required then v_reason end,
      outcome = case when p_to = 'finished' then p_outcome end,
      current_offer_id = case when p_to = 'offered' then v_offer_id else r.current_offer_id end,
      accepted_offer_id = case when p_to = 'accepted' then v_offer_id else r.accepted_offer_id end
  where r.id = v_req.id;

  select coalesce(max(e.seq), 0) + 1 into v_seq from public.training_request_events e where e.request_id = v_req.id;
  insert into public.training_request_events (request_id, seq, from_status, to_status, actor, offer_id)
  values (v_req.id, v_seq, v_req.status, p_to, v_side, v_offer_id)
  returning id into v_event_id;

  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when v_side = 'provider' then v_req.organization_id end,
    'training.request_' || p_to::text, 'training_request', v_req.id,
    jsonb_build_object('from', v_req.status, 'to', p_to, 'actor', v_side, 'edition_id', v_req.edition_id,
                       'offer_version', v_version, 'reason_provided', v_reason is not null,
                       'outcome', p_outcome, 'request_id', p_trace_id));

  perform app_private.complete_idempotency_key('training_request.transition', p_idempotency_key, v_event_id);
  return query select v_req.id, p_to, v_event_id, v_offer_id, v_now, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Messages (V19-027): the two participants, while the request is not withdrawn/rejected/cancelled/
-- closed (finished keeps the conversation open, v1.9). Platform admins are not participants (N-6).
-- ---------------------------------------------------------------------------------------------
create function public.send_training_message(p_request_id uuid, p_idempotency_key uuid, p_body text)
returns table (id uuid, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_req public.training_requests%rowtype;
  v_side text;
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
  v_id uuid;
begin
  perform app_private.require_training();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'idempotency key is required';
  end if;
  if v_body is null or char_length(v_body) > 3000 then
    raise exception using errcode = '22023', message = 'a message of 1-3000 characters is required';
  end if;
  select * into v_req from public.training_requests r where r.id = p_request_id for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;
  if v_req.professional_id = v_uid then
    v_side := 'professional';
  elsif public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    v_side := 'provider';
  else
    raise exception using errcode = 'P0002', message = 'request not found';
  end if;
  v_id := app_private.claim_idempotency_key('training_message.create', p_idempotency_key,
    jsonb_build_object('request_id', p_request_id, 'body', v_body));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;
  if v_req.status in ('withdrawn', 'rejected', 'cancelled', 'closed') then
    raise exception using errcode = 'CFT13', message = 'the conversation is closed';
  end if;
  insert into public.training_messages (request_id, sender_id, sender_side, body)
  values (p_request_id, v_uid, v_side, v_body)
  returning training_messages.id into v_id;
  perform app_private.complete_idempotency_key('training_message.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

revoke execute on function
  public.save_training_provider(uuid, text, text, text, timestamptz),
  public.save_training_course(uuid, uuid, timestamptz, text, public.training_family, text, text, text, text,
    public.training_scope, text, text, text, text, text, text),
  public.submit_training_course(uuid, timestamptz),
  public.save_training_edition(uuid, uuid, timestamptz, public.training_mode, boolean, integer,
    public.training_price_unit, bigint, text, text, text, text, jsonb, timestamptz, text, text),
  public.submit_training_edition(uuid, timestamptz),
  public.cancel_training_edition(uuid, timestamptz, text),
  public.review_training(text, uuid, text, timestamptz, text),
  public.toggle_training_favorite(uuid),
  public.create_training_request(uuid, uuid, uuid, public.training_request_kind, text, text, integer, uuid),
  public.transition_training_request(uuid, public.training_request_status, timestamptz, uuid, text, uuid, boolean,
    public.training_outcome, bigint, uuid),
  public.send_training_message(uuid, uuid, text)
from public, anon;
grant execute on function
  public.save_training_provider(uuid, text, text, text, timestamptz),
  public.save_training_course(uuid, uuid, timestamptz, text, public.training_family, text, text, text, text,
    public.training_scope, text, text, text, text, text, text),
  public.submit_training_course(uuid, timestamptz),
  public.save_training_edition(uuid, uuid, timestamptz, public.training_mode, boolean, integer,
    public.training_price_unit, bigint, text, text, text, text, jsonb, timestamptz, text, text),
  public.submit_training_edition(uuid, timestamptz),
  public.cancel_training_edition(uuid, timestamptz, text),
  public.review_training(text, uuid, text, timestamptz, text),
  public.toggle_training_favorite(uuid),
  public.create_training_request(uuid, uuid, uuid, public.training_request_kind, text, text, integer, uuid),
  public.transition_training_request(uuid, public.training_request_status, timestamptz, uuid, text, uuid, boolean,
    public.training_outcome, bigint, uuid),
  public.send_training_message(uuid, uuid, text)
to authenticated;
