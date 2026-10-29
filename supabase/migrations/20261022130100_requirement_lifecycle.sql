-- Crew Flex — requirement lifecycle (M05, owner decision 2026-10-22).
-- NON-DESTRUCTIVE: replaces the body of one trigger function (20261020120000); no DROP, no data change,
-- no privilege change.
--
-- Allowed status changes, the same table as `canChangeRequirementStatus` (src/domain/work-requirement.ts;
-- rls suite S compares both): open ↔ paused, draft → open, anything not closed → closed. `closed` stays
-- terminal. Nothing moves into `cancelled` (legacy value, T-14) or `covered` by hand (it comes with the
-- applications of D-06). Every change keeps its `requirement.status_changed` audit row (from, to).
-- Concurrency: the UPDATE row lock serialises two changes; the second sees the first's status as OLD.

create or replace function public.guard_requirement_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'closed' then
    raise exception 'a closed requirement cannot be reopened' using errcode = '55000';
  end if;
  if not (
    new.status = 'closed'
    or (old.status = 'open' and new.status = 'paused')
    or (old.status = 'paused' and new.status = 'open')
    or (old.status = 'draft' and new.status = 'open')
  ) then
    raise exception 'requirement status % → % is not allowed', old.status, new.status
      using errcode = '55000';
  end if;
  insert into public.audit_events (actor_profile_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()), new.organization_id, 'requirement.status_changed', 'work_requirement', new.id,
    jsonb_build_object('from', old.status, 'to', new.status)
  );
  return new;
end;
$$;
revoke execute on function public.guard_requirement_status() from public, anon, authenticated;
