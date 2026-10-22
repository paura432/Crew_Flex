-- Crew Flex — the professional's notice preferences (package outreach, v2 diff 20 N-10: TEC-07 #12–#17,
-- TEC-02 #38/#47; SCOPE-2 LATER, local only; technical defaults T-120…T-123, BUSINESS_RULES BR-26).
-- v1.8 connected «Avisos de oportunidades» (`src/beta/Account.jsx:81`, saved by `server/app.mjs:71-73`):
-- «Quiero avisos internos de trabajos urgentes», «Quiero avisos internos AOG», «Horas mínimas que
-- necesitas para movilizarte» (0–720, optional), «Zona horaria IANA para avisos» (default Europe/Madrid,
-- «Zona horaria no válida.»), «Silencio desde/hasta (opcional)» («Horas de silencio no válidas.»).
-- They only decide who receives an in-app «Urgente/AOG» notice (requirement_outreach, next migration):
-- no e-mail, SMS or push exists (OUT).
--
-- NON-DESTRUCTIVE: one new table (RLS on in this file), one trigger, one SECURITY INVOKER RPC. The passport
-- (save_professional_passport, technician_profiles) is untouched: the preferences live apart, with their
-- own save, so neither form can overwrite the other.
--
-- Who reads and writes: the OWNER only (a professional — the FK to technician_profiles), under RLS. No
-- organization, colleague or platform admin reads them (when someone is in their quiet hours is
-- personal); the outreach RPC reads them as its owner, and the organization learns only a count.

create table public.technician_notice_preferences (
  profile_id uuid primary key references public.technician_profiles (profile_id) on delete cascade,
  urgent_opt_in boolean not null default false,
  aog_opt_in boolean not null default false,
  -- NULL = not declared: no outreach reaches the professional (v1.8 «Sin movilización declarada no se
  -- distribuyen avisos.»). Whole hours (T-121).
  mobilization_hours integer check (mobilization_hours between 0 and 720),
  -- An IANA name (T-122): the shape here, the zone database in the trigger below.
  time_zone text not null default 'Europe/Madrid' check (
    char_length(time_zone) <= 64
    and time_zone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+){0,2}$'),
  -- Both or neither, whole minutes, never equal (T-123); start > end spans midnight (22:00–07:00).
  quiet_start time,
  quiet_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_notice_preferences_quiet_pair check ((quiet_start is null) = (quiet_end is null)),
  constraint technician_notice_preferences_quiet_distinct check (quiet_start is null or quiet_start <> quiet_end),
  constraint technician_notice_preferences_quiet_minutes check (
    extract(second from quiet_start) = 0 and extract(second from quiet_end) = 0)
);
alter table public.technician_notice_preferences enable row level security;

create trigger technician_notice_preferences_set_updated_at
  before update on public.technician_notice_preferences
  for each row execute function public.set_updated_at();

-- The zone must exist in the database's zone list (what `at time zone` will use), matched without
-- regard to case and stored with the database's spelling: «europe/madrid» → «Europe/Madrid». A name
-- Postgres would read as a POSIX offset («UTC+3», «ABC5») is not in the list and is refused (22023,
-- the API's 400 «Zona horaria no válida.»). Every write path (RPC or direct PostgREST) passes here.
create function public.normalize_notice_time_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_name text;
begin
  select z.name into v_name
  from pg_catalog.pg_timezone_names z
  where lower(z.name) = lower(new.time_zone)
  order by z.name = new.time_zone desc, z.name
  limit 1;
  if v_name is null then
    raise exception using errcode = '22023', message = 'invalid time zone';
  end if;
  new.time_zone := v_name;
  return new;
end;
$$;
revoke execute on function public.normalize_notice_time_zone() from public, anon, authenticated;

create trigger technician_notice_preferences_time_zone
  before insert or update of time_zone on public.technician_notice_preferences
  for each row execute function public.normalize_notice_time_zone();

-- Supabase grants ALL to the API roles by default: revoke, then grant the owner's columns only.
revoke all on table public.technician_notice_preferences from anon, authenticated;
grant select on table public.technician_notice_preferences to authenticated;
grant insert (profile_id, urgent_opt_in, aog_opt_in, mobilization_hours, time_zone, quiet_start, quiet_end)
  on table public.technician_notice_preferences to authenticated;
grant update (urgent_opt_in, aog_opt_in, mobilization_hours, time_zone, quiet_start, quiet_end)
  on table public.technician_notice_preferences to authenticated;

create policy technician_notice_preferences_select_own on public.technician_notice_preferences
  for select to authenticated using (profile_id = (select auth.uid()));
create policy technician_notice_preferences_insert_own on public.technician_notice_preferences
  for insert to authenticated with check (profile_id = (select auth.uid()));
create policy technician_notice_preferences_update_own on public.technician_notice_preferences
  for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

-- The save: the caller's row (identity from the JWT, never a parameter), created on the first save and
-- replaced whole afterwards (last write wins: one owner, one small form). SECURITY INVOKER: RLS and the
-- column grants above apply; a caller without a technician profile hits the FK (23503 → 400; the Edge
-- Function answers 403 before that). Returns the stored row (the zone in the database's spelling).
create function public.save_notice_preferences(
  p_urgent_opt_in boolean,
  p_aog_opt_in boolean,
  p_mobilization_hours integer,
  p_time_zone text,
  p_quiet_start time,
  p_quiet_end time
)
returns setof public.technician_notice_preferences
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  insert into public.technician_notice_preferences as p
    (profile_id, urgent_opt_in, aog_opt_in, mobilization_hours, time_zone, quiet_start, quiet_end)
  values (v_uid, coalesce(p_urgent_opt_in, false), coalesce(p_aog_opt_in, false), p_mobilization_hours,
          coalesce(p_time_zone, 'Europe/Madrid'), p_quiet_start, p_quiet_end)
  on conflict (profile_id) do update
    set urgent_opt_in = excluded.urgent_opt_in,
        aog_opt_in = excluded.aog_opt_in,
        mobilization_hours = excluded.mobilization_hours,
        time_zone = excluded.time_zone,
        quiet_start = excluded.quiet_start,
        quiet_end = excluded.quiet_end
  returning p.*;
end;
$$;

revoke execute on function
  public.save_notice_preferences(boolean, boolean, integer, text, time, time)
from public, anon;
grant execute on function
  public.save_notice_preferences(boolean, boolean, integer, text, time, time)
to authenticated;
