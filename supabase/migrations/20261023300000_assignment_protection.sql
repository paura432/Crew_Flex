-- Crew Flex — the days of a confirmed assignment are protected (N-04; owner rule DEFAULTS of 2026-10-22:
-- v1.8's behaviour replaces the earlier technical default T-13 «not blocked»; new default T-15).
-- v1.8 connected: a calendar day with a confirmed assignment cannot be changed («No puedes modificar una
-- fecha con asignación confirmada.», `server/connected.mjs:22`) and an availability save that no longer
-- covers a confirmed assignment is refused («Conserva la disponibilidad de tus asignaciones
-- confirmadas.», `server/app.mjs:67`). Only `confirmed` applications count (v1.8 connected: `finished`,
-- `cancelled` and every earlier status protect nothing; T-16).
--
-- NON-DESTRUCTIVE: one private DEFINER helper, one DEFINER trigger function + one AFTER trigger on
-- `availability_windows`, and `create or replace` of `replace_availability_days` (same 4-argument
-- signature and grants as 20261021120000, every rule kept; two changes marked «N-04» below). No table,
-- column, policy or grant on a table changes; no data is touched.
--
-- Two rules, one SQLSTATE `CFV01` (→ 409 `reason: ASSIGNMENT_PROTECTED`, `AVAILABILITY_CONFLICTS` in
-- src/domain/availability.ts; a family apart from the applications' `CFA..`):
--   1. the calendar save (`replace_availability_days`) refuses ANY listed UTC day that overlaps the period
--      of one of the caller's confirmed assignments, whatever the new status (v1.8 day rule);
--   2. every other write — `create_availability_window` (POST), PATCH and DELETE through PostgREST, any
--      direct write with the user's JWT — is refused when it REDUCES the availability of a confirmed
--      assignment it touches and that assignment is then not covered 100 % under BR-4/BR-4.8 (the same
--      expression the confirmation checks, `app_private.hard_eligibility`). A write that only adds
--      availability is never refused, so an assignment left uncovered before this migration can still be
--      repaired (T-18). Deleting the account still cascades: the check skips a profile that is gone.
-- Lock order (deadlock-free, 20261022130300): the confirmation takes requirement row → application row →
-- technician advisory lock; availability writes take only the advisory lock (`lock_availability_owner`,
-- BEFORE trigger, and `replace_availability_days`) and then READ applications and requirements without
-- locking them. Whoever gets the advisory lock first wins; the other re-reads committed data afterwards
-- (READ COMMITTED: each statement after the lock sees the winner's commit): a confirmation then fails
-- CFA04, an availability write fails CFV01.

-- Does [p_from, p_to) overlap the period of one of the CALLER's confirmed assignments? Identity from the
-- JWT only. DEFINER because a professional cannot read the requirement rows (RLS: organization members).
-- It answers only about the caller's own applications, which they may already read (RLS `applications_select`).
create function app_private.confirmed_assignment_overlaps(p_from timestamptz, p_to timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.applications a
    join public.work_requirements r on r.id = a.requirement_id
    where a.technician_profile_id = (select auth.uid())
      and a.status = 'confirmed'
      and r.starts_at < p_to and r.ends_at > p_from
  );
$$;
revoke execute on function app_private.confirmed_assignment_overlaps(timestamptz, timestamptz)
  from public, anon;
grant execute on function app_private.confirmed_assignment_overlaps(timestamptz, timestamptz)
  to authenticated;

-- Rule 2, on every row written (AFTER: the statement's rows are in place, so a statement that moves a
-- window sees its final shape). For each confirmed assignment of the row's technician:
--   positive part = the row ∩ the period when the row adds availability for that need (`available`, or
--   `aog_only` for an AOG need); negative part = the row ∩ the period when it blocks it (`unavailable`, or
--   `aog_only` for a need that is not AOG). The write reduces the assignment's availability iff the old
--   positive part is not inside the new one, or the new negative part is not inside the old one; only
--   then is the coverage re-checked.
create function public.protect_assignment_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.applications a
    join public.work_requirements r on r.id = a.requirement_id
    cross join lateral (
      select tstzrange(r.starts_at, r.ends_at) as span,
        case when tg_op <> 'INSERT' and a.technician_profile_id = old.technician_profile_id
             then tstzrange(old.starts_at, old.ends_at) end as old_range,
        case when tg_op <> 'DELETE' and a.technician_profile_id = new.technician_profile_id
             then tstzrange(new.starts_at, new.ends_at) end as new_range,
        case when tg_op <> 'INSERT' then old.status end as old_status,
        case when tg_op <> 'DELETE' then new.status end as new_status
    ) x
    cross join lateral (
      select
        coalesce(case when x.old_status = 'available' or (x.old_status = 'aog_only' and r.urgency = 'aog')
                      then x.old_range * x.span end, 'empty'::tstzrange) as old_pos,
        coalesce(case when x.new_status = 'available' or (x.new_status = 'aog_only' and r.urgency = 'aog')
                      then x.new_range * x.span end, 'empty'::tstzrange) as new_pos,
        coalesce(case when x.old_status = 'unavailable' or (x.old_status = 'aog_only' and r.urgency <> 'aog')
                      then x.old_range * x.span end, 'empty'::tstzrange) as old_neg,
        coalesce(case when x.new_status = 'unavailable' or (x.new_status = 'aog_only' and r.urgency <> 'aog')
                      then x.new_range * x.span end, 'empty'::tstzrange) as new_neg
    ) p
    where a.status = 'confirmed'
      and a.technician_profile_id in (old.technician_profile_id, new.technician_profile_id)
      -- Account deletion (cascade): the profile is already gone and its applications follow it.
      and exists (select 1 from public.technician_profiles tp where tp.profile_id = a.technician_profile_id)
      and not (p.old_pos <@ p.new_pos and p.new_neg <@ p.old_neg)
      and not coalesce(
        (select e.availability_ok from app_private.hard_eligibility(r.id, a.technician_profile_id) e),
        false)
  ) then
    raise exception using errcode = 'CFV01',
      message = 'the availability of a confirmed assignment cannot be reduced';
  end if;
  return null;
end;
$$;
revoke execute on function public.protect_assignment_availability() from public, anon, authenticated;

create trigger availability_windows_protect_assignments
  after insert or update or delete on public.availability_windows
  for each row execute function public.protect_assignment_availability();

-- Rule 1 + the split order. Body of 20261021120000 with two changes marked «N-04».
create or replace function public.replace_availability_days(
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
  -- N-04 (rule 1): a day touched by a confirmed assignment of the caller is never edited from the
  -- calendar (v1.8 «No puedes modificar una fecha con asignación confirmada.»). After the claim and under
  -- the lock, like the checks above: a confirmation committed while this call waited is seen here.
  if exists (
    select 1 from jsonb_array_elements(v_days) e
    where app_private.confirmed_assignment_overlaps(
      (e ->> 'date')::date::timestamp at time zone 'UTC',
      ((e ->> 'date')::date + 1)::timestamp at time zone 'UTC')
  ) then
    raise exception using errcode = 'CFV01', message = 'a day of a confirmed assignment cannot be changed';
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
        -- N-04: the tail first, then shrink the head, so a confirmed assignment after the day is never
        -- uncovered in between (the protect trigger checks each statement).
        insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
        values (v_uid, v_end, v_window.ends_at, v_window.status);
        update public.availability_windows set ends_at = v_start where availability_windows.id = v_window.id;
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
