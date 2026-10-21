-- Crew Flex — calendar save refuses a stale draft (V1.8 connected `version` → 409; W5-03).
-- NON-DESTRUCTIVE: no table, column or policy changes. Adds one read-only function and replaces the
-- 3-argument `replace_availability_days(uuid, jsonb, jsonb)` (20261019140000) by a 4-argument
-- version whose new `p_expected_version` defaults to NULL (= no check), so callers that name
-- `p_idempotency_key` / `p_days` / `p_rotation` (the deployed Edge Function) keep working. Deploy this
-- migration before the Edge Function that sends `p_expected_version`.
--
-- The version is a fingerprint of the caller's calendar content (windows + saved rotation), not a
-- counter: every write path (generator, single windows via RPC or PostgREST) changes it without new
-- triggers. A write that ends in the same content keeps the same version, which is harmless.

create function public.availability_version()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select md5(
    coalesce((
      select string_agg(
        concat_ws('|', aw.id, extract(epoch from aw.starts_at), extract(epoch from aw.ends_at), aw.status),
        ',' order by aw.id)
      from public.availability_windows aw
      where aw.technician_profile_id = (select auth.uid())
    ), '')
    || '#' ||
    coalesce((
      select concat_ws('|', ar.pattern, to_char(ar.anchor, 'YYYY-MM-DD'), array_to_string(ar.custom_cycle, ','))
      from public.availability_rotations ar
      where ar.technician_profile_id = (select auth.uid())
    ), '')
  );
$$;

revoke execute on function public.availability_version() from public, anon;
grant execute on function public.availability_version() to authenticated;

drop function public.replace_availability_days(uuid, jsonb, jsonb);

create function public.replace_availability_days(
  p_idempotency_key uuid,
  p_days jsonb,
  p_rotation jsonb default null,
  p_expected_version text default null
)
returns table (id uuid, replayed boolean, windows_created integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (now() at time zone 'UTC')::date;
  v_days jsonb;
  v_count integer;
  v_id uuid;
  v_day record;
  v_window record;
  v_start timestamptz;
  v_end timestamptz;
  v_created integer := 0;
  v_rotation jsonb;
  v_pattern text;
  v_anchor date;
  v_custom text[];
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_days is null or jsonb_typeof(p_days) <> 'array' then
    raise exception using errcode = '22023', message = 'days must be an array';
  end if;

  -- Validate and canonicalise (sorted by date) so the same set of days hashes the same.
  begin
    select jsonb_agg(jsonb_build_object('date', d.day, 'status', d.status) order by d.day), count(*)
    into v_days, v_count
    from (
      select (e ->> 'date')::date as day, (e ->> 'status')::public.availability_status as status
      from jsonb_array_elements(p_days) e
      where jsonb_typeof(e) = 'object'
        and (e ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$'
        and (select count(*) from jsonb_object_keys(e)) = 2
        and e ? 'date' and e ? 'status'
    ) d;
  exception when invalid_datetime_format or datetime_field_overflow or invalid_text_representation then
    raise exception using errcode = '22023', message = 'invalid day';
  end;
  v_days := coalesce(v_days, '[]'::jsonb);
  -- Saving only the pattern (no day changes) is allowed: 0 days with a rotation.
  if v_count is distinct from jsonb_array_length(p_days)
     or v_count < (case when p_rotation is null then 1 else 0 end) or v_count > 62 then
    raise exception using errcode = '22023', message = 'between 1 and 62 well-formed days are required';
  end if;
  if (select count(distinct e ->> 'date') from jsonb_array_elements(v_days) e) <> v_count then
    raise exception using errcode = '22023', message = 'days must be distinct';
  end if;
  -- Optional rotation preference: exactly { pattern, anchor, customCycle }.
  if p_rotation is not null then
    if jsonb_typeof(p_rotation) <> 'object'
       or (select count(*) from jsonb_object_keys(p_rotation)) <> 3
       or not (p_rotation ? 'pattern' and p_rotation ? 'anchor' and p_rotation ? 'customCycle')
       or jsonb_typeof(p_rotation -> 'customCycle') <> 'array'
       or (p_rotation ->> 'anchor') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'invalid rotation';
    end if;
    begin
      v_pattern := p_rotation ->> 'pattern';
      v_anchor := (p_rotation ->> 'anchor')::date;
      select coalesce(array_agg(c order by n), '{}') into v_custom
      from jsonb_array_elements_text(p_rotation -> 'customCycle') with ordinality as x(c, n);
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception using errcode = '22023', message = 'invalid rotation';
    end;
    -- Table CHECKs enforce pattern / cycle values; canonical form for the request hash.
    v_rotation := jsonb_build_object('pattern', v_pattern, 'anchor', v_anchor, 'customCycle', to_jsonb(v_custom));
  end if;

  -- One writer per technician at a time (finding MEDIUM-1 of the 2026-10-19 review): a concurrent
  -- call waits here, and every later statement of this call then sees what the other committed.
  perform pg_advisory_xact_lock(hashtextextended('availability:' || v_uid::text, 0));

  v_id := app_private.claim_idempotency_key('availability_days.replace', p_idempotency_key,
    jsonb_build_object('days', v_days, 'rotation', v_rotation));
  if v_id is not null then
    return query select v_id, true, null::integer;
    return;
  end if;
  -- Also after the claim (a replay must not conflict with its own write), and under the lock, so the
  -- calendar the client loaded is compared with what is committed now. NULL skips the check.
  if p_expected_version is not null and p_expected_version is distinct from public.availability_version() then
    raise exception using errcode = 'CF412', message = 'availability changed since it was loaded';
  end if;
  -- Checked after the claim so that a replay retried after midnight (UTC) still returns its result.
  if exists (select 1 from jsonb_array_elements(v_days) e where (e ->> 'date')::date < v_today) then
    raise exception using errcode = '22023', message = 'past days cannot be edited';
  end if;

  -- 1. Cut every listed day out of the caller's windows.
  for v_day in select (e ->> 'date')::date as day from jsonb_array_elements(v_days) e loop
    v_start := v_day.day::timestamp at time zone 'UTC';
    v_end := v_start + interval '1 day';
    for v_window in
      select aw.id, aw.starts_at, aw.ends_at, aw.status
      from public.availability_windows aw
      where aw.technician_profile_id = v_uid and aw.starts_at < v_end and aw.ends_at > v_start
      for update
    loop
      if v_window.starts_at < v_start and v_window.ends_at > v_end then
        update public.availability_windows set ends_at = v_start where availability_windows.id = v_window.id;
        insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
        values (v_uid, v_end, v_window.ends_at, v_window.status);
      elsif v_window.starts_at < v_start then
        update public.availability_windows set ends_at = v_start where availability_windows.id = v_window.id;
      elsif v_window.ends_at > v_end then
        update public.availability_windows set starts_at = v_end where availability_windows.id = v_window.id;
      else
        delete from public.availability_windows where availability_windows.id = v_window.id;
      end if;
    end loop;
  end loop;

  -- 2. One window per run of consecutive days with the same status (gaps and islands).
  for v_day in
    select min(day) as first_day, max(day) as last_day, status
    from (
      select (e ->> 'date')::date as day, (e ->> 'status')::public.availability_status as status,
        (e ->> 'date')::date - (row_number() over (
          partition by e ->> 'status' order by (e ->> 'date')::date))::integer as island
      from jsonb_array_elements(v_days) e
      where e ->> 'status' is not null
    ) s
    group by status, island
  loop
    insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
    values (v_uid, v_day.first_day::timestamp at time zone 'UTC',
            (v_day.last_day + 1)::timestamp at time zone 'UTC', v_day.status);
    v_created := v_created + 1;
  end loop;

  -- 3. The rotation preference, in the same transaction (private: owner-only RLS).
  if v_rotation is not null then
    insert into public.availability_rotations (technician_profile_id, pattern, anchor, custom_cycle)
    values (v_uid, v_pattern, v_anchor, v_custom)
    on conflict (technician_profile_id) do update
      set pattern = excluded.pattern, anchor = excluded.anchor,
          custom_cycle = excluded.custom_cycle, updated_at = now();
  end if;

  v_id := gen_random_uuid();
  perform app_private.complete_idempotency_key('availability_days.replace', p_idempotency_key, v_id);
  return query select v_id, false, v_created;
end;
$$;

revoke execute on function public.replace_availability_days(uuid, jsonb, jsonb, text) from public, anon;
grant execute on function public.replace_availability_days(uuid, jsonb, jsonb, text) to authenticated;
