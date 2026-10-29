-- Crew Flex — «Red visible» on the organization home (v2 diff 50 #13, SHOT-05 #3; v1.8
-- `Dashboard.jsx:24` «Red visible · Según permisos y privacidad»: the candidates the organization can
-- see; T-146). A count only: no ids, names or rows leave the function.
-- NON-DESTRUCTIVE: one SECURITY DEFINER function and its EXECUTE grant. No table or data change.
--
-- Definition = the candidate filter of app_private.ranked_external_pool (BR-8 + N-08/T-35) without the
-- requirement-specific qualification filter: technician profiles whose visibility lets THIS organization
-- find them (`anonymous`, `open`; `verified_orgs` once the organization's review is registered), that are
-- not its own members and have not blocked it. `private` never counts. Internal members are the
-- workforce («Plantilla»), not the network.
-- Admin/manager of that organization only, like the other hiring counters (T-93); 42501 otherwise.
-- tests/db/shell-visual.test.ts proves it against src/domain/organization.ts `isExternallyMatchable`.

create function public.count_visible_network(p_organization_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or not public.has_org_role(
       p_organization_id, array['admin', 'manager']::public.organization_role[]) then
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  return (
    select count(*)::integer
    from public.technician_profiles tp
    where (tp.visibility in ('anonymous', 'open')
           or (tp.visibility = 'verified_orgs'
               and exists (select 1 from public.organizations o
                           where o.id = p_organization_id and o.review_status = 'reviewed')))
      and not exists (select 1 from public.organization_members om
                      where om.organization_id = p_organization_id and om.profile_id = tp.profile_id)
      and not exists (select 1 from public.technician_organization_blocks b
                      where b.technician_profile_id = tp.profile_id
                        and b.organization_id = p_organization_id)
  );
end;
$$;

revoke execute on function public.count_visible_network(uuid) from public, anon;
grant execute on function public.count_visible_network(uuid) to authenticated;
