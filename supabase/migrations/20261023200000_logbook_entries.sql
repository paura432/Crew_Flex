-- Crew Flex — personal logbook (M14, N-12; owner SCOPE-2, 2026-10-22). LOCAL ONLY.
-- NON-DESTRUCTIVE: adds two enums, one table with owner-only RLS, three trigger functions and one
-- SECURITY INVOKER RPC, and allows one more value in the idempotency operation CHECK (the CHECK is
-- re-created with every value it already had plus 'logbook_entry.create'). No existing row, policy
-- or grant changes. Rules: docs/product/BUSINESS_RULES.md BR-17; defaults T-19…T-22.
--
-- What it is: v1.8's «Logbook personal» (`src/components/v11/Logbook2.jsx`, connected beta
-- `server/app.mjs:140`) — a self-declared, private record of work done (FD-25: never an official
-- record, no Part-145 substitute, no supervisor validation). Therefore:
--   - the only policies are the owner's own (select/insert/update/delete). There is NO organization,
--     manager or platform-admin policy: unlike passports and availability (OD-4), an organization
--     the technician belongs to cannot read it either;
--   - `cv_relevant` («Seleccionable para expediente») is stored only. Nothing reads it for anyone
--     else: the Candidate Pack that would select entries waits for D-07 (P3) and stays off;
--   - every entry is self-declared (v1.8 `status: 'self-declared'`); there is no status column
--     because no path can make one anything else.
--
-- «No future dates» (v1.8 «El logbook registra actividad realizada, no futura.»): a date after today
-- in Europe/Madrid (v1.8 `localDay('Europe/Madrid')`, T-19) is refused by a trigger (23514), so direct
-- PostgREST writes cannot bypass it. The Edge Function checks the same rule first (src/domain/logbook.ts).
--
-- Concurrency: no lock. There is no cross-row invariant (no count limit, no ordering rule).
-- Duplicate submissions share an Idempotency-Key: the second claim blocks on the key's unique index
-- until the first commits and then replays.
--
-- Account deletion: auth.users → profiles → technician_profiles → logbook_entries all cascade; the
-- idempotency keys cascade through profiles. A cascaded delete is not audited (like documents).
--
-- Errors: 42501 not signed in / RLS · 23502/23514 CHECK or future date · 23503 not a professional
-- account (no technician profile) · CF409 same key with another request.

create type public.logbook_category as enum (
  'defect_rectification', 'inspection', 'component_replacement', 'troubleshooting',
  'sheet_metal_structures', 'cabin_interiors'
);
create type public.logbook_environment as enum (
  'line_maintenance', 'base_maintenance', 'engine_bay_check', 'aog_intervention', 'workshop'
);

create table public.logbook_entries (
  id uuid primary key default gen_random_uuid(),
  technician_profile_id uuid not null
    references public.technician_profiles (profile_id) on delete cascade,
  entry_date date not null,
  aircraft text not null check (char_length(aircraft) <= 100 and btrim(aircraft) <> ''),
  ata text check (ata is null or (char_length(ata) <= 10 and btrim(ata) <> '')),
  hours numeric(3, 1) not null check (hours between 0 and 24),
  category public.logbook_category not null default 'defect_rectification',
  environment public.logbook_environment not null default 'line_maintenance',
  description text not null check (char_length(description) <= 3000 and btrim(description) <> ''),
  cv_relevant boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.logbook_entries enable row level security;
comment on table public.logbook_entries is
  'Personal, self-declared logbook (M14). Owner only: no organization, manager or platform-admin access.';
create index logbook_entries_owner_view_idx
  on public.logbook_entries (technician_profile_id, archived, entry_date desc, created_at desc);

create trigger logbook_entries_set_updated_at before update on public.logbook_entries
  for each row execute function public.set_updated_at();

-- Owner only. `technician_profile_id` is fixed at insert; `archived` starts false (no insert grant).
revoke all on table public.logbook_entries from public, anon, authenticated;
grant select, delete on public.logbook_entries to authenticated;
grant insert (technician_profile_id, entry_date, aircraft, ata, hours, category, environment,
              description, cv_relevant)
  on public.logbook_entries to authenticated;
grant update (entry_date, aircraft, ata, hours, category, environment, description, cv_relevant,
              archived)
  on public.logbook_entries to authenticated;

create policy logbook_entries_select_own on public.logbook_entries
  for select to authenticated using (technician_profile_id = (select auth.uid()));
create policy logbook_entries_insert_own on public.logbook_entries
  for insert to authenticated with check (technician_profile_id = (select auth.uid()));
create policy logbook_entries_update_own on public.logbook_entries
  for update to authenticated
  using (technician_profile_id = (select auth.uid()))
  with check (technician_profile_id = (select auth.uid()));
create policy logbook_entries_delete_own on public.logbook_entries
  for delete to authenticated using (technician_profile_id = (select auth.uid()));

-- BR-17.2: the logbook records past activity. Re-checked whenever the date is written.
create function public.enforce_logbook_entry_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entry_date > (now() at time zone 'Europe/Madrid')::date then
    raise exception using errcode = '23514', message = 'logbook entries record past activity, not future';
  end if;
  return new;
end;
$$;
create trigger logbook_entries_enforce_date
  before insert or update of entry_date on public.logbook_entries
  for each row execute function public.enforce_logbook_entry_date();

-- Audit (S-9): ids, flags and changed field names only — never the aircraft, ATA, hours,
-- category, environment or description. A removal is audited when the owner deletes the row, not
-- when an account deletion cascades: by then the owner's technician profile is already gone, and
-- inserting an audit row for a profile being deleted would make the whole deletion fail.
create function public.audit_logbook_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_changed text[];
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (v_actor, null, 'logbook.created', 'logbook_entry', new.id,
      jsonb_build_object('technician_profile_id', new.technician_profile_id,
                         'cv_relevant', new.cv_relevant));
    return new;
  elsif tg_op = 'UPDATE' then
    v_changed := array_remove(array[
      case when new.entry_date is distinct from old.entry_date then 'entry_date' end,
      case when new.aircraft is distinct from old.aircraft then 'aircraft' end,
      case when new.ata is distinct from old.ata then 'ata' end,
      case when new.hours is distinct from old.hours then 'hours' end,
      case when new.category is distinct from old.category then 'category' end,
      case when new.environment is distinct from old.environment then 'environment' end,
      case when new.description is distinct from old.description then 'description' end,
      case when new.cv_relevant is distinct from old.cv_relevant then 'cv_relevant' end,
      case when new.archived is distinct from old.archived then 'archived' end
    ], null);
    if cardinality(v_changed) > 0 then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'logbook.updated', 'logbook_entry', new.id,
        jsonb_build_object('technician_profile_id', new.technician_profile_id,
                           'changed', to_jsonb(v_changed), 'archived', new.archived,
                           'cv_relevant', new.cv_relevant));
    end if;
    return new;
  else
    if v_actor is not null and v_actor = old.technician_profile_id and exists (
      select 1 from public.technician_profiles t where t.profile_id = old.technician_profile_id
    ) then
      insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
      values (v_actor, null, 'logbook.deleted', 'logbook_entry', old.id,
        jsonb_build_object('technician_profile_id', old.technician_profile_id,
                           'archived', old.archived));
    end if;
    return old;
  end if;
end;
$$;
create trigger logbook_entries_audit_change
  after insert or update or delete on public.logbook_entries
  for each row execute function public.audit_logbook_entry();

revoke execute on function
  public.enforce_logbook_entry_date(),
  public.audit_logbook_entry()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Idempotent create (Idempotency-Key, like 20261015130200). Owner = JWT subject.
-- The operation CHECK is extended from its CURRENT definition (not a hard-coded list), so packages
-- that add operations in parallel migrations do not drop each other's values; the re-created CHECK
-- keeps the `operation in ('…', …)` shape the earlier migrations used.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  v_def text;
  v_ops text[];
begin
  select pg_get_constraintdef(c.oid) into v_def
  from pg_constraint c
  where c.conrelid = 'app_private.idempotency_keys'::regclass
    and c.conname = 'idempotency_keys_operation_check';
  select array_agg(distinct t.m[1]) into v_ops
  from regexp_matches(coalesce(v_def, ''), '''([a-z_]+\.[a-z_]+)''', 'g') as t(m);
  if v_ops is null or not v_ops @> array['work_requirement.create', 'document.create'] then
    raise exception 'idempotency_keys_operation_check has an unexpected definition: %', v_def;
  end if;
  v_ops := array(select distinct o from unnest(v_ops || array['logbook_entry.create']) as o order by o);
  alter table app_private.idempotency_keys drop constraint idempotency_keys_operation_check;
  execute format(
    'alter table app_private.idempotency_keys add constraint idempotency_keys_operation_check check (operation in (%s))',
    (select string_agg(quote_literal(o), ', ' order by o) from unnest(v_ops) as o));
end;
$$;

create function public.create_logbook_entry(
  p_idempotency_key uuid,
  p_entry_date date,
  p_aircraft text,
  p_ata text,
  p_hours numeric,
  p_category public.logbook_category,
  p_environment public.logbook_environment,
  p_description text,
  p_cv_relevant boolean
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app_private.claim_idempotency_key('logbook_entry.create', p_idempotency_key,
    jsonb_build_object('entry_date', p_entry_date, 'aircraft', p_aircraft, 'ata', p_ata,
                       'hours', p_hours, 'category', p_category, 'environment', p_environment,
                       'description', p_description, 'cv_relevant', coalesce(p_cv_relevant, false)));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  insert into public.logbook_entries
    (technician_profile_id, entry_date, aircraft, ata, hours, category, environment, description,
     cv_relevant)
  values ((select auth.uid()), p_entry_date, p_aircraft, p_ata, p_hours, p_category, p_environment,
          p_description, coalesce(p_cv_relevant, false))
  returning logbook_entries.id into v_id;
  perform app_private.complete_idempotency_key('logbook_entry.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

revoke execute on function public.create_logbook_entry(uuid, date, text, text, numeric,
  public.logbook_category, public.logbook_environment, text, boolean) from public, anon;
grant execute on function public.create_logbook_entry(uuid, date, text, text, numeric,
  public.logbook_category, public.logbook_environment, text, boolean) to authenticated;
