-- Crew Flex — the organization's own data («Organización») and its review by a platform admin
-- (v2 diff 10 #5 / SH-03 #22 / ADM-03 #7, 30 ORG-07 #2-#8; OD-5 default = v1.8 connected
-- `server/app.mjs:83,189`, `Account.jsx:64`; technical defaults T-50…T-52).
-- NON-DESTRUCTIVE: one enum, four nullable/defaulted columns (every existing organization becomes
-- `pending`), one table, two triggers and two RPCs. No DROP, no data rewrite; existing grants and
-- policies unchanged (one column grant added).
--
-- v1.8 (connected): the company saves «Razón social», «Identificación fiscal», «Domicilio fiscal» and
-- «País»; a save returns it to `pending`; only the administrator registers «Revisión registrada»,
-- with a mandatory evidence note («Evidencia / observaciones de la revisión», ≤ 2000); the company
-- cannot verify itself («La revisión se registra desde administración. La empresa no puede
-- verificarse a sí misma.»).
-- Here:
--   * organizations.tax_id / tax_address (nullable: organizations created at sign-up have none),
--     review_status `pending` | `reviewed` and reviewed_at. review_status / reviewed_at have no column
--     grant: no API role can write them; only review_organization() (DEFINER) sets `reviewed`.
--   * changing name, type, country, tax_id or tax_address sends a reviewed organization back to
--     `pending`, whatever the write path (BEFORE trigger), and every such change is audited
--     `organization.updated` {fields, review_reset} — names and flags only (S-9).
--   * update_organization_profile(): SECURITY INVOKER, so RLS decides as before (organization admin
--     only, `organizations_update_admin`) — the existing model is kept; adds the optimistic version
--     (CF412) and the input rules of the screen. A save that changes nothing writes nothing.
--   * review_organization(): SECURITY DEFINER, platform admin only (in the body), never an
--     organization the admin belongs to, `pending` only, for the version the reviewer saw (55000),
--     fiscal data complete (55000), evidence 1–2000 characters kept in organization_reviews (platform
--     admins only), audit `organization.reviewed` with flags (no note, no organization id: the
--     reviewer's id never reaches the organization's own trail).

create type public.organization_review_status as enum ('pending', 'reviewed');

alter table public.organizations
  add column tax_id text
    check (tax_id is null or (char_length(btrim(tax_id)) >= 1 and char_length(tax_id) <= 80)),
  add column tax_address text
    check (tax_address is null or (char_length(btrim(tax_address)) >= 1 and char_length(tax_address) <= 400)),
  add column review_status public.organization_review_status not null default 'pending',
  add column reviewed_at timestamptz,
  add constraint organizations_review_consistent
    check ((review_status = 'reviewed') = (reviewed_at is not null));

comment on column public.organizations.review_status is
  'OD-5 default (v1.8): pending until a platform admin registers the review (review_organization); any data change returns it to pending.';

-- The admin's column grant grows by the two fiscal fields (RLS unchanged: organization admin only).
-- review_status / reviewed_at are deliberately NOT granted.
grant update (tax_id, tax_address) on public.organizations to authenticated;

-- Evidence of each review. Platform admins only; written only by review_organization().
create table public.organization_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reviewed_by uuid references public.profiles (id) on delete set null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  -- organizations.updated_at the reviewer looked at (what exactly was reviewed)
  organization_version timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.organization_reviews enable row level security;
create index organization_reviews_org_created_idx
  on public.organization_reviews (organization_id, created_at desc);
revoke all on table public.organization_reviews from public, anon, authenticated;
grant select on table public.organization_reviews to authenticated;
create policy organization_reviews_select_platform_admin on public.organization_reviews
  for select to authenticated using (public.is_platform_admin());

-- ---------------------------------------------------------------------------------------------
-- Any data change returns the organization to review (v1.8 `review:'pending'` on every save).
-- ---------------------------------------------------------------------------------------------
create function public.reset_organization_review_on_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.name, new.type, new.country, new.tax_id, new.tax_address)
     is distinct from (old.name, old.type, old.country, old.tax_id, old.tax_address) then
    new.review_status := 'pending';
    new.reviewed_at := null;
  end if;
  return new;
end;
$$;
create trigger organizations_reset_review
  before update on public.organizations
  for each row execute function public.reset_organization_review_on_change();

create function public.audit_organization_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fields text[] := array_remove(array[
    case when new.name is distinct from old.name then 'name' end,
    case when new.type is distinct from old.type then 'type' end,
    case when new.country is distinct from old.country then 'country' end,
    case when new.tax_id is distinct from old.tax_id then 'tax_id' end,
    case when new.tax_address is distinct from old.tax_address then 'tax_address' end
  ], null);
begin
  if cardinality(v_fields) > 0 then
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values ((select auth.uid()), new.id, 'organization.updated', 'organization', new.id,
      jsonb_build_object('fields', to_jsonb(v_fields),
                         'review_reset', old.review_status = 'reviewed'));
  end if;
  return null;
end;
$$;
create trigger organizations_audit_change
  after update on public.organizations
  for each row execute function public.audit_organization_change();

revoke execute on function
  public.reset_organization_review_on_change(),
  public.audit_organization_change()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The «Organización» save. INVOKER: RLS (`organizations_update_admin`) and the column grants decide.
-- ---------------------------------------------------------------------------------------------
create function public.update_organization_profile(
  p_organization_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_type public.organization_type,
  p_country text,
  p_tax_id text,
  p_tax_address text
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_country text := upper(btrim(coalesce(p_country, '')));
  v_tax_id text := btrim(coalesce(p_tax_id, ''));
  v_tax_address text := btrim(coalesce(p_tax_address, ''));
  v_updated timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  -- FOR UPDATE applies the UPDATE policy too: only an admin of the organization gets the row; a
  -- member, another organization or a random id all get the same 42501 (no oracle).
  select * into v_org from public.organizations o where o.id = p_organization_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'the version the client loaded is required';
  end if;
  if date_trunc('milliseconds', v_org.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = 'CF412', message = 'organization was modified by another session';
  end if;
  if char_length(v_name) not between 2 and 160
     or p_type is null
     or v_country !~ '^[A-Z]{2}$'
     or char_length(v_tax_id) not between 1 and 80
     or char_length(v_tax_address) not between 1 and 400 then
    raise exception using errcode = '22023', message = 'invalid organization data';
  end if;

  if (v_name, p_type, v_country, v_tax_id, v_tax_address)
     is not distinct from (v_org.name, v_org.type, v_org.country, v_org.tax_id, v_org.tax_address) then
    return v_org.updated_at; -- nothing changed: no write, no audit, the review stands
  end if;

  update public.organizations o
  set name = v_name, type = p_type, country = v_country, tax_id = v_tax_id, tax_address = v_tax_address
  where o.id = p_organization_id
  returning o.updated_at into v_updated;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  return v_updated;
end;
$$;

revoke execute on function public.update_organization_profile(
  uuid, timestamptz, text, public.organization_type, text, text, text
) from public, anon;
grant execute on function public.update_organization_profile(
  uuid, timestamptz, text, public.organization_type, text, text, text
) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- «Registrar revisión» (platform admin). DEFINER: the body is the only authorization.
-- ---------------------------------------------------------------------------------------------
create function public.review_organization(
  p_organization_id uuid,
  p_expected_updated_at timestamptz,
  p_note text,
  p_request_id uuid default null
)
returns table (id uuid, review_status public.organization_review_status, reviewed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org public.organizations%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_uid is null or not public.is_platform_admin() then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  if char_length(v_note) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'the review needs evidence (1-2000 characters)';
  end if;

  select * into v_org from public.organizations o where o.id = p_organization_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'organization not found';
  end if;
  if exists (select 1 from public.organization_members m
             where m.organization_id = v_org.id and m.profile_id = v_uid) then
    raise exception using errcode = '42501', message = 'nobody reviews their own organization';
  end if;
  if v_org.review_status <> 'pending' then
    raise exception using errcode = '55000', message = 'organization is not awaiting review';
  end if;
  if p_expected_updated_at is null
     or date_trunc('milliseconds', v_org.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) then
    raise exception using errcode = '55000', message = 'organization changed since it was loaded';
  end if;
  if v_org.country is null or v_org.tax_id is null or v_org.tax_address is null then
    raise exception using errcode = '55000', message = 'organization data is incomplete';
  end if;

  update public.organizations o
  set review_status = 'reviewed', reviewed_at = now()
  where o.id = v_org.id;

  insert into public.organization_reviews (organization_id, reviewed_by, note, organization_version)
  values (v_org.id, v_uid, v_note, v_org.updated_at);

  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_uid, null, 'organization.reviewed', 'organization', v_org.id,
    jsonb_build_object('previous_review_status', v_org.review_status,
                       'review_status', 'reviewed',
                       'note_provided', true,
                       'request_id', p_request_id));

  return query
  select o.id, o.review_status, o.reviewed_at from public.organizations o where o.id = v_org.id;
end;
$$;

revoke execute on function public.review_organization(uuid, timestamptz, text, uuid) from public, anon;
grant execute on function public.review_organization(uuid, timestamptz, text, uuid) to authenticated;
