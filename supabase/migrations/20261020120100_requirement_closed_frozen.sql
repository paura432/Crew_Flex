-- Crew Flex — a closed requirement is frozen (review of 20261020120000, finding M1).
-- NON-DESTRUCTIVE: no DROP, no data change, no privilege change. Adds one function and two triggers.
--
-- V1.8 has no job edit at all, and `closed` is terminal (server/app.mjs:88). The column grants of
-- foundation_v0 still let an admin/manager rewrite title/dates/headcount or strip the qualifications of
-- a closed need through PostgREST, unaudited — the closed record would no longer show what was closed.
-- The business columns are compared explicitly so the BR-1.4 trigger's no-op parent touch
-- (`set updated_at = updated_at`, 20261015130000) keeps working.

create function public.guard_closed_requirement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'work_requirements' then
    if (new.organization_id, new.title, new.location, new.starts_at, new.ends_at, new.shift,
        new.headcount, new.urgency, new.status)
       is distinct from
       (old.organization_id, old.title, old.location, old.starts_at, old.ends_at, old.shift,
        old.headcount, old.urgency, old.status) then
      raise exception 'a closed requirement cannot be changed' using errcode = '55000';
    end if;
    return new;
  end if;
  if exists (
    select 1 from public.work_requirements
    where id = coalesce(new.work_requirement_id, old.work_requirement_id) and status = 'closed'
  ) then
    raise exception 'a closed requirement cannot be changed' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;
revoke execute on function public.guard_closed_requirement() from public, anon, authenticated;

create trigger work_requirements_closed_frozen
  before update on public.work_requirements
  for each row when (old.status = 'closed')
  execute function public.guard_closed_requirement();

create trigger work_requirement_qualifications_closed_frozen
  before insert or update or delete on public.work_requirement_qualifications
  for each row execute function public.guard_closed_requirement();
