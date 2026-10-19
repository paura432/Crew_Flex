-- Crew Flex — availability writes serialised per technician (independent review of 2026-10-19).
-- NON-DESTRUCTIVE: replaces the body of `replace_availability_days` (same signature, grants kept)
-- and adds one trigger function + one trigger. No table, column, policy or grant changes.
--
-- MEDIUM-1: two concurrent calls with different keys on the same day could both leave a window
-- (READ COMMITTED: the second call did not see the rows the first had just inserted). Now every
-- write to a technician's windows takes a transaction-scoped advisory lock keyed by that
-- technician: the RPC takes it before reading, and the trigger takes it for direct writes
-- (POST via `create_availability_window`, PATCH/DELETE via PostgREST). Different technicians never
-- wait for each other. The lock is re-entrant inside one transaction.
-- L3: the past-day check now runs after the idempotency claim, so a replay retried after UTC
-- midnight returns the original result instead of 22023.

create or replace function public.replace_availability_days(p_idempotency_key uuid, p_days jsonb)
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
  if v_count is distinct from jsonb_array_length(p_days) or v_count < 1 or v_count > 62 then
    raise exception using errcode = '22023', message = 'between 1 and 62 well-formed days are required';
  end if;
  if (select count(distinct e ->> 'date') from jsonb_array_elements(v_days) e) <> v_count then
    raise exception using errcode = '22023', message = 'days must be distinct';
  end if;
  -- One writer per technician at a time (finding MEDIUM-1 of the 2026-10-19 review): a concurrent
  -- call waits here, and every later statement of this call then sees what the other committed.
  perform pg_advisory_xact_lock(hashtextextended('availability:' || v_uid::text, 0));

  v_id := app_private.claim_idempotency_key('availability_days.replace', p_idempotency_key,
    jsonb_build_object('days', v_days));
  if v_id is not null then
    return query select v_id, true, null::integer;
    return;
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

  v_id := gen_random_uuid();
  perform app_private.complete_idempotency_key('availability_days.replace', p_idempotency_key, v_id);
  return query select v_id, false, v_created;
end;
$$;


create function public.lock_availability_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(
    'availability:' || coalesce(new.technician_profile_id, old.technician_profile_id)::text, 0));
  return coalesce(new, old);
end;
$$;
revoke execute on function public.lock_availability_owner() from public, anon, authenticated;

create trigger availability_windows_lock_owner
  before insert or update or delete on public.availability_windows
  for each row execute function public.lock_availability_owner();
