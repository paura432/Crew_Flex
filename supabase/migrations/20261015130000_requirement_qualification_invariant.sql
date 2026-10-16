-- Crew Flex — BR-1.4 invariant in the database (remediation 2026-10-15, finding E-3).
-- NON-DESTRUCTIVE: no DROP, no data change, no privilege change. Adds one function and two
-- deferred constraint triggers.
--
-- Why: BR-1.4 ("1–20 qualifications, at least one hard") was checked only by the Edge Function and
-- by create_work_requirement(). The table grants (insert/delete on work_requirement_qualifications,
-- insert on work_requirements — needed by the SECURITY INVOKER RPC) let an admin/manager reach
-- PostgREST with their own JWT and (a) insert an `open` requirement with no qualifications, or
-- (b) delete the last `hard` row, or (c) "convert" it to soft by delete + insert. A requirement
-- without hard qualifications makes every available professional look eligible.
--
-- How: the check runs as a DEFERRABLE INITIALLY DEFERRED constraint trigger, i.e. on the state the
-- transaction commits, so creating the parent and its qualifications in one transaction (the RPC)
-- or swapping one hard qualification for another stays possible. Before counting, the parent row
-- is updated (a lock + a write): under READ COMMITTED a concurrent editor of the same requirement
-- waits and then counts with a fresh snapshot; under REPEATABLE READ/SERIALIZABLE it gets a
-- serialization failure instead of committing a stale count.
--
-- Scope: operational statuses `open` and `covered`. Drafts are not created by any application path
-- today (create_work_requirement always inserts `open`) and no requirement without a hard
-- qualification is evaluable (src/domain guard `assertEvaluableRequirement`); moving to open/covered
-- runs the check; cancelling or closing is always possible. Existing rows are NOT
-- re-validated by this migration (constraint triggers fire on change) — run the query in
-- docs/audit/CREWFLEX_REMEDIATION_2026_10_15.md §6 before applying it to a database with data.

create function public.enforce_requirement_qualifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_status public.requirement_status;
  v_hard integer;
  v_total integer;
begin
  if tg_table_name = 'work_requirements' then
    v_ids := array[new.id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.work_requirement_id];
  elsif tg_op = 'UPDATE' then
    v_ids := array[new.work_requirement_id, old.work_requirement_id];
  else
    v_ids := array[new.work_requirement_id];
  end if;

  foreach v_id in array v_ids loop
    -- Lock + write the parent: serializes concurrent edits of the same requirement (see header).
    update public.work_requirements set updated_at = updated_at
    where id = v_id
    returning status into v_status;
    continue when not found;            -- parent deleted in the same transaction (cascade)
    -- Enforced while the requirement is operational (open, covered). Drafts may be incomplete, and a
    -- cancelled/closed requirement must always be closable — even a legacy row that predates this
    -- check (independent review L1). Reopening runs the check again.
    continue when v_status in ('draft', 'cancelled', 'closed');

    select count(*) filter (where requirement_level = 'hard'), count(*)
      into v_hard, v_total
    from public.work_requirement_qualifications
    where work_requirement_id = v_id;

    if v_hard < 1 then
      raise exception using errcode = '23514',
        message = 'a work requirement needs at least one hard qualification';
    end if;
    if v_total > 20 then
      raise exception using errcode = '23514',
        message = 'a work requirement has at most 20 qualifications';
    end if;
  end loop;
  return null;
end;
$$;

revoke execute on function public.enforce_requirement_qualifications() from public, anon, authenticated;

-- Parent: a new non-draft requirement, or a status change (e.g. draft → open).
create constraint trigger work_requirements_qualification_invariant
  after insert or update of status on public.work_requirements
  deferrable initially deferred
  for each row execute function public.enforce_requirement_qualifications();

-- Children: any insert/delete (and update by privileged roles) of a requirement's qualifications.
create constraint trigger work_requirement_qualifications_invariant
  after insert or update or delete on public.work_requirement_qualifications
  deferrable initially deferred
  for each row execute function public.enforce_requirement_qualifications();
