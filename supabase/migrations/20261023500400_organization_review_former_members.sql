-- Crew Flex — «La empresa no puede verificarse a sí misma» also for FORMER members (security review of
-- the admin-org package, MEDIUM-1; BR-20, S-16).
-- NON-DESTRUCTIVE: one DEFINER audit trigger on organization_members and a `create or replace` of
-- review_organization with the SAME signature, return type, SECURITY DEFINER and privileges. No data
-- change, no policy or grant change.
--
-- Problem: review_organization refused only CURRENT members. An organization admin may delete their own
-- membership (`organization_members_delete_admin`, foundation), and membership changes were not
-- audited, so a platform admin could leave their organization and then register its review.
-- Fix:
--   1. Every removed membership is audited `organization.member_removed` {profile_id, role} with the
--      organization id (ids only, S-9), whatever the path. Skipped when the organization itself is being
--      deleted (cascade: nothing left to review); the actor is null when it no longer exists (account
--      deletion cascade), as the audit FK requires.
--   2. review_organization refuses (42501, same as a current member) a reviewer who is a member, whose
--      removal from it is recorded, or who ever acted for it (an audit row of that organization with them
--      as actor). Memberships removed before this migration were not recorded (local only).

create function public.audit_organization_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return null; -- the organization itself is being deleted
  end if;
  if v_actor is not null and not exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor := null;
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (v_actor, old.organization_id, 'organization.member_removed', 'organization', old.organization_id,
    jsonb_build_object('profile_id', old.profile_id, 'role', old.role));
  return null;
end;
$$;
create trigger organization_members_audit_removed
  after delete on public.organization_members
  for each row execute function public.audit_organization_member_removed();
revoke execute on function public.audit_organization_member_removed() from public, anon, authenticated;

create or replace function public.review_organization(
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
  -- Nobody reviews an organization they belong to, belonged to, or acted for.
  if exists (select 1 from public.organization_members m
             where m.organization_id = v_org.id and m.profile_id = v_uid)
     or exists (select 1 from public.audit_events e
                where e.organization_id = v_org.id
                  and (e.actor_profile_id = v_uid
                       or (e.action = 'organization.member_removed'
                           and e.metadata ->> 'profile_id' = v_uid::text))) then
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
