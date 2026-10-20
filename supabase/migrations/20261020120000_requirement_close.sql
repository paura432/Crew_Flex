-- Crew Flex — close a work requirement (V1.8 parity, second audit 2026-10-20).
-- NON-DESTRUCTIVE: no DROP, no data change, no privilege change. Adds one function and one trigger.
--
-- V1.8 connected `job.status` (server/app.mjs:88): «La oferta cerrada no se reabre» — closing is
-- terminal. BR-1.9: requirements are never deleted; they end as closed. Admins/managers already hold
-- `update (status)` under RLS (foundation_v0), so the rule lives here, where direct PostgREST writes
-- cannot skip it, and every status change is audited (`requirement.status_changed`).
-- Not ported: V1.8 blocks closing while accepted/confirmed applications exist — there are no
-- applications yet (D-06); that check comes with them. Pause/reopen (V1.8 `paused`) waits for D-06 too.

create function public.guard_requirement_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'closed' then
    raise exception 'a closed requirement cannot be reopened' using errcode = '55000';
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

create trigger work_requirements_status_change
  before update of status on public.work_requirements
  for each row when (old.status is distinct from new.status)
  execute function public.guard_requirement_status();
