-- Crew Flex — Foundation V0
--
-- Creates the V0 data model with Row Level Security enabled on every table from the start.
-- NON-DESTRUCTIVE: this migration only creates objects. No DROP, no TRUNCATE, no DELETE.
-- Docs: docs/product/DATA_MODEL.md, docs/architecture/AUTHORIZATION.md

-- ---------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------
create type public.account_type as enum ('professional', 'organization');
create type public.platform_role as enum ('user', 'platform_admin');
create type public.mobility as enum ('local', 'national', 'international');
create type public.technician_status as enum ('employed', 'contractor', 'between_contracts');
create type public.profile_visibility as enum ('private', 'anonymous', 'open');
create type public.organization_type as enum ('mro', 'airline', 'operator', 'staffing_agency', 'other');
create type public.organization_role as enum ('member', 'manager', 'admin');
create type public.qualification_category as enum ('LICENSE', 'TYPE_RATING', 'TRAINING', 'APPROVAL', 'SKILL');
create type public.qualification_status as enum ('active', 'withdrawn');
create type public.verification_status as enum ('pending', 'verified', 'rejected', 'expired');
create type public.availability_status as enum ('available', 'unavailable');
create type public.shift_type as enum ('day', 'night', 'split', 'flexible');
create type public.requirement_urgency as enum ('planned', 'urgent', 'aog');
create type public.requirement_status as enum ('draft', 'open', 'covered', 'cancelled', 'closed');
create type public.requirement_level as enum ('hard', 'soft');

-- ---------------------------------------------------------------------------------------------
-- Reusable trigger: keep updated_at current on UPDATE.
-- ---------------------------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Tables (RLS enabled immediately after each create)
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  account_type public.account_type not null,
  platform_role public.platform_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.technician_profiles (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  base_location text check (char_length(base_location) <= 80),
  mobility public.mobility not null default 'national',
  years_experience integer check (years_experience between 0 and 60),
  current_status public.technician_status not null default 'employed',
  visibility public.profile_visibility not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.technician_profiles enable row level security;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  type public.organization_type not null default 'mro',
  country text check (country ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);
alter table public.organization_members enable row level security;
create index organization_members_profile_id_idx on public.organization_members (profile_id);

create table public.qualification_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9.\-]{0,31}$'),
  name text not null check (char_length(name) between 2 and 120),
  category public.qualification_category not null,
  requires_expiry boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.qualification_types enable row level security;

create table public.technician_qualifications (
  id uuid primary key default gen_random_uuid(),
  technician_profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  qualification_type_id uuid not null references public.qualification_types (id) on delete restrict,
  status public.qualification_status not null default 'active',
  issued_at date,
  expires_at date,
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (technician_profile_id, qualification_type_id),
  check (expires_at is null or issued_at is null or expires_at >= issued_at)
);
alter table public.technician_qualifications enable row level security;
create index technician_qualifications_type_idx on public.technician_qualifications (qualification_type_id);

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  technician_profile_id uuid not null references public.technician_profiles (profile_id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.availability_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
alter table public.availability_windows enable row level security;
create index availability_windows_technician_range_idx
  on public.availability_windows (technician_profile_id, starts_at, ends_at);

create table public.work_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  location text not null check (char_length(location) between 2 and 80),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  shift public.shift_type not null default 'day',
  headcount integer not null check (headcount between 1 and 50),
  urgency public.requirement_urgency not null default 'planned',
  status public.requirement_status not null default 'open',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at <= starts_at + interval '366 days')
);
alter table public.work_requirements enable row level security;
create index work_requirements_org_starts_idx on public.work_requirements (organization_id, starts_at);

create table public.work_requirement_qualifications (
  id uuid primary key default gen_random_uuid(),
  work_requirement_id uuid not null references public.work_requirements (id) on delete cascade,
  qualification_type_id uuid not null references public.qualification_types (id) on delete restrict,
  requirement_level public.requirement_level not null,
  unique (work_requirement_id, qualification_type_id)
);
alter table public.work_requirement_qualifications enable row level security;

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text not null check (char_length(entity_type) between 1 and 64),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.audit_events enable row level security;
create index audit_events_org_created_idx on public.audit_events (organization_id, created_at desc);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger technician_profiles_set_updated_at before update on public.technician_profiles
  for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger technician_qualifications_set_updated_at before update on public.technician_qualifications
  for each row execute function public.set_updated_at();
create trigger availability_windows_set_updated_at before update on public.availability_windows
  for each row execute function public.set_updated_at();
create trigger work_requirements_set_updated_at before update on public.work_requirements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so policies can consult memberships without
-- recursive RLS evaluation. They only ever answer about the calling user (auth.uid()).
-- ---------------------------------------------------------------------------------------------
create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and platform_role = 'platform_admin'
  );
$$;

create function public.has_org_role(p_organization_id uuid, p_roles public.organization_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and profile_id = (select auth.uid())
      and role = any (p_roles)
  );
$$;

create function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_org_role(p_organization_id, enum_range(null::public.organization_role));
$$;

-- True when the caller is admin/manager of an organization that p_profile_id belongs to
-- (internal workforce visibility, OPEN_DECISIONS OD-4).
create function public.can_view_member(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members target
    join public.organization_members me on me.organization_id = target.organization_id
    where target.profile_id = p_profile_id
      and me.profile_id = (select auth.uid())
      and me.role in ('admin', 'manager')
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Privileges. Supabase grants ALL to anon/authenticated by default; we replace that with
-- explicit, minimal grants. anon gets nothing.
-- ---------------------------------------------------------------------------------------------
revoke all on table
  public.profiles,
  public.technician_profiles,
  public.organizations,
  public.organization_members,
  public.qualification_types,
  public.technician_qualifications,
  public.availability_windows,
  public.work_requirements,
  public.work_requirement_qualifications,
  public.audit_events
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select on public.technician_profiles to authenticated;
grant insert (profile_id, base_location, mobility, years_experience, current_status, visibility)
  on public.technician_profiles to authenticated;
grant update (base_location, mobility, years_experience, current_status, visibility)
  on public.technician_profiles to authenticated;

grant select on public.organizations to authenticated;
grant update (name, type, country) on public.organizations to authenticated;

grant select, delete on public.organization_members to authenticated;
grant update (role) on public.organization_members to authenticated;

grant select on public.qualification_types to authenticated;

grant select, delete on public.technician_qualifications to authenticated;
grant insert (technician_profile_id, qualification_type_id, status, issued_at, expires_at)
  on public.technician_qualifications to authenticated;
grant update (qualification_type_id, status, issued_at, expires_at)
  on public.technician_qualifications to authenticated;

grant select, delete on public.availability_windows to authenticated;
grant insert (technician_profile_id, starts_at, ends_at, status)
  on public.availability_windows to authenticated;
grant update (starts_at, ends_at, status) on public.availability_windows to authenticated;

grant select on public.work_requirements to authenticated;
grant insert (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
  on public.work_requirements to authenticated;
grant update (title, location, starts_at, ends_at, shift, headcount, urgency, status)
  on public.work_requirements to authenticated;

grant select, insert, delete on public.work_requirement_qualifications to authenticated;

grant select on public.audit_events to authenticated;

revoke execute on function
  public.set_updated_at(),
  public.is_platform_admin(),
  public.has_org_role(uuid, public.organization_role[]),
  public.is_org_member(uuid),
  public.can_view_member(uuid)
from public, anon;
grant execute on function
  public.is_platform_admin(),
  public.has_org_role(uuid, public.organization_role[]),
  public.is_org_member(uuid),
  public.can_view_member(uuid)
to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policies (explicit per command; no FOR ALL)
-- ---------------------------------------------------------------------------------------------

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_view_member(id) or public.is_platform_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- technician_profiles
create policy technician_profiles_select on public.technician_profiles for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.can_view_member(profile_id)
    or public.is_platform_admin()
  );
create policy technician_profiles_insert_own on public.technician_profiles for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy technician_profiles_update_own on public.technician_profiles for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- organizations (insert only via sign-up trigger)
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id) or public.is_platform_admin());
create policy organizations_update_admin on public.organizations for update to authenticated
  using (public.has_org_role(id, array['admin']::public.organization_role[]))
  with check (public.has_org_role(id, array['admin']::public.organization_role[]));

-- organization_members (no insert: adding members requires an invitation/consent flow, NEXT)
create policy organization_members_select on public.organization_members for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());
create policy organization_members_update_admin on public.organization_members for update to authenticated
  using (public.has_org_role(organization_id, array['admin']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['admin']::public.organization_role[]));
create policy organization_members_delete_admin on public.organization_members for delete to authenticated
  using (public.has_org_role(organization_id, array['admin']::public.organization_role[]));

-- qualification_types (reference catalog)
create policy qualification_types_select on public.qualification_types for select to authenticated
  using (true);

-- technician_qualifications
create policy technician_qualifications_select on public.technician_qualifications for select to authenticated
  using (
    technician_profile_id = (select auth.uid())
    or public.can_view_member(technician_profile_id)
    or public.is_platform_admin()
  );
create policy technician_qualifications_insert_own on public.technician_qualifications for insert to authenticated
  with check (technician_profile_id = (select auth.uid()) and verification_status = 'pending');
create policy technician_qualifications_update_own on public.technician_qualifications for update to authenticated
  using (technician_profile_id = (select auth.uid()))
  with check (technician_profile_id = (select auth.uid()));
create policy technician_qualifications_delete_own on public.technician_qualifications for delete to authenticated
  using (technician_profile_id = (select auth.uid()));

-- availability_windows
create policy availability_windows_select on public.availability_windows for select to authenticated
  using (
    technician_profile_id = (select auth.uid())
    or public.can_view_member(technician_profile_id)
    or public.is_platform_admin()
  );
create policy availability_windows_insert_own on public.availability_windows for insert to authenticated
  with check (technician_profile_id = (select auth.uid()));
create policy availability_windows_update_own on public.availability_windows for update to authenticated
  using (technician_profile_id = (select auth.uid()))
  with check (technician_profile_id = (select auth.uid()));
create policy availability_windows_delete_own on public.availability_windows for delete to authenticated
  using (technician_profile_id = (select auth.uid()));

-- work_requirements (never deleted; status moves to cancelled/closed)
create policy work_requirements_select on public.work_requirements for select to authenticated
  using (public.is_org_member(organization_id) or public.is_platform_admin());
create policy work_requirements_insert_manager on public.work_requirements for insert to authenticated
  with check (
    public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[])
    and created_by = (select auth.uid())
    and status in ('draft', 'open')
  );
create policy work_requirements_update_manager on public.work_requirements for update to authenticated
  using (public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[]))
  with check (public.has_org_role(organization_id, array['admin', 'manager']::public.organization_role[]));

-- work_requirement_qualifications
create policy work_requirement_qualifications_select on public.work_requirement_qualifications
  for select to authenticated
  using (exists (
    select 1 from public.work_requirements wr
    where wr.id = work_requirement_id
      and (public.is_org_member(wr.organization_id) or public.is_platform_admin())
  ));
create policy work_requirement_qualifications_insert_manager on public.work_requirement_qualifications
  for insert to authenticated
  with check (exists (
    select 1 from public.work_requirements wr
    where wr.id = work_requirement_id
      and public.has_org_role(wr.organization_id, array['admin', 'manager']::public.organization_role[])
  ));
create policy work_requirement_qualifications_delete_manager on public.work_requirement_qualifications
  for delete to authenticated
  using (exists (
    select 1 from public.work_requirements wr
    where wr.id = work_requirement_id
      and public.has_org_role(wr.organization_id, array['admin', 'manager']::public.organization_role[])
  ));

-- audit_events: read-only for org admins (own org) and platform admins. No write grants.
create policy audit_events_select on public.audit_events for select to authenticated
  using (
    public.is_platform_admin()
    or (organization_id is not null
        and public.has_org_role(organization_id, array['admin']::public.organization_role[]))
  );

-- ---------------------------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------------------------

-- A professional editing the evidence of a reviewed qualification sends it back to review.
-- Prevents "get verified, then extend expires_at". Status changes by a verifier are untouched.
create function public.reset_verification_on_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.verification_status = old.verification_status
     and old.verification_status <> 'pending'
     and (new.qualification_type_id, new.issued_at, new.expires_at)
         is distinct from (old.qualification_type_id, old.issued_at, old.expires_at) then
    new.verification_status := 'pending';
  end if;
  return new;
end;
$$;
create trigger technician_qualifications_reset_verification
  before update on public.technician_qualifications
  for each row execute function public.reset_verification_on_change();

-- ---------------------------------------------------------------------------------------------
-- Audit (append-only, written by SECURITY DEFINER triggers; API roles cannot insert)
-- ---------------------------------------------------------------------------------------------
create function public.audit_requirement_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    new.created_by, new.organization_id, 'requirement.created', 'work_requirement', new.id,
    jsonb_build_object('headcount', new.headcount, 'urgency', new.urgency, 'status', new.status)
  );
  return new;
end;
$$;
create trigger work_requirements_audit_created
  after insert on public.work_requirements
  for each row execute function public.audit_requirement_created();

create function public.audit_qualification_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), null, 'qualification.verified', 'technician_qualification', new.id,
    jsonb_build_object('technician_profile_id', new.technician_profile_id,
                       'qualification_type_id', new.qualification_type_id)
  );
  return new;
end;
$$;
create trigger technician_qualifications_audit_verified
  after update of verification_status on public.technician_qualifications
  for each row
  when (new.verification_status = 'verified' and old.verification_status is distinct from 'verified')
  execute function public.audit_qualification_verified();

-- ---------------------------------------------------------------------------------------------
-- Sign-up: create profile + technician profile, or organization + admin membership.
-- platform_role is NEVER taken from user metadata.
-- ---------------------------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_account public.account_type :=
    case when v_meta ->> 'account_type' = 'organization' then 'organization'::public.account_type
         else 'professional'::public.account_type end;
  v_name text := left(coalesce(nullif(btrim(v_meta ->> 'display_name'), ''),
                               nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
                               'User'), 120);
  v_org_id uuid;
begin
  insert into public.profiles (id, display_name, account_type) values (new.id, v_name, v_account);

  if v_account = 'professional' then
    insert into public.technician_profiles (profile_id) values (new.id);
  else
    insert into public.organizations (name, type, country)
    values (
      left(coalesce(nullif(btrim(v_meta ->> 'organization_name'), ''), v_name || ' organization'), 160),
      case when v_meta ->> 'organization_type' in ('mro', 'airline', 'operator', 'staffing_agency', 'other')
           then (v_meta ->> 'organization_type')::public.organization_type
           else 'mro'::public.organization_type end,
      case when v_meta ->> 'country' ~ '^[A-Z]{2}$' then v_meta ->> 'country' end
    )
    returning id into v_org_id;
    insert into public.organization_members (organization_id, profile_id, role)
    values (v_org_id, new.id, 'admin');
  end if;

  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- RPC: atomic requirement creation. SECURITY INVOKER — RLS policies above apply.
-- ---------------------------------------------------------------------------------------------
create function public.create_work_requirement(
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
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if jsonb_typeof(p_qualifications) is distinct from 'array'
     or jsonb_array_length(p_qualifications) not between 1 and 20 then
    raise exception using errcode = '22023', message = 'qualifications must contain 1-20 items';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_qualifications) q where q ->> 'requirement_level' = 'hard'
  ) then
    raise exception using errcode = '22023', message = 'at least one hard qualification is required';
  end if;

  insert into public.work_requirements
    (organization_id, title, location, starts_at, ends_at, shift, headcount, urgency, status, created_by)
  values
    (p_organization_id, p_title, p_location, p_starts_at, p_ends_at, p_shift, p_headcount, p_urgency,
     'open', (select auth.uid()))
  returning id into v_id;

  insert into public.work_requirement_qualifications (work_requirement_id, qualification_type_id, requirement_level)
  select v_id, (q ->> 'qualification_type_id')::uuid, (q ->> 'requirement_level')::public.requirement_level
  from jsonb_array_elements(p_qualifications) q;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RPC: matchable data for a requirement (internal + external pools).
-- SECURITY DEFINER because organizations must never SELECT technician tables directly.
-- Returns ONLY: pseudonymous ref, relevant qualifications, overlapping availability,
-- base location, years of experience; display name only for internal or `open` visibility.
-- Not found and not authorized raise the same error (no existence oracle).
-- ---------------------------------------------------------------------------------------------
create function public.get_requirement_candidate_pool(p_requirement_id uuid)
returns table (
  candidate_ref text,
  candidate_pool text,
  candidate_display_name text,
  candidate_base_location text,
  candidate_years_experience integer,
  candidate_qualifications jsonb,
  candidate_availability jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_req public.work_requirements%rowtype;
begin
  select * into v_req from public.work_requirements where id = p_requirement_id;
  if not found
     or not public.has_org_role(v_req.organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return query
  with required_types as (
    select wrq.qualification_type_id
    from public.work_requirement_qualifications wrq
    where wrq.work_requirement_id = v_req.id
  ),
  org_members as (
    select om.profile_id from public.organization_members om where om.organization_id = v_req.organization_id
  ),
  -- ponytail: internal pool is uncapped (capacity must count everyone); paginate if orgs exceed ~1k technicians.
  internal_pool as (
    select tp.profile_id, 'internal'::text as pool_name
    from public.technician_profiles tp
    where tp.profile_id in (select profile_id from org_members)
  ),
  -- ponytail: external pool capped at 100, prefiltered by relevant qualification; add ranking/pagination later.
  external_pool as (
    select tp.profile_id, 'external'::text as pool_name
    from public.technician_profiles tp
    where tp.visibility in ('anonymous', 'open')
      and tp.profile_id not in (select profile_id from org_members)
      and exists (
        select 1 from public.technician_qualifications tq
        where tq.technician_profile_id = tp.profile_id
          and tq.status = 'active'
          and tq.qualification_type_id in (select qualification_type_id from required_types)
      )
    order by tp.profile_id
    limit 100
  ),
  pool as (
    select * from internal_pool
    union all
    select * from external_pool
  )
  select
    case when p.pool_name = 'internal' then p.profile_id::text
         else 'CF-' || upper(left(encode(sha256(convert_to(v_req.id::text || ':' || p.profile_id::text, 'UTF8')), 'hex'), 10))
    end,
    p.pool_name,
    case when p.pool_name = 'internal' or tp.visibility = 'open' then pr.display_name end,
    tp.base_location,
    tp.years_experience,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'qualificationTypeId', tq.qualification_type_id,
               'code', qt.code,
               'status', tq.status,
               'verificationStatus', tq.verification_status,
               'expiresAt', tq.expires_at
             ) order by qt.code)
      from public.technician_qualifications tq
      join public.qualification_types qt on qt.id = tq.qualification_type_id
      where tq.technician_profile_id = p.profile_id
        and tq.qualification_type_id in (select qualification_type_id from required_types)
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'startsAt', aw.starts_at,
               'endsAt', aw.ends_at,
               'status', aw.status
             ) order by aw.starts_at)
      from public.availability_windows aw
      where aw.technician_profile_id = p.profile_id
        and aw.starts_at < v_req.ends_at
        and aw.ends_at > v_req.starts_at
    ), '[]'::jsonb)
  from pool p
  join public.technician_profiles tp on tp.profile_id = p.profile_id
  join public.profiles pr on pr.id = p.profile_id;
end;
$$;

revoke execute on function
  public.reset_verification_on_change(),
  public.audit_requirement_created(),
  public.audit_qualification_verified(),
  public.handle_new_user(),
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer, public.requirement_urgency, jsonb),
  public.get_requirement_candidate_pool(uuid)
from public, anon;
grant execute on function
  public.create_work_requirement(uuid, text, text, timestamptz, timestamptz, public.shift_type, integer, public.requirement_urgency, jsonb),
  public.get_requirement_candidate_pool(uuid)
to authenticated;
