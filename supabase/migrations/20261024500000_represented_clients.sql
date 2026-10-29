-- Crew Flex — package recruiter (v2 diff area 30: v2-24 «Espacio recruiter con clientes», ORG-08; area 10 task 17).
-- Model: docs/product/RECRUITER_MODEL.md (D-12, provisional) — a recruiter is an ordinary organization of type
-- `staffing_agency` whose admins/managers keep a portfolio of represented clients (v1.8 «Cartera de clientes»,
-- Company2.jsx:211). Technical defaults T-130…T-136 (08-product-decisions.md), BUSINESS_RULES BR-27.
-- NON-DESTRUCTIVE: one enum, two new tables (RLS on in this file, SELECT-only grants), three SECURITY DEFINER RPCs.
-- No existing table, column, policy, grant or function changes.
--
-- Representation lifecycle (RECRUITER_MODEL §1 «verifiable representation»):
--   pending  — added by an admin/manager of the agency (name + optional contact e-mail, as v1.8); NOT usable yet:
--              v1.8 made it usable at once («Cliente guardado»), the owner's model says «never self-declared by
--              the agency alone» (T-130);
--   active   — a platform admin recorded the evidence (activate_represented_client: never for an agency the admin
--              belongs, belonged to or acted for — the BR-20 rule —, evidence kept apart, platform admins only);
--   revoked  — the agency's admin/manager ended it; final (a client is added again as a new row). Revocation stops
--              new actions for that client at once (20261024500100): no publish/resume, no apply, no forward step
--              of an application; history and winding down (reject, withdraw, cancel, finish, close) stay.
-- Who reads a portfolio: every member of the agency (it names the requirements' clients) and platform admins; the
-- contact e-mail only its admins/managers and platform admins (list_represented_clients).
-- Nobody writes the tables directly: the RPCs below are their only writers, each audited (ids and flags only, S-9).

create type public.representation_status as enum ('pending', 'active', 'revoked');

create table public.represented_clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  contact_email text,
  status public.representation_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  constraint represented_clients_name_valid
    check (name = btrim(name) and char_length(name) between 2 and 120),
  constraint represented_clients_email_valid
    check (contact_email is null
           or (contact_email = lower(btrim(contact_email))
               and char_length(contact_email) between 3 and 254
               and contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  constraint represented_clients_status_dates check (
    (status = 'pending' and activated_at is null and revoked_at is null)
    or (status = 'active' and activated_at is not null and revoked_at is null)
    or (status = 'revoked' and revoked_at is not null))
);
alter table public.represented_clients enable row level security;
revoke all on table public.represented_clients from public, anon, authenticated;
-- One live (pending or active) client per name in an agency; a revoked one may be added again.
create unique index represented_clients_live_name_key
  on public.represented_clients (agency_id, lower(name)) where status <> 'revoked';
create index represented_clients_agency_idx on public.represented_clients (agency_id, created_at desc);
create index represented_clients_pending_idx on public.represented_clients (created_at)
  where status = 'pending';
create trigger represented_clients_set_updated_at before update on public.represented_clients
  for each row execute function public.set_updated_at();

create policy represented_clients_select on public.represented_clients for select to authenticated
  using (public.is_org_member(agency_id) or public.is_platform_admin());
-- Column grant: the contact e-mail is a third party's business contact — admins/managers and platform admins read it
-- through list_represented_clients below (security review LOW-4); plain members and the requirement embed
-- (`represented_clients ( id, name, status )`) get the other columns.
grant select (id, agency_id, name, status, created_at, updated_at, activated_at, revoked_at)
  on public.represented_clients to authenticated;

-- The evidence of each activation, apart from the client row (as organization_reviews, T-52): platform admins only.
create table public.represented_client_reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.represented_clients (id) on delete cascade,
  reviewed_by uuid references public.profiles (id) on delete set null,
  note text not null check (char_length(note) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.represented_client_reviews enable row level security;
revoke all on table public.represented_client_reviews from public, anon, authenticated;
create index represented_client_reviews_client_idx on public.represented_client_reviews (client_id);
create policy represented_client_reviews_select on public.represented_client_reviews for select to authenticated
  using (public.is_platform_admin());
grant select on public.represented_client_reviews to authenticated;

-- ---------------------------------------------------------------------------------------------
-- «Añadir cliente» (v1.8 Company2.jsx:211): an admin/manager of a staffing agency adds a client, `pending`.
-- Not an agency, not admin/manager, missing organization: the same 42501. Invalid name/e-mail: 22023. The same
-- live name twice: 23505. More than 200 live clients: 55000 (T-131). Audited `client.added`.
-- ---------------------------------------------------------------------------------------------
create function public.add_represented_client(
  p_organization_id uuid,
  p_name text,
  p_contact_email text default null,
  p_request_id uuid default null
)
returns table (id uuid, status public.representation_status, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_id uuid;
begin
  if v_uid is null
     or not public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- The type is read under a share lock: a concurrent type change waits for this transaction.
  perform 1 from public.organizations o
  where o.id = p_organization_id and o.type = 'staffing_agency'
  for share;
  if not found then
    raise exception using errcode = '42501', message = 'only a staffing agency represents clients';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'the client name has 2-120 characters';
  end if;
  if v_email is not null and (char_length(v_email) not between 3 and 254
                              or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception using errcode = '22023', message = 'invalid contact e-mail';
  end if;
  -- Serialises adds of one agency so the cap holds under concurrency.
  perform pg_advisory_xact_lock(hashtextextended('represented_clients:' || p_organization_id::text, 0));
  if (select count(*) from public.represented_clients rc
      where rc.agency_id = p_organization_id and rc.status <> 'revoked') >= 200
     or (select count(*) from public.represented_clients rc
         where rc.agency_id = p_organization_id and rc.status = 'pending') >= 50 then
    raise exception using errcode = '55000', message = 'too many live or pending clients';
  end if;

  insert into public.represented_clients (agency_id, name, contact_email, created_by)
  values (p_organization_id, v_name, v_email, v_uid)
  returning represented_clients.id into v_id;

  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, p_organization_id, 'client.added', 'represented_client', v_id,
          jsonb_build_object('client_id', v_id, 'email_provided', v_email is not null,
                             'request_id', p_request_id));

  return query select rc.id, rc.status, rc.created_at from public.represented_clients rc where rc.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- «Revocar»: an admin/manager of the client's agency. Final; revoking twice is a no-op. Missing and not allowed are
-- the same 42501 (no oracle on client ids). The role first, then the lock (as the requirement RPCs, LOW-1).
-- Audited `client.revoked {client_id, from}`.
-- ---------------------------------------------------------------------------------------------
create function public.revoke_represented_client(p_client_id uuid, p_request_id uuid default null)
returns table (id uuid, status public.representation_status, revoked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_client public.represented_clients%rowtype;
begin
  if v_uid is null
     or not public.has_org_role(
       (select rc.agency_id from public.represented_clients rc where rc.id = p_client_id),
       array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  select * into v_client from public.represented_clients rc where rc.id = p_client_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if v_client.status = 'revoked' then
    return query select v_client.id, v_client.status, v_client.revoked_at;
    return;
  end if;

  update public.represented_clients rc
  set status = 'revoked', revoked_at = now()
  where rc.id = v_client.id;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, v_client.agency_id, 'client.revoked', 'represented_client', v_client.id,
          jsonb_build_object('client_id', v_client.id, 'from', v_client.status, 'request_id', p_request_id));

  return query select rc.id, rc.status, rc.revoked_at from public.represented_clients rc where rc.id = v_client.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- «Registrar evidencia y activar» (RECRUITER_MODEL §1; T-130): a platform admin, with evidence (1–2000), for a
-- `pending` client of an organization that is still a staffing agency, never one the admin belongs, belonged to
-- (removal audited, 20261023500400) or acted for — the BR-20 rule of review_organization. The evidence goes to
-- represented_client_reviews (platform admins only). Audited `client.activated` WITHOUT organization id, as the
-- organization review (T-52): the agency's own trail never carries a platform admin's id.
-- ---------------------------------------------------------------------------------------------
create function public.activate_represented_client(
  p_client_id uuid,
  p_note text,
  p_request_id uuid default null
)
returns table (id uuid, status public.representation_status, activated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_note text := btrim(coalesce(p_note, ''));
  v_client public.represented_clients%rowtype;
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if char_length(v_note) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'the activation needs evidence (1-2000 characters)';
  end if;
  select * into v_client from public.represented_clients rc where rc.id = p_client_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;
  if exists (select 1 from public.organization_members m
             where m.organization_id = v_client.agency_id and m.profile_id = v_uid)
     or exists (select 1 from public.audit_events e
                where e.organization_id = v_client.agency_id
                  and (e.actor_profile_id = v_uid
                       or (e.action = 'organization.member_removed'
                           and e.metadata ->> 'profile_id' = v_uid::text))) then
    raise exception using errcode = '42501', message = 'nobody activates a client of their own agency';
  end if;
  if v_client.status <> 'pending' then
    raise exception using errcode = '55000', message = 'client is not awaiting activation';
  end if;
  perform 1 from public.organizations o
  where o.id = v_client.agency_id and o.type = 'staffing_agency'
  for share;
  if not found then
    raise exception using errcode = '55000', message = 'the organization is no longer a staffing agency';
  end if;

  update public.represented_clients rc
  set status = 'active', activated_at = now()
  where rc.id = v_client.id;
  insert into public.represented_client_reviews (client_id, reviewed_by, note)
  values (v_client.id, v_uid, v_note);
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'client.activated', 'represented_client', v_client.id,
          jsonb_build_object('client_id', v_client.id, 'agency_id', v_client.agency_id, 'note_provided', true,
                             'request_id', p_request_id));

  return query
  select rc.id, rc.status, rc.activated_at from public.represented_clients rc where rc.id = v_client.id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The portfolio (v1.8 «Cartera de clientes»), newest first, ≤ 200: every member of the agency and platform admins;
-- the contact e-mail only for the agency's admins/managers and platform admins (plain members get NULL). Anyone
-- else: 42501.
-- ---------------------------------------------------------------------------------------------
create function public.list_represented_clients(p_organization_id uuid)
returns table (
  id uuid,
  agency_id uuid,
  name text,
  contact_email text,
  status public.representation_status,
  created_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_full boolean;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  v_full := public.is_platform_admin()
    or public.has_org_role(p_organization_id, array['admin', 'manager']::public.organization_role[]);
  if not v_full and not public.is_org_member(p_organization_id) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select rc.id, rc.agency_id, rc.name, case when v_full then rc.contact_email end, rc.status, rc.created_at,
         rc.activated_at, rc.revoked_at
  from public.represented_clients rc
  where rc.agency_id = p_organization_id
  order by rc.created_at desc, rc.id
  limit 200;
end;
$$;

-- The platform admin's review queue: pending first (newest first within a state), ≤ 200, with the agency's name.
create function public.list_representation_reviews()
returns table (
  id uuid,
  agency_id uuid,
  agency_name text,
  name text,
  contact_email text,
  status public.representation_status,
  created_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if (select auth.uid()) is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return query
  select rc.id, rc.agency_id, o.name, rc.name, rc.contact_email, rc.status, rc.created_at, rc.activated_at,
         rc.revoked_at
  from public.represented_clients rc
  join public.organizations o on o.id = rc.agency_id
  order by rc.status, rc.created_at desc, rc.id
  limit 200;
end;
$$;

revoke execute on function
  public.add_represented_client(uuid, text, text, uuid),
  public.revoke_represented_client(uuid, uuid),
  public.activate_represented_client(uuid, text, uuid),
  public.list_represented_clients(uuid),
  public.list_representation_reviews()
from public, anon;
grant execute on function
  public.add_represented_client(uuid, text, text, uuid),
  public.revoke_represented_client(uuid, uuid),
  public.activate_represented_client(uuid, text, uuid),
  public.list_represented_clients(uuid),
  public.list_representation_reviews()
to authenticated;
