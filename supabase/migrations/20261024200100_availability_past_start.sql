-- Crew Flex — a single availability window cannot start on a past UTC day, also on the server (N-26, the
-- rest of B-12; X-19 added the rule to the form only). LOCAL ONLY. BUSINESS_RULES BR-4.6, default T-104.
-- v1.8 refuses past days in the calendar on the server too (`server/connected.mjs:20`); its interval
-- editor does not (`server/rules.mjs:10`) — the diff marks this task optional; the owner wanted the backend
-- change documented (BR-4.6).
--
-- Rule (the form's `refusesPastStart`, `src/features/availability/calendar.ts`): a window that is CREATED,
-- or whose start MOVES, may not start before today 00:00 UTC (BR-10). Editing the window in progress
-- without moving its start keeps working (same minute = not moved, the form's precision), and so do
-- `DELETE`, the end and the status. The calendar save (`replace_availability_days`) already refuses past
-- days itself and never moves a start into the past (it trims ends, moves starts forward, inserts islands
-- from today), so it is unaffected; its replay-after-midnight rule holds here too: a replayed
-- `create_availability_window` returns the stored id from the idempotency claim and inserts nothing.
--
-- Scope: writes made through the Data API with a user JWT (`current_user = 'authenticated'`): PostgREST
-- writes and the SECURITY INVOKER RPCs (`create_availability_window`, `replace_availability_days`).
-- Seeds, migrations, operators in SQL and service-role fixtures keep inserting historic windows.
--
-- Compatibility (old clients): SQLSTATE 22023 is what every deployed `professional-availability` already
-- maps to 400 `VALIDATION_ERROR` (`fromDatabaseError`), so an old function answers a clean 400 and the new
-- one adds the field issue `startsAt: v.start.future` (hint `past_start`, `windowWriteError`). The current
-- web form never sends such a write (X-19), except across midnight UTC, where it now gets that field error
-- instead of a silent past window.
--
-- NON-DESTRUCTIVE: one INVOKER trigger function + one BEFORE trigger. Nothing else changes; the triggers of
-- the calendar package (`availability_windows_protect_assignments`) and `replace_availability_days` are not
-- touched. No row is changed: existing past windows stay as they are.

create function public.refuse_past_availability_start()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and (tg_op = 'INSERT'
          or date_trunc('minute', new.starts_at) is distinct from date_trunc('minute', old.starts_at))
     and new.starts_at < ((now() at time zone 'UTC')::date)::timestamp at time zone 'UTC' then
    raise exception using errcode = '22023',
      message = 'an availability window cannot start on a past day',
      hint = 'past_start';
  end if;
  return new;
end;
$$;
revoke execute on function public.refuse_past_availability_start() from public, anon, authenticated;

create trigger availability_windows_refuse_past_start
  before insert or update of starts_at on public.availability_windows
  for each row execute function public.refuse_past_availability_start();
