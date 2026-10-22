-- Crew Flex — «Cerrar cuenta»: the account leaves in one transaction, commitments and audit stay without
-- the profile (v1.8 `server/app.mjs:142-143`, M-3 default WITHOUT its partial delete B-8; technical default
-- T-42 in docs/integration/crewflex-v13/08-product-decisions.md). LOCAL ONLY.
-- NON-DESTRUCTIVE: two foreign keys move from RESTRICT/CASCADE to SET NULL (their columns become
-- nullable; no row changes now), three triggers and one RPC. No table, column or row is dropped.
--
-- WHAT LEAVES with the account (every path: this RPC, the Auth Admin API, the dashboard):
--   auth user, sessions and identities (Auth cascades) · profile · technician profile, qualifications,
--   availability windows and rotation · memberships · idempotency keys · own document rows (their
--   Storage objects: see close_my_account) · every invitation of the address (they hold it).
-- WHAT STAYS, without the profile:
--   applications of the technician (technician_profile_id → NULL; status, proposals and history kept, so
--   the organization's seats and the platform's history stay true) · requirements they created
--   (created_by → NULL) · audit rows (actor → NULL already, 20261009120000; ids in metadata stay).
-- RULES (BEFORE DELETE on profiles, so no deletion path skips them):
--   * refused while the person has an `accepted` or `confirmed` application, or while a requirement of
--     an organization that closes with them (below) has one — CFA11 = ACTIVE_COMMITMENTS, v1.8
--     «Resuelve primero los compromisos aceptados o confirmados.»;
--   * applications still in progress (received / shortlisted / proposed) are WITHDRAWN explicitly: an
--     event row (actor technician) and an `application.withdrawn` audit row with `account_closed: true`
--     — never a silent change (v1.8 withdrew every application, finished ones included: not copied);
--   * an organization whose last admin closes the account closes its draft / open / paused requirements
--     (v1.8 closed the company's offers), audited `requirement.status_changed` by guard_requirement_status;
--     its other applications are not moved (T-12); the organization row, its members and history stay;
--   * AFTER DELETE writes `account.closed` (no actor: the profile is gone; `self_service` tells the RPC
--     from an operator deletion).
-- Lock order: organization rows (last-admin check) → requirement rows → application rows → technician
-- advisory lock (taken by the availability cascade) — transition_application's order with the
-- organization in front. Residual (security review L-5): any valid session may close its account; the
-- typed word is a UI guard and no recent sign-in is required (an owner decision, like T22).

-- ---------------------------------------------------------------------------------------------
-- 1. Retention: SET NULL instead of RESTRICT (requirements) and CASCADE (applications)
-- ---------------------------------------------------------------------------------------------
alter table public.work_requirements alter column created_by drop not null;
alter table public.work_requirements drop constraint work_requirements_created_by_fkey;
alter table public.work_requirements add constraint work_requirements_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
-- Inserts still need `created_by = auth.uid()` (RLS work_requirements insert check): never NULL on create.

alter table public.applications alter column technician_profile_id drop not null;
alter table public.applications drop constraint applications_technician_profile_id_fkey;
alter table public.applications add constraint applications_technician_profile_id_fkey
  foreign key (technician_profile_id) references public.technician_profiles (profile_id) on delete set null;

-- Backstop for paths that delete a technician profile without its account (operator SQL): an
-- application in progress never loses its technician silently. Nothing else ever changes the column.
create function public.guard_application_technician_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('accepted', 'confirmed') then
    raise exception 'resolve the accepted and confirmed applications first' using errcode = 'CFA11';
  end if;
  if old.status in ('received', 'shortlisted', 'proposed') then
    raise exception 'withdraw the applications in progress first' using errcode = '55000';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_application_technician_removed() from public, anon, authenticated;
create trigger applications_technician_removed
  before update of technician_profile_id on public.applications
  for each row when (old.technician_profile_id is not null and new.technician_profile_id is null)
  execute function public.guard_application_technician_removed();

-- ---------------------------------------------------------------------------------------------
-- 2. What an account takes with it, whatever deletes it
-- ---------------------------------------------------------------------------------------------
create function public.before_account_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orgs uuid[];
  v_app record;
  v_request text := nullif(current_setting('crewflex.account_closure', true), '');
begin
  -- Two admins of one organization closing at once must not both see the other one staying
  -- (security review L-4): the organizations they administer are locked first (NO KEY UPDATE does not
  -- block the KEY SHARE that requirement inserts take), then the last-admin question is asked.
  perform 1 from public.organizations o
  where o.id in (select m.organization_id from public.organization_members m
                 where m.profile_id = old.id and m.role = 'admin')
  order by o.id
  for no key update;
  -- Organizations that close with this account: it is their last admin.
  select coalesce(array_agg(m.organization_id), '{}') into v_orgs
  from public.organization_members m
  where m.profile_id = old.id and m.role = 'admin'
    and not exists (select 1 from public.organization_members o
                    where o.organization_id = m.organization_id and o.role = 'admin'
                      and o.profile_id <> old.id);

  -- Locks in the global order, then the checks see a stable picture.
  perform 1 from public.work_requirements wr
  where wr.organization_id = any (v_orgs)
     or wr.id in (select a.requirement_id from public.applications a where a.technician_profile_id = old.id)
  order by wr.id
  for update;
  perform 1 from public.applications a where a.technician_profile_id = old.id order by a.id for update;

  if exists (
    select 1 from public.applications a
    where a.status in ('accepted', 'confirmed')
      and (a.technician_profile_id = old.id
           or a.requirement_id in (select wr.id from public.work_requirements wr
                                   where wr.organization_id = any (v_orgs)))
  ) then
    raise exception 'resolve the accepted and confirmed applications first' using errcode = 'CFA11';
  end if;

  -- Applications in progress: an explicit, audited withdrawal by the technician (T-04: no organization
  -- id and no person id in the audit row of a technician's act; the actor is leaving anyway).
  for v_app in
    select a.id, a.status, a.requirement_id from public.applications a
    where a.technician_profile_id = old.id and a.status in ('received', 'shortlisted', 'proposed')
    order by a.id
  loop
    update public.applications a set status = 'withdrawn' where a.id = v_app.id;
    insert into public.application_events (application_id, seq, from_status, to_status, actor)
    select v_app.id, coalesce(max(e.seq), 0) + 1, v_app.status, 'withdrawn', 'technician'
    from public.application_events e where e.application_id = v_app.id;
    insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
    values (null, null, 'application.withdrawn', 'application', v_app.id,
      jsonb_build_object('from', v_app.status, 'to', 'withdrawn', 'actor', 'technician',
                         'requirement_id', v_app.requirement_id, 'proposal_version', null,
                         'reason_provided', false, 'account_closed', true,
                         'request_id', case when v_request ~ '^[0-9a-f-]{36}$' then v_request end));
  end loop;

  -- The organization's offers close with its last admin (guard_requirement_status audits each one).
  update public.work_requirements wr set status = 'closed'
  where wr.organization_id = any (v_orgs) and wr.status in ('draft', 'open', 'paused', 'covered');

  return old;
end;
$$;
revoke execute on function public.before_account_deleted() from public, anon, authenticated;
create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function public.before_account_deleted();

-- Every invitation of the address leaves with the account (security review M-2): the consumed one
-- cascades already; revoked or expired ones would keep the e-mail address. On auth.users because the
-- profile trigger can no longer read the address during the cascade. Delivery accounts (no profile)
-- are deleted by finish_invitation_delivery and must leave their invitation in place.
create function public.forget_account_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email is not null and exists (select 1 from public.profiles p where p.id = old.id) then
    delete from public.account_invitations i where i.email = lower(old.email);
  end if;
  return old;
end;
$$;
revoke execute on function public.forget_account_invitations() from public, anon, authenticated;
create trigger on_auth_user_deleted_forget_invitations
  before delete on auth.users
  for each row execute function public.forget_account_invitations();

create function public.audit_account_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request text := nullif(current_setting('crewflex.account_closure', true), '');
begin
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (null, null, 'account.closed', 'profile', old.id,
    jsonb_build_object('account_type', old.account_type,
                       'self_service', v_request is not null,
                       'request_id', case when v_request ~ '^[0-9a-f-]{36}$' then v_request end));
  return old;
end;
$$;
revoke execute on function public.audit_account_closed() from public, anon, authenticated;
create trigger profiles_audit_closed
  after delete on public.profiles
  for each row execute function public.audit_account_closed();

-- ---------------------------------------------------------------------------------------------
-- 3. The caller closes their own account (no argument names the account: it is auth.uid()).
--    One transaction: own document rows first, as their owner (tombstones `owner_delete`, due at
--    once — the person asked for the erasure), then the Auth user, whose cascade runs the rules above.
--    Returns the storage paths of those documents so the `account` function removes the objects with
--    the caller's token; anything left is purged by documents-maintenance (20261019160200).
--    No privileged key: the function owner may delete from auth.users (Auth's own cascades follow).
-- ---------------------------------------------------------------------------------------------
create function public.close_my_account(p_request_id uuid default null)
returns table (storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_paths text[];
  v_claims text := current_setting('request.jwt.claims', true);
  v_claim_sub text := current_setting('request.jwt.claim.sub', true);
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  perform set_config('crewflex.account_closure', coalesce(p_request_id::text, 'self'), true);

  with gone as (
    delete from public.professional_documents d where d.owner_id = v_uid returning d.storage_path
  )
  select coalesce(array_agg(g.storage_path order by g.storage_path), '{}') into v_paths from gone g;

  -- From here the cascade runs as any account deletion does (no JWT, like Auth's own connection): the
  -- rows that leave with the account write no owner-delete audit with an actor that no longer exists.
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users u where u.id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;
  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_claim_sub, ''), true);
  perform set_config('crewflex.account_closure', '', true);

  return query select unnest(v_paths);
end;
$$;
revoke execute on function public.close_my_account(uuid) from public, anon;
grant execute on function public.close_my_account(uuid) to authenticated;
