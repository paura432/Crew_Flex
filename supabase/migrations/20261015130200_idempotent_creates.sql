-- Crew Flex — idempotent creation endpoints (remediation 2026-10-15, finding I-1).
-- NON-DESTRUCTIVE: adds a schema that PostgREST does not expose, one table, two helpers and three
-- SECURITY INVOKER RPCs. Existing tables, policies, grants and RPCs are unchanged (the deployed
-- `create_work_requirement` keeps working for the currently deployed function).
--
-- Why: a lost response (timeout, network error, double submit) followed by a retry created a
-- second requirement or availability window, and a retried declaration came back as 409 although
-- the first attempt had succeeded.
--
-- Contract: the client sends `Idempotency-Key: <uuid>` once per logical operation. The key is
-- scoped to (actor = JWT subject, operation). The request hash is computed HERE from the canonical
-- parameters, so "same request" means the same thing for every caller. Within one transaction:
--   1. claim the key (INSERT … ON CONFLICT DO NOTHING). A concurrent request with the same key
--      blocks on the unique index until the first one commits or rolls back;
--   2. existing key + same hash  → return the original resource id, replayed = true;
--      existing key + other hash → SQLSTATE CF409 (→ 409 CONFLICT), nothing written;
--   3. new key → create the resource and record its id. If anything fails, the key is rolled back
--      with it, so a retry after an error starts clean.
-- Retention: keys are kept (a replay always returns the original resource). Purging rows older
-- than 30 days is an operations task (docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md §6); forms
-- generate a fresh key per logical operation, so purged keys are never reused.

create schema app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;
comment on schema app_private is
  'Not exposed by PostgREST (config.toml api.schemas). Reached only through public SECURITY INVOKER RPCs.';

create table app_private.idempotency_keys (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  operation text not null
    check (operation in ('work_requirement.create', 'availability_window.create', 'qualification.declare')),
  key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  resource_id uuid,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, key)
);
alter table app_private.idempotency_keys enable row level security;

revoke all on table app_private.idempotency_keys from public, anon, authenticated;
grant select, insert (actor_id, operation, key, request_hash) on app_private.idempotency_keys to authenticated;
grant update (resource_id) on app_private.idempotency_keys to authenticated;

create policy idempotency_keys_select_own on app_private.idempotency_keys for select to authenticated
  using (actor_id = (select auth.uid()));
create policy idempotency_keys_insert_own on app_private.idempotency_keys for insert to authenticated
  with check (actor_id = (select auth.uid()));
create policy idempotency_keys_update_own on app_private.idempotency_keys for update to authenticated
  using (actor_id = (select auth.uid())) with check (actor_id = (select auth.uid()));

-- Returns the original resource id on a replay, NULL when the key was just claimed by this call.
create function app_private.claim_idempotency_key(p_operation text, p_key uuid, p_request jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hash text := encode(sha256(convert_to(p_request::text, 'UTF8')), 'hex');
  v_existing app_private.idempotency_keys%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_key is null then
    raise exception using errcode = '22023', message = 'idempotency key is required';
  end if;

  insert into app_private.idempotency_keys (actor_id, operation, key, request_hash)
  values (v_uid, p_operation, p_key, v_hash)
  on conflict (actor_id, operation, key) do nothing;
  if found then
    return null;
  end if;

  select * into v_existing from app_private.idempotency_keys
  where actor_id = v_uid and operation = p_operation and key = p_key;
  if v_existing.request_hash <> v_hash then
    raise exception using errcode = 'CF409', message = 'idempotency key reused with a different request';
  end if;
  if v_existing.resource_id is null then -- only possible if a claim committed without a resource
    raise exception using errcode = 'CF409', message = 'idempotency key has no result';
  end if;
  return v_existing.resource_id;
end;
$$;

create function app_private.complete_idempotency_key(p_operation text, p_key uuid, p_resource_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  update app_private.idempotency_keys set resource_id = p_resource_id
  where actor_id = (select auth.uid()) and operation = p_operation and key = p_key;
$$;

revoke execute on all functions in schema app_private from public, anon;
grant execute on function
  app_private.claim_idempotency_key(text, uuid, jsonb),
  app_private.complete_idempotency_key(text, uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Work requirement (admin/manager): wraps create_work_requirement (same validation, RLS, audit).
-- Qualification order does not change the request identity.
-- ---------------------------------------------------------------------------------------------
create function public.create_work_requirement_idempotent(
  p_idempotency_key uuid,
  p_organization_id uuid,
  p_title text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_shift public.shift_type,
  p_headcount integer,
  p_urgency public.requirement_urgency,
  p_qualifications jsonb
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app_private.claim_idempotency_key('work_requirement.create', p_idempotency_key,
    jsonb_build_object(
      'organization_id', p_organization_id, 'title', p_title, 'location', p_location,
      'starts_at', p_starts_at at time zone 'UTC', 'ends_at', p_ends_at at time zone 'UTC',
      'shift', p_shift, 'headcount', p_headcount, 'urgency', p_urgency,
      'qualifications', (
        select coalesce(jsonb_agg(q order by q ->> 'qualification_type_id'), '[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(p_qualifications) = 'array'
                                       then p_qualifications else '[]'::jsonb end) q)));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  v_id := public.create_work_requirement(p_organization_id, p_title, p_location, p_starts_at,
    p_ends_at, p_shift, p_headcount, p_urgency, p_qualifications);
  perform app_private.complete_idempotency_key('work_requirement.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Availability window (professional, own): same insert the function did, owner = JWT subject.
-- ---------------------------------------------------------------------------------------------
create function public.create_availability_window(
  p_idempotency_key uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_status public.availability_status
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app_private.claim_idempotency_key('availability_window.create', p_idempotency_key,
    jsonb_build_object('starts_at', p_starts_at at time zone 'UTC',
                       'ends_at', p_ends_at at time zone 'UTC', 'status', p_status));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  insert into public.availability_windows (technician_profile_id, starts_at, ends_at, status)
  values ((select auth.uid()), p_starts_at, p_ends_at, p_status)
  returning availability_windows.id into v_id;
  perform app_private.complete_idempotency_key('availability_window.create', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Qualification declaration (professional, own): always pending (column default + insert policy).
-- ---------------------------------------------------------------------------------------------
create function public.declare_qualification(
  p_idempotency_key uuid,
  p_qualification_type_id uuid,
  p_issued_at date,
  p_expires_at date
)
returns table (id uuid, replayed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := app_private.claim_idempotency_key('qualification.declare', p_idempotency_key,
    jsonb_build_object('qualification_type_id', p_qualification_type_id,
                       'issued_at', p_issued_at, 'expires_at', p_expires_at));
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;

  insert into public.technician_qualifications
    (technician_profile_id, qualification_type_id, issued_at, expires_at)
  values ((select auth.uid()), p_qualification_type_id, p_issued_at, p_expires_at)
  returning technician_qualifications.id into v_id;
  perform app_private.complete_idempotency_key('qualification.declare', p_idempotency_key, v_id);
  return query select v_id, false;
end;
$$;

revoke execute on function
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz,
    public.shift_type, integer, public.requirement_urgency, jsonb),
  public.create_availability_window(uuid, timestamptz, timestamptz, public.availability_status),
  public.declare_qualification(uuid, uuid, date, date)
from public, anon;
grant execute on function
  public.create_work_requirement_idempotent(uuid, uuid, text, text, timestamptz, timestamptz,
    public.shift_type, integer, public.requirement_urgency, jsonb),
  public.create_availability_window(uuid, timestamptz, timestamptz, public.availability_status),
  public.declare_qualification(uuid, uuid, date, date)
to authenticated;
